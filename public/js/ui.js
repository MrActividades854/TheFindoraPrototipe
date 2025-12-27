// ui.js — versión con debug extensivo

import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';
import { CONFIG } from './config.js';

window.addEventListener("beforeunload", () => uiManager.stop());

export default class UIManager {
    constructor({ wsUrl = CONFIG.WS_URL, modelPath = CONFIG.MODEL_PATH, notificationsMode = 'live' } = {}) {
        console.log("🏗️ UIManager constructor");
        console.log("  WS URL:", wsUrl);
        console.log("  Model Path:", modelPath);
        console.log("  Notifications Mode:", notificationsMode);

        this.container = document.getElementById('container');
        this.remoteList = document.getElementById('remoteList');
        this.statusEl = document.getElementById('status') || { textContent: '' };
        this.thresholdInput = document.getElementById('threshold');
        this.thVal = document.getElementById('thVal');

        this.wsUrl = wsUrl;
        this.modelPath = modelPath;
        this.notificationsMode = notificationsMode;

        this.videos = [];
        this.profileThumbs = {};

        this.notifier = null;
        this.webrtc = null;
        this.faceRec = null;

        this._onRemoteFeed = this._onRemoteFeed.bind(this);
        this._resizeCanvasToVideoElement = this._resizeCanvasToVideoElement.bind(this);
        
        console.log("✅ UIManager creado");
    }

    async init() {
        console.log("🚀 UIManager.init() - INICIANDO");
        
        try {
            this._updateStatus('🔧 Inicializando sistema...');
            console.log("=" .repeat(60));

            // 1. Notificaciones
            console.log("📢 Paso 1/7: Inicializando notificaciones");
            this._updateStatus('Configurando notificaciones...');
            this.notifier = new NotificationManager(
                'https://thefindoraprototipe.onrender.com/api/notifications', 
                this.notificationsMode
            );
            console.log("✅ Notificaciones listas");

            // 2. Face Recognition Manager
            console.log("🤖 Paso 2/7: Creando FaceRecognitionManager");
            this._updateStatus('Inicializando reconocimiento facial...');
            this.faceRec = new FaceRecognitionManager({
                modelPath: this.modelPath,
                onNotification: (msg, type) => {
                    console.log(`📢 Notificación: [${type}] ${msg}`);
                    this.notifier.show(msg, type);
                }
            });
            console.log("✅ FaceRecognitionManager creado");

            // 3. Cargar modelos
            console.log("📦 Paso 3/7: Cargando modelos de IA");
            this._updateStatus('⏳ Cargando modelos de IA...');
            await this.faceRec.loadModels();
            console.log("✅ Modelos cargados");

            // 4. Cargar perfiles
            console.log("👥 Paso 4/7: Cargando perfiles");
            this._updateStatus('⏳ Cargando perfiles...');
            await this.faceRec.loadProfilesFromServer();
            console.log("✅ Perfiles cargados");

            // 5. Thumbnails
            console.log("🖼️ Paso 5/7: Cargando miniaturas");
            this._updateStatus('Cargando miniaturas...');
            await this._loadProfileThumbs();
            console.log("✅ Miniaturas cargadas");

            // 6. Cámaras
            console.log("📹 Paso 6/7: Configurando cámaras");
            this._updateStatus('⏳ Conectando cámaras...');
            await this._loadCameras();
            await this._createLocalCameras();
            console.log(`✅ ${this.videos.length} cámara(s) configurada(s)`);

            // 7. WebRTC (opcional según config)
            console.log("🌐 Paso 7/7: Configurando WebRTC");
            this._updateStatus('Conectando señalización...');
            
            const useWS = localStorage.getItem("useWebSocket") === "true";
            console.log("  WebSocket habilitado:", useWS);
            
            if (useWS) {
                this.webrtc = new WebRTCManager({
                    wsUrl: this.wsUrl,
                    onRemoteFeed: this._onRemoteFeed,
                    onLog: m => this._log(m)
                });
                await this.webrtc.init();
                console.log("✅ WebRTC conectado");
            } else {
                console.log("⚠️ WebRTC deshabilitado (modo local)");
            }

            // 8. Iniciar detección
            console.log("🎬 Iniciando detección facial");
            this._updateStatus('⏳ Iniciando detección...');
            await this._startAutoDetection();
            console.log("✅ Detección activa");

            // 9. Threshold control
            if (this.thresholdInput) {
                this.thresholdInput.addEventListener('input', () => {
                    const v = parseFloat(this.thresholdInput.value);
                    this.faceRec.threshold = v;
                    if (this.thVal) this.thVal.textContent = v.toFixed(2);
                    console.log("🎚️ Umbral ajustado a:", v);
                });
            }

            this._updateStatus('✅ Sistema listo');
            console.log("=" .repeat(60));
            console.log("🎉 INICIALIZACIÓN COMPLETA");
            console.log("=" .repeat(60));

        } catch (err) {
            console.error("❌ ERROR CRÍTICO EN INIT:");
            console.error("Tipo:", err.constructor.name);
            console.error("Mensaje:", err.message);
            console.error("Stack:", err.stack);
            
            this._updateStatus('❌ Error: ' + err.message);
            throw err;
        }
    }

    _updateStatus(msg) {
        if (this.statusEl) {
            this.statusEl.textContent = msg;
        }
        console.log("📊 Status:", msg);
    }

    _log(msg) {
        console.log('[UI]', msg);
        this._updateStatus(msg);
    }

