// ui.js
// UI manager completo — integra WebRTCManager y FaceRecognitionManager
// Incluye: notificaciones, referencias, start/stop, thumbnails remotos, etc.

import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';


export default class UIManager {
  constructor({ wsUrl = 'https://thefindoraprototipe.onrender.com/ws', modelPath = '/models' } = {}) {
    // DOM
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('overlay');
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = document.getElementById('status');

    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.prevCamBtn = document.getElementById('prevCamBtn');
    this.nextCamBtn = document.getElementById('nextCamBtn');
    this.camNameEl = document.getElementById('camName');

    this.remoteList = document.getElementById('remoteList');
    this.toggleDebugBtn = document.getElementById('toggleDebugBtn');
    this.thresholdInput = document.getElementById('threshold');
    this.thVal = document.getElementById('thVal');

    // config/state
    this.wsUrl = wsUrl;
    this.modelPath = modelPath;
    this.videoDevices = [];
    this.currentCamIndex = 0;
    this.stream = null;

    this.getActiveRoom = this.getActiveRoom.bind(this);

    this.currentSelectedVideo = this.video; // al iniciar, la cámara local

    this.notifier = new NotificationManager();

    // instances
    this.webrtc = new WebRTCManager({
      wsUrl: this.wsUrl,
      onRemoteFeed: (id, stream) => this._onRemoteFeed(id, stream),
      onLog: (m) => this._log(m)
    });

    this.faceRec = new FaceRecognitionManager({
      modelPath: this.modelPath,
      getActiveVideo: () => this.getActiveVideo(),
      onNotification: (msg, type) => this.notifier.show(msg, type)
    });

    // bind
    this._onStartClick = this._onStartClick.bind(this);


    this.lastDetectedRoom = null;
    this.currentPerson = null;


  }



  // -------------------------
  // Initialization
  // -------------------------
  async init() {
    try {
      this.statusEl.textContent = 'Cargando modelos...';
      await this.faceRec.loadModels();

      this.statusEl.textContent = 'Cargando perfiles...';
await this.faceRec.loadProfilesFromServer();

      this.statusEl.textContent = 'Conectando señalización (WebSocket)...';
      await this.webrtc.init();

      // load cameras
      await this._loadCameras();

      // bind ui handlers
      this._bindUI();

      // pick first camera (important)
      await this.switchCamera(0);

      window.ui = this;



      this.statusEl.textContent = '✅ Listo';
    } catch (err) {
      console.error(err);
      this.statusEl.textContent = 'Error inicializando: ' + (err.message || err);
    }



  }

