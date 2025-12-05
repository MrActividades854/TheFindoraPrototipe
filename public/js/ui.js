// ui.js (nuevo) - Grid automático, canvas por video, detección automática
import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';
import { CONFIG } from './config.js';

export default class UIManager {
  // en ui.js, constructor
constructor({ wsUrl = 'https://thefindoraprototipe.onrender.com/ws', modelPath = '/models', notificationsMode = 'live' } = {}) {
  // DOM
  this.container = document.getElementById('container');
  this.remoteList = document.getElementById('remoteList');
  this.statusEl = document.getElementById('status') || { textContent: '' };
  this.camNameEl = document.getElementById('camName');
  this.thresholdInput = document.getElementById('threshold');
  this.thVal = document.getElementById('thVal');

  // config/state
  this.wsUrl = wsUrl;
  this.modelPath = modelPath;
  this.notificationsMode = notificationsMode;

  // videos / canvases
  this.videos = [];
  this.localVideo = null;
  this.localCanvas = null;

  // managers will be created in init()
  this.notifier = null;
  this.personState = {};
  this.lastNotify = {};
  this.profileThumbs = {};

  // webRTC + faceRec (created in init)
  this.webrtc = null;
  this.faceRec = null;

  // ✅ NO HAGAS BINDING AQUÍ - hacerlo en init()
}


  // -------------------------
  // Initialization
  // -------------------------
  async init() {
    try {
      // ✅ HACER BINDING AQUÍ
      this.n
      this._onRemoteFeed = this._onRemoteFeed.bind(this);
      this._onPersonDetected = this._onPersonDetected.bind(this);
      this._resizeCanvasToVideoElement = this._resizeCanvasToVideoElement.bind(this);

      this.statusEl.textContent = 'Cargando modelos...';


      this.faceRec = new FaceRecognitionManager({
        modelPath: this.modelPath,
        getActiveVideo: () => this.getActiveVideo(),
        onNotification: (msg, type) => this._showOnce(msg, type)
      });

      this.faceRec.getCanvasForVideo = (vid) => vid ? vid._canvas || null : null;

      await this.faceRec.loadModels();

      this.statusEl.textContent = 'Cargando perfiles...';
      await this.faceRec.loadProfilesFromServer();

      await this._loadProfileThumbs();

      this.statusEl.textContent = 'Conectando señalización (WebSocket)...';
      this.webrtc = new WebRTCManager({
        wsUrl: this.wsUrl,
        onRemoteFeed: this._onRemoteFeed,
        onLog: (m) => this._log(m)
      });

      await this.webrtc.init();
      await this._loadCameras();
      await this._createLocalCamera();

      // ✅ INICIAR DETECCIÓN DIRECTAMENTE (sin Worker)
      this.detecting = true;
      this._startAutoDetection();

      this.statusEl.textContent = '✅ Listo';

      if (this.thresholdInput) {
        this.thresholdInput.addEventListener('input', () => {
          const v = parseFloat(this.thresholdInput.value);
          this.faceRec.setThreshold(v);
          if (this.thVal) this.thVal.textContent = v.toFixed(2);
        });
      }

      window.ui = this;
      window.webrtc = this.webrtc;

      // iniciar monitor de presencia después de iniciar detección
      this._startPresenceMonitor();

      // limpiar al cerrar
      window.addEventListener('beforeunload', () => {
        if (this._presenceInterval) clearInterval(this._presenceInterval);
      });
    } catch (err) {
      console.error(err);
      this.statusEl.textContent = 'Error inicializando: ' + (err.message || err);
    }
  }

