// ui.js (nuevo) - Grid automático, canvas por video, detección automática
import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';

export default class UIManager {
  constructor({ wsUrl = 'https://thefindoraprototipe.onrender.com/ws', modelPath = '/models' } = {}) {
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

    // videos / canvases
    this.videos = [];
    this.localVideo = null;
    this.localCanvas = null;

    // managers
    this.notifier = new NotificationManager();
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
    this.lastNotify[msg] = now;
    this.notifier.show(msg, type);
  }

  // -------------------------
  // Profile thumbnails (label -> first image)
  // -------------------------
  async _loadProfileThumbs() {
    try {
      const res = await fetch('/api/profiles_full');
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
    video.onloadedmetadata = () => {
      console.log(`Video ${id} ready`);
    };

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
      // Obtener todas las cámaras disponibles
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
  _onPersonDetected(name, room) {
    if (!name || name === 'Desconocido') return;

    // Update person state
    this.personState[name] = {
      name,
      room,
      lastSeen: Date.now(),
      thumbnail: this.profileThumbs[name] || null
    };

    // Add to remote list if not already there
    this._addToList(name);

    // Show notification
    this._showOnce(`✓ ${name} detectado en ${room}`, 'success');
  }

  // -------------------------
  // Add person to detected list
  // -------------------------
  _addToList(name) {
    if (!this.remoteList) return;

    const existing = document.getElementById(`person-${name}`);
    if (existing) return; // Ya existe

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

  // -------------------------
  // Remove person from detected list
  // -------------------------
  _removeFromList(name) {
    const item = document.getElementById(`person-${name}`);
    if (item) item.remove();
  }
}