  async loadProfilesFromServer() {
    console.log("[FaceRec] Cargando perfiles desde API…");

    // 1. Obtener la lista completa de perfiles
    const res = await fetch("/api/profiles_full");
    const profiles = await res.json();

    this.labeledDescriptors = [];

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
            } catch (e) {
                console.warn("Error cargando imagen:", imgUrl, e);
            }
        }

        if (descriptors.length > 0) {
            this.labeledDescriptors.push(
                new faceapi.LabeledFaceDescriptors(p.name, descriptors)
            );
        }
    }

    console.log("[FaceRec] Perfiles cargados:", this.labeledDescriptors.length);
    this.updateMatcher();
}


  // -------------------------
  // Logging & Notifications
  // -------------------------
  _log(msg) {
    console.log('[UI]', msg);
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  // -------------------------
  // Cameras
  // -------------------------
  async _loadCameras() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }));

      // include remote placeholders
      for (const sid in this.webrtc.remoteVideos) {
        if (!this.videoDevices.some(v => v.deviceId === `remote-${sid}`)) {
          this.videoDevices.push({ deviceId: `remote-${sid}`, label: `Cámara remota ${sid}` });
        }
      }

      if (!this.videoDevices.length) this._log('❌ No se detectaron cámaras');
      this.currentCamIndex = 0;
      this._updateCamName();
    } catch (err) {
      console.error('Error listando cámaras', err);
      this._log('Error listando cámaras: ' + err.message);
    }
  }

  _updateCamName() {
    const cam = this.videoDevices[this.currentCamIndex];
    this.camNameEl.textContent = cam ? `🎥 ${cam.label} (${this.currentCamIndex + 1} de ${this.videoDevices.length})` : '–';
  }

  async switchCamera(delta = 0) {
    if (!this.videoDevices.length) return;

    this.currentCamIndex = (this.currentCamIndex + delta + this.videoDevices.length) % this.videoDevices.length;
    this._updateCamName();

    const selected = this.videoDevices[this.currentCamIndex];
    if (!selected) return;

    // =============================
// CAMARA REMOTA - ARREGLADO
// =============================
if (selected.deviceId.startsWith('remote-')) {

    const sid = selected.deviceId.replace('remote-', '');
    const rv = this.webrtc.remoteVideos[sid];

    if (!rv || !rv.srcObject) {
        this._notifier.show('⚠️ Feed remoto no disponible (aún).', 'warning');
        return;
    }

    console.log("[UI] Mostrando cámara remota arriba:", sid);

    // Mostrar feed remoto EN EL VIDEO PRINCIPAL
    this.video.srcObject = rv.srcObject;

    // Mostrar el video local como oculto
    this.video.style.display = "block";

    // Mantener los videos remotos en el DOM para que WebRTC no los desconecte
    Object.values(this.webrtc.remoteVideos).forEach(v => {
    v.style.visibility = "hidden";   // que no molesten visualmente
    v.style.pointerEvents = "none";  // que no se puedan presionar
    v.style.position = "absolute";   // que no ocupen espacio
    v.style.width = "1px";
    v.style.height = "1px";
});
;

    // Asegurar reproducción
    this.video.play().catch(err => console.error("Error playing remote:", err));

this.video.onloadedmetadata = () => {
    this._resizeCanvasToVideoElement(this.video);

    if (this.faceRec.detecting) {
        this.faceRec.startDetection({
            canvasCtx: this.ctx,
            resizeCanvasToVideoElement: (v) => this._resizeCanvasToVideoElement(v),
            getActiveVideo: () => this.getActiveVideo()
        });
    }
};


    return;
}


    Object.values(this.webrtc.remoteVideos).forEach(v => v.style.display = 'none');

    // local
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
try {
    let id = selected.deviceId;

    // Si el deviceId está vacío o no existe → usar modo compatible
    if (!id || id === "" || id === "undefined" || id === undefined) {
        console.warn("⚠ deviceId inválido, activando modo compatible");
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
    } else {
        try {
            // Intento 1: usar el ID exacto
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: id } },
                audio: false
            });
        } catch (err1) {
            console.warn("⚠ deviceId exacto falló, reintentando modo compatible", err1);

            // Intento 2: fallback
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
        }
    }

    this.video.srcObject = this.stream;

    // Ocultar remotas
    Object.values(this.webrtc.remoteVideos).forEach(v => v.style.display = "none");
    this.video.style.display = "block";

    await this.video.play();
    this._resizeCanvasToVideoElement(this.video);

} catch (err) {
    console.error("Error activando cámara local:", err);
    this.notifier.show("Error activando cámara local: " + err.message, "warning");
}

this.currentSelectedVideo = this.getActiveVideo();

  }

  getActiveVideo() {
    const selected = this.videoDevices[this.currentCamIndex];
    if (selected && selected.deviceId && selected.deviceId.startsWith('remote-')) {
      const sid = selected.deviceId.replace('remote-', '');
      return this.webrtc.remoteVideos[sid] || this.video;
    }
    return this.video;
  }

  getActiveRoom() {
    const selected = this.videoDevices[this.currentCamIndex];

    if (!selected) return "sala1";

    if (selected.deviceId.startsWith("remote-"))
        return "sala2";

    return "sala1";
}


