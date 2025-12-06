// ui.js — versión unificada, limpia y totalmente compatible con pipeline único

import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';
import { CONFIG } from './config.js';

window.addEventListener("beforeunload", () => uiManager.stop());


export default class UIManager {
    constructor({ wsUrl = CONFIG.WS_URL, modelPath = '/models', notificationsMode = 'live' } = {}) {

        // DOM
        this.container = document.getElementById('container');
        this.remoteList = document.getElementById('remoteList');
        this.statusEl = document.getElementById('status') || { textContent: '' };
        this.thresholdInput = document.getElementById('threshold');
        this.thVal = document.getElementById('thVal');

        // config/state
        this.wsUrl = wsUrl;
        this.modelPath = modelPath;
        this.notificationsMode = notificationsMode;

        // videos
        this.videos = [];
        this.profileThumbs = {};

        this.notifier = null;
        this.webrtc = null;
        this.faceRec = null;

        // bindings
        this._onRemoteFeed = this._onRemoteFeed.bind(this);
        this._resizeCanvasToVideoElement = this._resizeCanvasToVideoElement.bind(this);
    }

    // ---------------------------------------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------------------------------------
    async init() {
        try {
            this.statusEl.textContent = 'Cargando modelos...';

            this.notifier = new NotificationManager('/api/notifications', this.notificationsMode);

            // Face recognition system
            this.faceRec = new FaceRecognitionManager({
                modelPath: this.modelPath,
                onNotification: (msg, type) => this.notifier.show(msg, type)
            });


            await this.faceRec.loadModels();
            this.statusEl.textContent = 'Cargando perfiles...';
            await this.faceRec.loadProfilesFromServer();

            await this._loadProfileThumbs();

            // WebRTC
            this.statusEl.textContent = 'Conectando cámaras...';
            await this._loadCameras();
            await this._createLocalCameras();

            // WS + p2p
            this.statusEl.textContent = 'Conectando señalización...';
            this.webrtc = new WebRTCManager({
                wsUrl: this.wsUrl,
                onRemoteFeed: this._onRemoteFeed,
                onLog: m => this._log(m)
            });
            await this.webrtc.init();

            // detection
            this.statusEl.textContent = 'Iniciando detección...';
            await this._startAutoDetection();

            if (this.thresholdInput) {
                this.thresholdInput.addEventListener('input', () => {
                    const v = parseFloat(this.thresholdInput.value);
                    this.faceRec.threshold = v;
                    if (this.thVal) this.thVal.textContent = v.toFixed(2);
                });
            }

            this.statusEl.textContent = '✔ Listo';

        } catch (err) {
            console.error(err);
            this.statusEl.textContent = 'Error: ' + err.message;
        }
    }

    // ---------------------------------------------------------------------------------------------
    // UTILIDADES
    // ---------------------------------------------------------------------------------------------

    
    _log(msg) {
        console.log('[UI]', msg);
        if (this.statusEl) this.statusEl.textContent = msg;
    }

