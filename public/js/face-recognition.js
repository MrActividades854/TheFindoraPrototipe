// face-recognition.js — VERSIÓN OFICIAL UNIFICADA
// Un solo pipeline TinyFaceDetector para TODO el sistema

import { CONFIG } from "./config.js";
import * as faceapi from 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js';

export default class FaceRecognitionManager {
    constructor({ modelPath = '/models', getActiveVideo = () => null, onNotification = () => {} } = {}) {

        this.modelPath = modelPath;
        this.getActiveVideo = getActiveVideo;
        this.onNotification = onNotification;

        this.labeledDescriptors = [];
        this.faceMatcher = null;

        this.detecting = false;
        this.showDebugPoint = false;

        this.tracked = [];
        this.MAX_DIST = 120;
        this.ALERT_TIMEOUT = 10000;

        this.peopleLastSeen = {};
        this.activeAlerts = {};
        this.knownPeople = new Set();

        // Detector único para todo
        this.detectorOptions = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
        });

        this.threshold = 0.55;
        this.STABLE_FRAMES = 8;

        this.lastBoxWidth = 0;
        this.lastBoxHeight = 0;

        this.unconfirmedUnknownFrames = 0;
        this.confirmUnknownAfter = 5;

        this.personLastRoom = {};
    }

    async loadModels() {
        await faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath);
        await faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath); 
        console.log("Modelos cargados (solo TinyFaceDetector).");
    }

    async loadProfilesFromServer() {
        const res = await fetch(`${CONFIG.API_URL}/api/profiles_full`);

if (!response.ok) {
    console.error("Error cargando perfiles:", response.status);
    this.onNotification("Error cargando perfiles", "error");
    return [];
}

        let profiles;

        try {
            profiles = await res.json();
        } catch (e) {
            console.error("Error parseando perfiles:", e);
            this.onNotification("Error parseando perfiles", "error");
            return [];
        }

        if (!Array.isArray(profiles)) {
            console.error("Perfiles inválidos recibidos:", profiles);
            this.onNotification("Perfiles inválidos recibidos", "error");
            return [];
        }

        console.log("PERFILES RECIBIDOS:", profiles);


        this.labeledDescriptors = [];

        this.profileMap = {}; // nombre → id

        for (const p of profiles) {
            if (!p.images || p.images.length === 0) continue;

            const descriptors = [];

            for (const imgUrl of p.images) {
                try {
                    const img = await faceapi.fetchImage(imgUrl);
                    const det = await faceapi
                        .detectSingleFace(img)
                        .withFaceLandmarks()
                        .withFaceDescriptor();

                    if (det) descriptors.push(det.descriptor);
                } catch { }
            }

            if (descriptors.length > 0) {
                this.labeledDescriptors.push(
                    new faceapi.LabeledFaceDescriptors(p.name, descriptors)
                );
            }
        }

        this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, this.threshold);
        console.log(`[FaceRec] Perfiles cargados: ${this.labeledDescriptors.length}`);
    }

    // ------------------------------------------------------------------------------------
    // PIPELINE ÚNICO: startMultiDetection()
    // ------------------------------------------------------------------------------------
    startMultiDetection({ videos, getRoomByVideo, onDetect }) {
        if (this.detecting) return;

        this.detecting = true;

        const loop = async () => {
            while (this.detecting) {

                for (const vid of videos) {
                    if (!vid || !vid._canvas || vid.readyState < 2) continue;

                    const canvas = vid._canvas;
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    try {
                        const results = await faceapi
                            .detectAllFaces(vid, this.detectorOptions)
                            .withFaceLandmarks()
                            .withFaceDescriptors();

                        for (const det of results) {
                            const room = getRoomByVideo ? getRoomByVideo(vid) : "unknown";

                            // IDENTIFICACIÓN
                            const match = this.faceMatcher.findBestMatch(det.descriptor);
                            const label = match.distance < this.threshold ? match.label : "Desconocido";

                            // TRACKING
                            const track = this._applyTracking(det);

                            // LÓGICA DE NOTIFICACIONES
                            this._applyPersonLogic(track, label, room);

                            // CALLBACK A UI
                            if (onDetect) onDetect(label, room, vid);

                            // DIBUJO
                            this._drawTracked(canvas, track, label);
                        }

                    } catch (e) {
                        console.warn("Error pipeline detección:", e);
                    }
                }

                await this._sleep(40);
            }
        };

        loop();
    }

    stopDetection() {
        this.detecting = false;
        this.tracked = [];
        this.peopleLastSeen = {};
        this.activeAlerts = {};
        this.knownPeople = new Set();
        this.unconfirmedUnknownFrames = 0;
        this.personLastRoom = {};

    }

    // ------------------------------------------------------------------------------------
    // TRACKING
    // ------------------------------------------------------------------------------------
    _applyTracking(det) {
        const box = det.detection.box;

        this.lastBoxWidth = box.width;
        this.lastBoxHeight = box.height;

        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        return this.assignTracked(cx, cy, box.width, box.height);
    }

    assignTracked(x, y, w, h) {
        for (const t of this.tracked) {
            const dist = Math.hypot(t.smoothedX - x, t.smoothedY - y);
            if (dist < this.MAX_DIST) {

                const f = 0.65;
                t.smoothedX = t.smoothedX * (1 - f) + x * f;
                t.smoothedY = t.smoothedY * (1 - f) + y * f;
                t.smoothedWidth = t.smoothedWidth * (1 - f) + w * f;
                t.smoothedHeight = t.smoothedHeight * (1 - f) + h * f;

                t.lastSeen = Date.now();
                return t;
            }
        }

        const colors = ['#00FF00', '#FF3B30', '#007AFF', '#FF9500', '#AF52DE'];
        const newT = {
            smoothedX: x,
            smoothedY: y,
            smoothedWidth: w,
            smoothedHeight: h,
            color: colors[this.tracked.length % colors.length],
            stabilityFrames: 0,
            lastSeen: Date.now(),
            lastLabel: "Desconocido",

            // Añadir:
            unknownFrames: 0,
            unknownShown: false,


            hasLeft: false,

        };

        this.tracked.push(newT);
        return newT;
    }

    // ------------------------------------------------------------------------------------
    // LÓGICA DE PERSONAS
    // ------------------------------------------------------------------------------------
    _applyPersonLogic(track, label, room) {

        // 1. actualización interna
        this.updateTrackedPersonDetection(track, label);

        // 2. ubicación en sala
        if (label !== "Desconocido") {
            this.updatePersonLocation(label, room);
        }

        // 3. limpiar personas salidas
        this.checkAllGone();
    }

    updateTrackedPersonDetection(track, label) {
        const now = Date.now();

        if (label !== "Desconocido") {

              // Resetear unknown si antes era desconocido
    track.unknownFrames = 0;
    track.unknownShown = false;

            track.lastLabel = label;
            track.lastSeen = now;

            if (!this.knownPeople.has(label)) {
                this.knownPeople.add(label);
                this.onNotification(`${label} ha entrado`, "success");
            }

            return;
        }

track.unknownFrames++;
track.lastSeen = now;

// Solo mostrar una vez por track
if (track.unknownFrames >= this.confirmUnknownAfter && !track.unknownShown) {
    track.unknownShown = true;
    this.onNotification(`Desconocido detectado`, "warning");
}

    }

    updatePersonLocation(name, room) {
        if (!this.personLastRoom[name]) {
    // Primera vez que vemos a esta persona, solo guardamos la sala
    this.personLastRoom[name] = room;
    this._sendLocationUpdate(name, room);
    return;
    
}



// Si la sala cambió realmente, notificamos
if (this.personLastRoom[name] !== room) {
    this.onNotification(`${name} se movió a ${room}`, "info");
    this.personLastRoom[name] = room;
    this._sendLocationUpdate(name, room);
}

}