_resizeCanvasToVideoElement(vid) {
    if (!vid) return;

    // esperar a que tenga dimensiones reales
    if (!vid.videoWidth || !vid.videoHeight) {
        setTimeout(() => this._resizeCanvasToVideoElement(vid), 50);
        return;
    }

    this.canvas.width = vid.videoWidth;
    this.canvas.height = vid.videoHeight;
}


  // -------------------------
  // UI Binding
  // -------------------------
  _bindUI() {
    // start/stop
    this.startBtn.addEventListener('click', this._onStartClick);
    this.stopBtn.addEventListener('click', () => {
      this.faceRec.stopDetection();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
    });

    // prev/next
    this.prevCamBtn.addEventListener('click', () => this.switchCamera(-1));
    this.nextCamBtn.addEventListener('click', () => this.switchCamera(1));

    // debug toggle
    this.toggleDebugBtn.addEventListener('click', () => {
      this.faceRec.showDebugPoint = !this.faceRec.showDebugPoint;
      this.toggleDebugBtn.textContent = this.faceRec.showDebugPoint ? '⚪ Ocultar punto rojo' : '🔴 Mostrar punto rojo';
    });

    // threshold
    this.thresholdInput.addEventListener('input', () => {
      this.faceRec.setThreshold(this.thresholdInput.value);
      this.thVal.textContent = this.thresholdInput.value;
    });

  }

  // -------------------------
  // Start detection (button handler)
  // -------------------------
  async _onStartClick() {
    const vids = [
        this.video,                         // siempre cámara local
        ...Object.values(this.webrtc.remoteVideos)  // todas las remotas
    ];

    this.faceRec.startMultiDetection({
        videos: vids,
        getRoomByVideo: (vid) => {
            if (vid === this.video) return "sala1";
            return "sala2"; // puedes expandir si hay más salas
        },
        onDetect: (name, sala) => {
            if (this.currentPerson !== name || this.lastDetectedRoom !== sala) {
                if (this.lastDetectedRoom && this.lastDetectedRoom !== sala) {
                    this.notifier.show(`${name} salió de ${this.lastDetectedRoom} y entró a ${sala}`, "success");
                } else {
                    this.notifier.show(`${name} está en ${sala}`, "success");
                }

                this.currentPerson = name;
                this.lastDetectedRoom = sala;
            }
        }
    });

    this.startBtn.disabled = true;
    this.stopBtn.disabled = false;
}

  // -------------------------
  // Remote feed handling (callback from WebRTCManager)
  // -------------------------
  _onRemoteFeed(senderId, stream) {
    // ensure an element exists or create one
    let videoEl = this.webrtc.remoteVideos[senderId];
    if (!videoEl) {
      videoEl = document.createElement('video');
videoEl.autoplay = true;
videoEl.muted = true;
videoEl.playsInline = true;
videoEl.className = 'remote-video';
videoEl.id = `remote-${senderId}`;

const container = document.getElementById('container');
container.appendChild(videoEl);

videoEl.style.position = 'absolute';
videoEl.style.top = '0';
videoEl.style.left = '0';
videoEl.style.width = '100%';
videoEl.style.height = '100%';
videoEl.style.objectFit = 'cover';
videoEl.style.display = 'none'; // se mostrará al seleccionarlo
videoEl.style.zIndex = '1';

      this.webrtc.remoteVideos[senderId] = videoEl;
    }
    videoEl.srcObject = stream;

    videoEl.onloadedmetadata = () => {
  videoEl.play().catch(err => console.error("Error play remoto:", err));
};


    // thumbnail
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb';
    thumbWrap.style.display = 'flex';
    thumbWrap.style.flexDirection = 'column';
    thumbWrap.style.alignItems = 'center';
    thumbWrap.style.gap = '6px';

    const thumb = document.createElement('video');
    thumb.autoplay = true;
    thumb.muted = true;
    thumb.playsInline = true;
    thumb.width = 160;
    thumb.height = 90;
    thumb.srcObject = stream;
    thumb.style.borderRadius = '8px';

    const label = document.createElement('div');
    label.textContent = `Remoto ${senderId}`;
    label.style.color = '#fff';
    label.style.fontSize = '13px';

    thumbWrap.appendChild(thumb);
    thumbWrap.appendChild(label);

    thumbWrap.onclick = async () => {
      if (!this.videoDevices.some(v => v.deviceId === `remote-${senderId}`)) {
        this.videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}` });
      }
      // set index and switch
      const idx = this.videoDevices.findIndex(v => v.deviceId === `remote-${senderId}`);
      if (idx >= 0) {
        this.currentCamIndex = idx;
        await this.switchCamera(0);
      }
    };

    this.remoteList.appendChild(thumbWrap);

    // ensure videoDevices list contains it
    if (!this.videoDevices.some(v => v.deviceId === `remote-${senderId}`)) {
      this.videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}` });
      this._updateCamName();
    }
  }

}
