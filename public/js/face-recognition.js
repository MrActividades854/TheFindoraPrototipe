// face-recognition.js — CON FIX PARA PERFILES VACÍOS

import { CONFIG } from "./config.js";
import * as faceapi from 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js';

export default class FaceRecognitionManager {
    constructor({ modelPath = CONFIG.MODEL_PATH, getActiveVideo = () => null, onNotification = () => {} } = {}) {
        console.log("🔧 FaceRecognitionManager constructor");
        console.log("📁 ModelPath:", modelPath);

        this.modelPath = modelPath;
        this.getActiveVideo = getActiveVideo;
        this.onNotification = onNotification;

        this.labeledDescriptors = [];
        this.faceMatcher = null;
        this.profileMap = {};
        this.peopleState = {};

        this.detecting = false;
        this.showDebugPoint = false;

        this.tracked = [];
        this.MAX_DIST = 120;
        this.ALERT_TIMEOUT = 10000;

        this.peopleLastSeen = {};
        this.activeAlerts = {};
        this.knownPeople = new Set();

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
        
        console.log("✅ FaceRecognitionManager creado");
    }

    async loadModels() {
        console.log("🔄 Iniciando carga de modelos...");
        console.log("📍 Ruta de modelos:", this.modelPath);
        
        try {
            console.log("⏳ Cargando TinyFaceDetector...");
            await faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath);
            console.log("✅ TinyFaceDetector cargado");
            
            console.log("⏳ Cargando FaceLandmark68Net...");
            await faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath);
            console.log("✅ FaceLandmark68Net cargado");
            