    async _loadProfileThumbs() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/api/profiles_full`);
            if (!res.ok) return;

            const profiles = await res.json();
            for (const p of profiles) {
                if (p.images && p.images.length) {
                    this.profileThumbs[p.name] = p.images[0];
                }
            }
        } catch (e) {
            console.warn('No se pudieron cargar miniaturas de perfiles', e);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // CÁMARAS
    // ---------------------------------------------------------------------------------------------
    async _loadCameras() {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(d => d.kind === 'videoinput');
        } catch (err) {
            console.warn('Error listando cámaras', err);
            this.videoDevices = [];
        }
    }

    async _createLocalCameras() {
        if (!this.container) return;

        for (let i = 0; i < this.videoDevices.length; i++) {

            const device = this.videoDevices[i];
            const id = `local-${i + 1}`;
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: device.deviceId } },
                audio: false
            });

            this._createVideoCanvasPair(id, stream, { muted: true });
        }
    }

    _createVideoCanvasPair(id, stream, opts = {}) {
        if (!this.container) return;

        if (document.getElementById(id)) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'feed';
        wrapper.id = id;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.dataset.feedId = id;
        video.autoplay = true;
        video.playsinline = true;
        video.muted = opts.muted ?? false;

        const canvas = document.createElement('canvas');
        canvas.className = 'feed-canvas';

        const frame = document.createElement('div');
        frame.className = 'feed-frame';
        frame.appendChild(video);

        canvas.style.position = 'absolute';
        canvas.style.top = 0;
        canvas.style.left = 0;

        wrapper.appendChild(frame);
        wrapper.appendChild(canvas);

        this.container.appendChild(wrapper);
        // --- CLICK: Abrir feed en camara.html ---
wrapper.addEventListener('click', () => {
    localStorage.setItem('selectedFeed', video.dataset.feedId);

    // Guardar la lista completa de feeds para navegar
    const allIds = this.videos.map(v => v.dataset.feedId);
    localStorage.setItem('feedList', JSON.stringify(allIds));

    window.location.href = 'camara.html';
});


        video._canvas = canvas;
        this.videos.push(video);

        return { video, canvas };
    }

    // ---------------------------------------------------------------------------------------------
    // REMOTE FEEDS
    // ---------------------------------------------------------------------------------------------
    _onRemoteFeed(senderId, stream) {
        const existing = this.videos.find(v => v.dataset.feedId === senderId);

        if (existing) {
            existing.srcObject = stream;
            return;
        }

        this._createVideoCanvasPair(senderId, stream, { muted: false });
    }

    // ---------------------------------------------------------------------------------------------
    // DIMENSIONES
    // ---------------------------------------------------------------------------------------------
    _resizeCanvasToVideoElement(vid) {
        if (!vid || !vid._canvas) return;

        if (!vid.videoWidth || !vid.videoHeight) {
            setTimeout(() => this._resizeCanvasToVideoElement(vid), 50);
            return;
        }

        const canvas = vid._canvas;
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
    }

    async _waitVideoReady(vid) {
        if (vid.videoWidth && vid.videoHeight) return true;

        return new Promise(resolve => {
            const f = () => {
                vid.removeEventListener('loadedmetadata', f);
                resolve(true);
            };
            vid.addEventListener('loadedmetadata', f);

            setTimeout(() => {
                vid.removeEventListener('loadedmetadata', f);
                resolve(true);
            }, 1500);
        });
    }

    // ---------------------------------------------------------------------------------------------
    // DETECCIÓN ÚNICA
    // ---------------------------------------------------------------------------------------------
    async _startAutoDetection() {
        const readiness = this.videos.map(v => this._waitVideoReady(v));
        await Promise.all(readiness);

        this.videos.forEach(v => this._resizeCanvasToVideoElement(v));

        if (this.videos.length === 0) {
    console.warn("No hay cámaras disponibles, no inicio detección.");
    return;
}

        this.faceRec.startMultiDetection({
            videos: this.videos,
            getRoomByVideo: vid => {
                if (!vid) return 'unknown';
                return vid.dataset.feedId.includes('local') ? 'local' : 'remote';
            },
            onDetect: (name, room) => {
                // UIManager ya NO decide; solo muestra
                // FaceRec se encarga de notificaciones
                if (name !== "Desconocido") this._updateList(name);
            }
        });
    }

    // ---------------------------------------------------------------------------------------------
    // LISTA DE DETECTADOS (SOLO UI, YA NO DECIDE LÓGICA)
    // ---------------------------------------------------------------------------------------------
    _updateList(name) {
        if (!this.remoteList) return;

        const id = `person-${name}`;
        if (document.getElementById(id)) return;

        const item = document.createElement('div');
        item.className = 'detected-item';
        item.id = id;

        const img = document.createElement('img');
        img.className = 'detected-thumb';
        img.src = this.profileThumbs[name] || '/default-avatar.png';

        const lbl = document.createElement('div');
        lbl.className = 'detected-name';
        lbl.textContent = name;

        const activeIds = new Set(trackedPeople.map(p => p.id));

Array.from(this.remoteList.children).forEach(node => {
    const id = node.dataset.personId;
    if (!activeIds.has(id)) {
        node.remove();
    }
});


        item.appendChild(img);
        item.appendChild(lbl);
        this.remoteList.appendChild(item);
    }

    stop() {
    // detener face recognition
    if (this.faceRec) this.faceRec.stopDetection();

    // detener cámaras locales
    for (const v of this.videos) {
        if (v.srcObject) {
            v.srcObject.getTracks().forEach(t => t.stop());
        }
    }

    this.videos = [];
}

}