  // -------------------------
  // Helpers
  // -------------------------
  _log(msg) {
    console.log('[UI]', msg);
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  _showOnce(msg, type = "success", delay = 2500) {
    const now = Date.now();
    if (this.lastNotify[msg] && (now - this.lastNotify[msg] < delay)) return;

    // Forzar notificación incluso si la sección de notificaciones está visible
    this.lastNotify[msg] = now;
    this.notifier.show(msg, type);
  }

  // -------------------------
  // Profile thumbnails (label -> first image)
  // -------------------------
  async _loadProfileThumbs() {
    try {
      const res = await fetch(`${CONFIG.API_BASE}/api/profiles_full`);
      console.log('Cargando miniaturas de perfiles desde', `${CONFIG.API_BASE}/api/profiles_full`);
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

  // -------------------------
  // Camera enumeration
  // -------------------------
  async _loadCameras() {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter(d => d.kind === 'videoinput');
    } catch (err) {
      console.warn('Error listando cámaras', err);
    }
  }

  // -------------------------
  // Create video+canvas pair and add to DOM
  // -------------------------
  createVideoCanvasPair(id, stream, opts = {}) {
    // ✅ EVITAR SI NO EXISTE CONTENEDOR
    if (!this.container) {
      console.warn(`No hay contenedor #container, saltando video ${id}`);
      return { video: null, canvas: null };
    }

    // ✅ EVITAR DUPLICADOS
    const existing = document.getElementById(id);
    if (existing) {
      console.warn(`Feed ${id} ya existe, no creando duplicado`);
      return { video: existing, canvas: document.getElementById(`${id}-canvas`) };
    }

    // wrapper grid item
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'feed';

    // video
    const video = document.createElement('video');
    video.id = `${id}-video`;
    video.srcObject = stream;
    video.dataset.feedId = id;
    video.muted = opts.muted ?? false;
    video.playsinline = true;
    video.autoplay = true;

    // canvas
    const canvas = document.createElement('canvas');
    canvas.id = `${id}-canvas`;
    canvas.className = 'feed-canvas';

    // overlay container (video + canvas)
    const frame = document.createElement('div');
    frame.className = 'feed-frame';
    frame.appendChild(video);

    // absolutely position canvas on top
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    wrapper.appendChild(frame);
    wrapper.appendChild(canvas);

    // insert into grid container
    this.container.appendChild(wrapper);

    // assign references
    video._canvas = canvas;
    this.videos.push(video);

    return { video, canvas };
  }

  // -------------------------
  // Handle local camera creation
  // -------------------------
  async _createLocalCamera() {
    try {
      // ✅ SALTAR SI NO HAY CONTENEDOR
      if (!this.container) {
        console.warn('No hay contenedor, saltando creación de cámaras locales');
        return;
      }

      const devices = this.videoDevices || [];
      const videoCameras = devices.filter(d => d.kind === 'videoinput');

      if (videoCameras.length === 0) {
        console.warn('No hay cámaras disponibles');
        return;
      }

      // Crear primer feed local
      const stream1 = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoCameras[0].deviceId },
        audio: false
      });
      const { video: video1 } = this.createVideoCanvasPair('local-1', stream1, { muted: true });
      this.localVideo = video1;

      // Crear segundo feed local si hay 2 o más cámaras
      if (videoCameras.length > 1) {
        const stream2 = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: videoCameras[1].deviceId },
          audio: false
        });
        this.createVideoCanvasPair('local-2', stream2, { muted: true });
      }

      this._log('Cámaras locales creadas.');
    } catch (e) {
      console.error('Error creando cámaras locales', e);
    }
  }

  // -------------------------
  // Remote feed handler (called by WebRTCManager)
  // -------------------------
  _onRemoteFeed(senderId, stream) {
    try {
      // if we already have this feed, replace stream
      const existing = this.videos.find(v => v.dataset.feedId === senderId);
      if (existing) {
        existing.srcObject = stream;
        this._resizeCanvasToVideoElement(existing);
        return;
      }

      const { video, canvas } = this.createVideoCanvasPair(senderId, stream, { muted: false });

      // keep quick access in webrtc maps as earlier code expected
      this.webrtc.remoteVideos = this.webrtc.remoteVideos || {};
      this.webrtc.remoteCanvas = this.webrtc.remoteCanvas || {};
      this.webrtc.remoteVideos[senderId] = video;
      this.webrtc.remoteCanvas[senderId] = canvas;

      this._log('Feed remoto agregado: ' + senderId);
    } catch (e) {
      console.error('Error manejando remote feed', e);
    }
  }

  // -------------------------
  // Resize canvas to match video element
  // -------------------------
  _resizeCanvasToVideoElement(vid) {
    if (!vid) return;
    if (!vid.videoWidth || !vid.videoHeight) {
      setTimeout(() => this._resizeCanvasToVideoElement(vid), 50);
      return;
    }
    const canvas = vid._canvas;
    if (!canvas) return;

    // set canvas native size (not CSS)
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;

    faceapi.matchDimensions(canvas, { width: vid.videoWidth, height: vid.videoHeight });
  }

  // Espera hasta que el video tenga dimensiones nativas (videoWidth/videoHeight)
_waitForVideoReady(video, timeout = 3000) {
  return new Promise((resolve) => {
    if (!video) return resolve(false);
    if (video.videoWidth && video.videoHeight) return resolve(true);

    const onMeta = () => {
      video.removeEventListener('loadedmetadata', onMeta);
      resolve(true);
    };

    video.addEventListener('loadedmetadata', onMeta);

    // fallback timeout
    setTimeout(() => {
      video.removeEventListener('loadedmetadata', onMeta);
      resolve(!!(video.videoWidth && video.videoHeight));
    }, timeout);
  });
}


  // -------------------------
  // getActiveVideo used by faceRec if needed
  // -------------------------
  getActiveVideo() {
    return this.localVideo || (this.videos.length ? this.videos[0] : null);
  }

  // -------------------------
  // Start automatic multiperson detection
  // -------------------------