async _sendLocationUpdate(name, room) {
    const profile_id = this.profileMap[name];
    if (!profile_id) return;

    fetch('/api/update_location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            profile_id,
            last_room: room
        })
    });
}


checkAllGone() {
    const now = Date.now();

    for (const t of this.tracked) {

        // Si ya notificamos que se fue, no volver a hacerlo
        if (t.hasLeft) continue;

        if (now - t.lastSeen > this.ALERT_TIMEOUT) {
            t.hasLeft = true; // Marcar como salida notificada
            this.onNotification(`${t.lastLabel} salió`, "warning");
        }
    }

    // Limpieza opcional: eliminar tracks con hasLeft = true
this.tracked = this.tracked.filter(t => !t.hasLeft);

}


    // ------------------------------------------------------------------------------------
    // DIBUJAR
    // ------------------------------------------------------------------------------------
    _drawTracked(canvas, track, label) {
        const ctx = canvas.getContext("2d");

        const x = track.smoothedX - track.smoothedWidth / 2;
        const y = track.smoothedY - track.smoothedHeight / 2;

        ctx.lineWidth = 2;
        ctx.strokeStyle = track.color;
        ctx.strokeRect(x, y, track.smoothedWidth, track.smoothedHeight);

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(x, y - 20, 80, 20);

        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.fillText(label, x + 5, y - 5);
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}
