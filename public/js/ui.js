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
      onNotification: (msg, type) => this._showOnce(msg, type)
    });

    // bind
    this._onStartClick = this._onStartClick.bind(this);


    this.personState = {};
    this.lastNotify = {};

    const canvas = this.getCanvasForVideo(vid);
    const ctx = canvas.getContext('2d');




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

  getCanvasForVideo(vid) {
    if (vid.id.startsWith("remote-")) {
        const id = vid.id.replace("remote-", "");
        return window.ui.webrtc.remoteCanvas[id];
    }
    return window.ui.canvas; // local canvas
}


  createVideoCanvasPair(id, stream) {
    const container = document.getElementById('container');

    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';

    const video = document.createElement('video');
    video.id = 'video-' + id;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';

    const canvas = document.createElement('canvas');
    canvas.id = 'canvas-' + id;
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';

    wrapper.appendChild(video);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    return { video, canvas };
}


  _showOnce(msg, type = "success", delay = 2500) {
    const now = Date.now();

    if (this.lastNotify[msg] && (now - this.lastNotify[msg] < delay))
        return; // Ignorar mensajes repetidos

    this.lastNotify[msg] = now;
    this.notifier.show(msg, type);
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

    this.currentSelectedVideo = rv;
    this.currentSelectedCanvas = this.webrtc.remoteCanvas[sid];


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
        this.faceRec.startMultiDetection({
    videos: this.videos,
    getRoomByVideo: this.getRoomByVideo,
    onDetect: (name, sala) => {
        this._onDetect(name, sala);
    }
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
    this._showOnce("Error activando cámara local: " + err.message, "warning");
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
    const now = Date.now();

    if (!this.personState[name]) {
        // Primera vez que aparece esta persona
        this.personState[name] = { room: sala, lastSeen: now };

        this._showOnce(`${name} está en ${sala}`, "success");
        return;
    }

    const person = this.personState[name];

    // Si cambió de sala → Notificación de transición
    if (person.room !== sala) {
        this._showOnce(
            `${name} salió de ${person.room} y entró a ${sala}`,
            "success"
        );
        person.room = sala;
    }

    // Actualizar último visto (para detectar que DESAPARECE)
    person.lastSeen = now;
}

});

    // Cada frame revisamos quién desapareció de cada sala
setInterval(() => {
    const now = Date.now();

    for (const name in this.personState) {
        const person = this.personState[name];

        // Si no lo han visto en 1 segundo → salió de la cámara
        if (now - person.lastSeen > 1000) {
            this._showOnce(`${name} salió de ${person.room}`, "warning");
            delete this.personState[name];
        }
    }
}, 300);


    this.startBtn.disabled = true;
    this.stopBtn.disabled = false;
}

  // -------------------------
  // Remote feed handling (callback from WebRTCManager)
  // -------------------------
  _onRemoteFeed(senderId, stream) {
    const { video, canvas } = this.createVideoCanvasPair(senderId, stream);
this.webrtc.remoteVideos[senderId] = video;
this.webrtc.remoteCanvas[senderId] = canvas;

  }

}