            console.log("⏳ Cargando FaceRecognitionNet...");
            await faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath);
            console.log("✅ FaceRecognitionNet cargado");
            
            console.log("⏳ Cargando SsdMobilenetv1...");
            await faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath);
            console.log("✅ SsdMobilenetv1 cargado");
            
            console.log("🎉 TODOS LOS MODELOS CARGADOS EXITOSAMENTE");
            return true;
            
        } catch (error) {
            console.error("\n❌ ERROR CRÍTICO cargando modelos:");
            console.error("Tipo:", error.constructor.name);
            console.error("Mensaje:", error.message);
            throw error;
        }
    }

    async loadProfilesFromServer() {
        console.log("🔄 Iniciando carga de perfiles...");
        const useWS = localStorage.getItem("useWebSocket") === "true";
        console.log("🌐 WebSocket activado:", useWS);
        
        if (!useWS) {
            console.warn("⚠️ WebSocket OFF → Inicializando sin perfiles");
            this._initEmptyMatcher();
            return [];
        }

        try {
            const cached = localStorage.getItem(CONFIG.PROFILES_KEY);

            if (cached) {
                const profiles = JSON.parse(cached);
                console.log(`Cargando ${profiles.length} perfil(es) desde caché local`)
                await this._loadProfilesFromData(profiles);
                return profiles;
            };

            console.log("📡 Solicitando perfiles del servidor...");
            const res = await fetch(`https://thefindoraprototipe.onrender.com/api/profiles_full`);
            console.log("📥 Respuesta recibida - Status:", res.status);

            if (!res.ok) {
                console.error("❌ Error HTTP:", res.status, res.statusText);
                this._initEmptyMatcher();
                this.onNotification("Error cargando perfiles del servidor", "error");
                return [];
            }

            const profiles = await res.json();
            console.log("Perfiles recibidos:", profiles.length);

            localStorage.setItem(CONFIG.PROFILES_KEY, JSON.stringify(profiles));

            // CRÍTICO: Verificar si hay perfiles

            if (!Array.isArray(profiles) || profiles.length === 0) {
                console.warn("⚠️ No hay perfiles en el servidor");
                this._initEmptyMatcher();
                this.onNotification("No hay perfiles registrados aún", "info");
                return [];
            }

            this.labeledDescriptors = [];
            this.profileMap = {};

            let processedCount = 0;

            for (const p of profiles) {
                if (!p.images || p.images.length === 0) {
                    console.warn(`⚠️ Perfil ${p.name} sin imágenes`);
                    continue;
                }

                const descriptors = [];

                for (const imgUrl of p.images) {
                    try {
                        const img = await faceapi.fetchImage(imgUrl);
                        const det = await faceapi
                            .detectSingleFace(img)
                            .withFaceLandmarks()
                            .withFaceDescriptor();

                        if (det) {
                            descriptors.push(det.descriptor);
                        } else {
                            console.warn(`  ⚠️ No se detectó rostro en: ${imgUrl}`);
                        }
                    } catch (err) {
                        console.warn(`  ❌ Error procesando imagen:`, err.message);
                    }
                }

                if (descriptors.length > 0) {
                    this.labeledDescriptors.push(
                        new faceapi.LabeledFaceDescriptors(p.name, descriptors)
                    );
                    this.profileMap[p.name] = p.id;
                    processedCount++;
                    console.log(`✅ Perfil ${p.name}: ${descriptors.length} descriptores`);
                } else {
                    console.warn(`⚠️ Perfil ${p.name}: Sin descriptores válidos`);
                }
            }

            // ✅ CRÍTICO: Verificar que tengamos al menos un perfil válido
            if (this.labeledDescriptors.length === 0) {
                console.warn("⚠️ No se pudo procesar ningún perfil con descriptores válidos");
                this._initEmptyMatcher();
                this.onNotification("No hay perfiles válidos para reconocimiento", "warning");
                return [];
            }

            // ✅ Crear FaceMatcher solo si hay perfiles
            this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, this.threshold);
            console.log(`🎉 ${processedCount} perfil(es) procesado(s) correctamente`);
            
            return profiles;
            
        } catch (error) {
            console.error("❌ Error en loadProfilesFromServer:", error.message);
            console.error("Stack:", error.stack);
            
            this._initEmptyMatcher();
            this.onNotification("Error cargando perfiles del servidor", "error");
            return [];
        }
    }

    async _loadProfilesFromData(profiles) {
    this.labeledDescriptors = [];
    this.profileMap = {};

    for (const p of profiles) {
        if (!p.images || !p.images.length) continue;

        const descriptors = [];

        for (const imgUrl of p.images) {
            try {
                const img = await faceapi.fetchImage(imgUrl);
                const det = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (det) descriptors.push(det.descriptor);
            } catch {}
        }

        if (descriptors.length) {
            this.labeledDescriptors.push(
                new faceapi.LabeledFaceDescriptors(p.name, descriptors)
            );
            this.profileMap[p.name] = p.id;
        }
    }

    if (this.labeledDescriptors.length === 0) {
        this._initEmptyMatcher();
        return;
    }

    this.faceMatcher = new faceapi.FaceMatcher(
        this.labeledDescriptors,
        this.threshold
    );
}


    // ✅ NUEVO: Inicializar FaceMatcher vacío
    _initEmptyMatcher() {
        console.log("🔧 Inicializando FaceMatcher vacío (sin perfiles)");
        
        // Crear un descriptor dummy para poder inicializar el matcher
        const dummyDescriptor = new Float32Array(128); // 128 dimensiones
        for (let i = 0; i < 128; i++) {
            dummyDescriptor[i] = Math.random(); // Valores aleatorios
        }
        
        const dummyLabeled = new faceapi.LabeledFaceDescriptors(
            '__DUMMY__', 
            [dummyDescriptor]
        );
        
        this.labeledDescriptors = [dummyLabeled];
        this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, 0.9); // Threshold alto para que nunca matchee
        
        console.log("✅ FaceMatcher vacío inicializado");
    }

    startMultiDetection({ videos, getRoomByVideo, onDetect }) {
        console.log("🎬 Iniciando detección múltiple");
        console.log("📹 Videos:", videos.length);
        
        const useWS = localStorage.getItem("useWebSocket") === "true";

        if (!useWS) {
            const before = videos.length;
            videos = videos.filter(v => v.dataset.type !== "remote");
            console.log(`🔍 Modo local: ${before} → ${videos.length} videos`);
        }

        if (this.detecting) {
            console.warn("⚠️ Detección ya activa");
            return;
        }

        if (!this.faceMatcher) {
            console.error("❌ FaceMatcher no inicializado");
            this._initEmptyMatcher(); // Inicializar vacío si no existe
        }

        this.detecting = true;
        console.log("✅ Detección iniciada");

        const loop = async () => {
            let frameCount = 0;
            
            while (this.detecting) {
                frameCount++;
                
                if (frameCount === 1 || frameCount % 100 === 0) {
                    console.log(`📊 Frame ${frameCount}`);
                }

                for (const vid of videos) {
                    if (!vid || vid.readyState < 2) continue;

                    if (!vid._canvas) {
                        const c = faceapi.createCanvasFromMedia(vid);
                        vid._canvas = c;
                        vid.parentNode.appendChild(c);

                        c.style.position = "absolute";
                        c.style.top = "0";
                        c.style.left = "0";
                        c.style.width = "100%";
                        c.style.height = "100%";
                        
                        console.log(`🎨 Canvas creado: ${vid.dataset.feedId}`);
                    }

                    const canvas = vid._canvas;
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });

                    try {
                        const results = await faceapi
                            .detectAllFaces(vid, this.detectorOptions)
                            .withFaceLandmarks()
                            .withFaceDescriptors();

                        if (results.length > 0 && frameCount % 50 === 0) {
                            console.log(`👤 ${results.length} rostro(s) en ${vid.dataset.feedId}`);
                        }

                        const displaySize = { width: vid.videoWidth, height: vid.videoHeight };
                        faceapi.matchDimensions(canvas, displaySize);

                        const detections = faceapi.resizeResults(results, displaySize);

                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        for (let i = 0; i < detections.length; i++) {
                            const det = detections[i];

                            const room = getRoomByVideo ? getRoomByVideo(vid) : "unknown";

                            // ✅ Verificar que no sea el dummy profile
                            const match = this.faceMatcher.findBestMatch(det.descriptor);
                            let label = "Desconocido";
                            
                            if (match.label !== '__DUMMY__' && match.distance < this.threshold) {
                                label = match.label;
                            }

                            const track = this._applyTracking(det);

                            this._applyPersonLogic(track, label, room);

                            if (onDetect) onDetect(label, room, vid);

                            this._drawTracked(canvas, track, label);
                        }

                    } catch (e) {
                        if (frameCount % 100 === 0) {
                            console.warn("⚠️ Error frame:", e.message);
                        }
                    }
                }

                await this._sleep(40);
            }
            
            console.log("🛑 Loop detenido");
        };

        loop();
    }

    stopDetection() {
        console.log("🛑 Deteniendo detección...");
        this.detecting = false;
        this.tracked = [];
        this.peopleLastSeen = {};
        this.activeAlerts = {};
        this.knownPeople = new Set();
        this.unconfirmedUnknownFrames = 0;
        this.personLastRoom = {};
        console.log("✅ Detección detenida");
    }

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
            unknownFrames: 0,
            unknownShown: false,
            hasLeft: false,
        };

        this.tracked.push(newT);
        return newT;
    }

    _applyPersonLogic(track, label, room) {
        const useWS = localStorage.getItem("useWebSocket") === "true";

        if (!useWS) {
            this.updateTrackedPersonDetection(track, label);
            return;
        }

        this.updateTrackedPersonDetection(track, label);

        if (label !== "Desconocido") {
            this.updatePersonLocation(label, room);
        }

        this.checkAllGone();
    }

    updateTrackedPersonDetection(track, label) {
        const now = Date.now();

        // BLOQUEAR CAMBIO DE IDENTIDAD EN MISMA POSICIÓN
        if (
            track.lastLabel !== "Desconocido" &&
            label !== "Desconocido" &&
            track.lastLabel !== label &&
            track.stabilityFrames < this.STABLE_FRAMES
        ) {
            // Mantener identidad anterior
            label = track.lastLabel;
        }
        // ACTUALIZAR ESTABILIDAD

        if (label !== "Desconocido") {
            track.unknownFrames = 0;
            track.unknownShown = false;
            track.lastLabel = label;
            track.lastSeen = now;

            if (!this.peopleState[label]) {
                this.peopleState[label] = { present: false, lastSeen: 0 };
            }       

            if (!this.peopleState[label].present) {
                this.peopleState[label].present = true;
                this.onNotification(`${label} ha entrado`, "success");
            }

            this.peopleState[label].lastSeen = now;


            return;
        }

        if (label === track.lastLabel) {
            track.stabilityFrames++;
        } else {
            track.stabilityFrames = 1;
        }

        track.lastSeen = now;

        if (track.stabilityFrames >= this.STABLE_FRAMES) {
            track.lastLabel = label;
        }

        if (track.unknownFrames >= this.confirmUnknownAfter && !track.unknownShown) {
            track.unknownShown = true;
            this.onNotification(`Desconocido detectado`, "warning");
        }
    }

    updatePersonLocation(name, room) {
        if (!this.personLastRoom[name]) {
            this.personLastRoom[name] = room;
            this._sendLocationUpdate(name, room);
            return;
        }

        if (this.personLastRoom[name] !== room) {
            this.onNotification(`${name} se movió a ${room}`, "info");
            this.personLastRoom[name] = room;
            this._sendLocationUpdate(name, room);
        }
    }

    async _sendLocationUpdate(name, room) {
        const useWS = localStorage.getItem("useWebSocket") === "true";
        if (!useWS) return;
        
        const profile_id = this.profileMap[name];
        if (!profile_id) return;

        try {
            await fetch('https://thefindoraprototipe.onrender.com/api/update_location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_id, last_room: room })
            });
        } catch (error) {
            console.warn("⚠️ Error actualizando ubicación:", error.message);
        }
    }

    checkAllGone() {
        const now = Date.now();

        for (const t of this.tracked) {
            if (t.hasLeft) continue;

            if (now - t.lastSeen > this.ALERT_TIMEOUT) {
                t.hasLeft = true;
                const name = t.lastLabel;

            if (this.peopleState[name]) {
                this.peopleState[name].present = false;
            }

            this.onNotification(`${name} salió`, "warning");

            }
        }

        this.tracked = this.tracked.filter(t => !t.hasLeft);
    }

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

    _sleep(ms) { 
        return new Promise(r => setTimeout(r, ms)); 
    }
}