    async _loadProfileThumbs() {
        try {
            const res = await fetch(`https://thefindoraprototipe.onrender.com/api/profiles_full`);
            if (!res.ok) {
                console.warn("⚠️ No se pudieron cargar thumbnails");
                return;
            }

            const profiles = await res.json();
            console.log(`🖼️ Procesando ${profiles.length} thumbnails`);
            
            for (const p of profiles) {
                if (p.images && p.images.length) {
                    this.profileThumbs[this._normalizeName(p.name)] = p.images[0];
                }
            }
            
            console.log(`✅ ${Object.keys(this.profileThumbs).length} thumbnails cargados`);
        } catch (e) {
            console.warn('⚠️ Error cargando miniaturas:', e.message);
        }
    }

    async _loadCameras() {
        console.log("📹 Solicitando acceso a cámaras...");
        
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            console.log("✅ Permiso de cámara otorgado");
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            console.log(`📹 ${this.videoDevices.length} cámara(s) detectada(s):`);
            this.videoDevices.forEach((d, i) => {
                console.log(`  ${i + 1}. ${d.label || 'Cámara sin nombre'}`);
            });
            
        } catch (err) {
            console.error('❌ Error accediendo a cámaras:', err.message);
            this.videoDevices = [];
        }
    }

    async _createLocalCameras() {
        if (!this.container) {
            console.error("❌ Container no encontrado");
            return;
        }

        console.log(`🎥 Creando ${this.videoDevices.length} feed(s) de cámara local`);

        for (let i = 0; i < this.videoDevices.length; i++) {
            const device = this.videoDevices[i];
            const id = `local-${i + 1}`;
            
            console.log(`  Configurando ${id}: ${device.label}`);
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } },
                    audio: false
                });

                this._createVideoCanvasPair(id, stream, { muted: true });
                console.log(`  ✅ ${id} listo`);
                
            } catch (err) {
                console.error(`  ❌ Error configurando ${id}:`, err.message);
            }
        }
    }

    _createVideoCanvasPair(id, stream, opts = {}) {
        if (!this.container) return;

        if (document.getElementById(id)) {
            console.warn(`⚠️ Feed ${id} ya existe`);
            return;
        }

        console.log(`🎬 Creando feed: ${id}`);

        const wrapper = document.createElement('div');
        wrapper.className = 'feed';
        wrapper.id = id;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.dataset.feedId = id;
        video.autoplay = true;
        video.playsinline = true;
        video.muted = opts.muted ?? false;
        video.dataset.type = "local";

        const frame = document.createElement('div');
        frame.className = 'feed-frame';
        frame.appendChild(video);

        wrapper.appendChild(frame);
        this.container.appendChild(wrapper);

        wrapper.addEventListener('click', () => {
            localStorage.setItem('selectedFeed', video.dataset.feedId);
            const allIds = this.videos.map(v => v.dataset.feedId);
            localStorage.setItem('feedList', JSON.stringify(allIds));
            window.location.href = './findorasections/camera/camara.html';
        });

        this.videos.push(video);
        console.log(`✅ Feed ${id} agregado (total: ${this.videos.length})`);

        return { video };
    }

    _onRemoteFeed(senderId, stream) {
        console.log(`📡 Feed remoto recibido de: ${senderId}`);
        
        const existing = this.videos.find(v => v.dataset.feedId === senderId);

        if (existing) {
            console.log(`  Actualizando feed existente`);
            existing.srcObject = stream;
            return;
        }

        console.log(`  Creando nuevo feed remoto`);
        this._createVideoCanvasPair(senderId, stream, { muted: false });
    }

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

    async _startAutoDetection() {
        console.log("🎬 Preparando detección automática");
        console.log(`  Videos a procesar: ${this.videos.length}`);

        if (this.videos.length === 0) {
            console.warn("⚠️ No hay cámaras disponibles, no inicio detección");
            return;
        }

        console.log("⏳ Esperando que videos estén listos...");
        const readiness = this.videos.map(v => this._waitVideoReady(v));
        await Promise.all(readiness);
        console.log("✅ Todos los videos listos");

        console.log("📐 Ajustando dimensiones de canvas...");
        this.videos.forEach(v => this._resizeCanvasToVideoElement(v));

        console.log("🚀 Iniciando pipeline de detección");
        this.faceRec.startMultiDetection({
            videos: this.videos,
            getRoomByVideo: vid => {
                if (!vid) return 'unknown';
                return vid.dataset.feedId.includes('local') ? 'local' : 'remote';
            },
            onDetect: (name, room) => {
                if (name !== "Desconocido") {
                    this._updateList(name);
                }
            }
        });
        
        console.log("✅ Pipeline activo");
    }

    _normalizeName(name) {
        return name.trim().toLowerCase();
    }

    _updateList(name, room, video) {
        if (!this.remoteList) return;

        const normalized = name.trim().toLowerCase();

        let item = document.getElementById(`person-${normalized}`);

        if (!item) {
            item = document.createElement("div");
            item.id = `person-${normalized}`;
            item.className = "person-item";

            const img = document.createElement("img");
            img.className = "person-thumb";
            img.src = this.profileThumbs[normalized] || "/default-avatar.png";

            const label = document.createElement("span");
            label.textContent = name;

            item.appendChild(img);
            item.appendChild(label);

            this.remoteList.appendChild(item);
        }
    }

    stop() {
        console.log("🛑 Deteniendo UIManager");
        
        if (this.faceRec) {
            this.faceRec.stopDetection();
        }

        for (const v of this.videos) {
            if (v.srcObject) {
                v.srcObject.getTracks().forEach(t => t.stop());
            }
        }

        this.videos = [];
        console.log("✅ UIManager detenido");
    }
}