async _startAutoDetection() {
  try {
    const readyPromises = this.videos.map(v => this._waitForVideoReady(v));
    await Promise.all(readyPromises);

    this.videos.forEach(v => this._resizeCanvasToVideoElement(v));

    const vids = this.videos.slice();

    // ✅ INICIAR DETECCIÓN SOLO UNA VEZ
    this.faceRec.startMultiDetection({
      videos: vids,
      getRoomByVideo: (vid) => {
        // ✅ Verificar que vid existe y tiene feedId
        if (!vid || !vid.dataset) return 'unknown';
        return vid.dataset.feedId && vid.dataset.feedId.includes('local') ? 'local' : 'remote';
      },
      onDetect: (name, room, vid) => this._onPersonDetected(name, room)
    });

  } catch (e) {
    console.error('Error iniciando detección automática', e);
  }
}

  // -------------------------
  // Handle person detected
  // -------------------------
  _onPersonDetected(name, room, vid) {
    if (!name) return;

    const now = Date.now();

    // throttle notificaciones por persona (2s)
    const last = this.lastNotify?.[name] || 0;
    if (!this.lastNotify) this.lastNotify = {};
    if (now - last < 2000) {
      // solo actualizar última vez vista
      if (this.personState[name]) this.personState[name].lastSeen = now;
      return;
    }

    const prev = this.personState[name];
    if (!prev) {
      // nueva entrada
      this.personState[name] = { name, room, lastSeen: now };
      this._addToList(name);
      // Notificación y registro (NotificationManager guarda timestamp en local/server)
      this.notifier.show(`${name} entró en ${room} — ${new Date(now).toLocaleString()}`, 'success', 4000);
      this.lastNotify[name] = now;
    } else {
      // ya estaba, actualizar lastSeen y cambio de sala
      prev.lastSeen = now;
      if (prev.room !== room) {
        this.notifier.show(`${name} cambió a ${room} — ${new Date(now).toLocaleString()}`, 'info', 3500);
        prev.room = room;
        this.lastNotify[name] = now;
      }
    }
  }

  // monitor que detecta salidas (no en cámara por >3s)
  _startPresenceMonitor() {
    const TIMEOUT_MS = 3000;
    this._presenceInterval = setInterval(() => {
      const now = Date.now();
      for (const name of Object.keys(this.personState)) {
        const p = this.personState[name];
        if (!p) continue;
        if (now - p.lastSeen > TIMEOUT_MS) {
          // persona se fue
          this.notifier.show(`${name} salió de ${p.room} — ${new Date(now).toLocaleString()}`, 'warning', 4000);
          this._removeFromList(name);
          delete this.personState[name];
          // actualizar throttle para evitar doble notificación rápida al reentrar
          this.lastNotify[name] = now;
        }
      }
    }, 1000);
  }

  // helpers para añadir/quitar miniaturas (si no existen ya)
  _addToList(name) {
    if (!this.remoteList) return;
    if (document.getElementById(`person-${name}`)) return;

    const item = document.createElement('div');
    item.id = `person-${name}`;
    item.className = 'detected-item';

    const thumb = document.createElement('img');
    thumb.className = 'detected-thumb';
    thumb.src = this.profileThumbs[name] || '/default-avatar.png';
    thumb.alt = name;

    const nameEl = document.createElement('div');
    nameEl.className = 'detected-name';
    nameEl.textContent = name;

    item.appendChild(thumb);
    item.appendChild(nameEl);
    this.remoteList.appendChild(item);
  }

  _removeFromList(name) {
    const el = document.getElementById(`person-${name}`);
    if (el) el.remove();
  }

  // Method to detect faces for background use
  async detectFaces() {
    if (!this.faceRec || !this.faceRec.faceMatcher) return [];

    const vid = this.getActiveVideo();
    if (!vid || vid.readyState < 2) return [];

    try {
      const detections = await faceapi
        .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      const results = [];
      for (const det of detections) {
        const bestMatch = this.faceRec.faceMatcher.findBestMatch(det.descriptor);
        const label = bestMatch.distance < this.faceRec.threshold ? bestMatch.label : "Desconocido";
        results.push({ label, detection: det });
      }
      return results;
    } catch (e) {
      console.error('Error in detectFaces:', e);
      return [];
    }
  }
}
