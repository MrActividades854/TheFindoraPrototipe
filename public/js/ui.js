// ui.js (nuevo) - Grid automático, canvas por video, detección automática
import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';
import NotificationManager from './notifications.js';

export default class UIManager {
  constructor({ wsUrl = 'https://thefindoraprototipe.onrender.com/ws', modelPath = '/models' } = {}) {
    // DOM
    this.container = document.getElementById('container');
    this.remoteList = document.getElementById('remoteList');
    this.statusEl = document.getElementById('status');
    this.camNameEl = document.getElementById('camName');
    this.thresholdInput = document.getElementById('threshold');
    this.thVal = document.getElementById('thVal');

    // config/state
    this.wsUrl = wsUrl;
    this.modelPath = modelPath;

    // videos / canvases
    this.videos = [];            // array of video elements (local + remotes)
    this.localVideo = null;
    this.localCanvas = null;

    // managers
    this.notifier = new NotificationManager();
    this.personState = {};       // per-person state for notifications
    this.lastNotify = {};        // debounce map
    this.profileThumbs = {};     // label -> thumbnail URL (first image)

    // webRTC + faceRec (created in init)
    this.webrtc = null;
    this.faceRec = null;

    // binding
    this._onRemoteFeed = this._onRemoteFeed.bind(this);
    this._onPersonDetected = this._onPersonDetected.bind(this);
    this._resizeCanvasToVideoElement = this._resizeCanvasToVideoElement.bind(this);
  }

  // -------------------------
  // Initialization
  // -------------------------
  async init() {
    try {
      this.statusEl.textContent = 'Cargando modelos...';

      // instantiate faceRec first so we can call loadModels/loadProfiles
      this.faceRec = new FaceRecognitionManager({
        modelPath: this.modelPath,
        getActiveVideo: () => this.getActiveVideo(),
        onNotification: (msg, type) => this._showOnce(msg, type)
      });

      // faceRec needs to know how to get canvases for a video element
      this.faceRec.getCanvasForVideo = (vid) => vid ? vid._canvas || null : null;

      await this.faceRec.loadModels();

      this.statusEl.textContent = 'Cargando perfiles...';
      await this.faceRec.loadProfilesFromServer();

      // build profileThumbs map from profiles endpoint (quick)
      await this._loadProfileThumbs();

      this.statusEl.textContent = 'Conectando señalización (WebSocket)...';
      this.webrtc = new WebRTCManager({
        wsUrl: this.wsUrl,
        onRemoteFeed: this._onRemoteFeed,
        onLog: (m) => this._log(m)
      });

      await this.webrtc.init();

      // load cameras list (doesn't create DOM nodes)
      await this._loadCameras();

      // create local camera automatically (first device)
      await this._createLocalCamera();

      // start detection automatically
      this._startAutoDetection();

      this.statusEl.textContent = '✅ Listo';

      // UI interactions: threshold slider
      if (this.thresholdInput) {
        this.thresholdInput.addEventListener('input', () => {
          const v = parseFloat(this.thresholdInput.value);
          this.faceRec.setThreshold(v);
          if (this.thVal) this.thVal.textContent = v.toFixed(2);
        });
      }

      // expose for debugging
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
    // wrapper grid item
    const wrapper = document.createElement('div');
    wrapper.className = 'feed';
    wrapper.dataset.feedId = id;

    // video
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = opts.muted ?? true;
    video.srcObject = stream;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.id = 'video-' + id;

    // canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'feed-canvas';
    canvas.id = 'canvas-' + id;
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';

    // overlay container (video + canvas)
    const frame = document.createElement('div');
    frame.className = 'feed-frame';
    frame.style.position = 'relative';
    frame.style.width = '100%';
    frame.style.paddingTop = '56.25%'; // 16:9 aspect placeholder
    frame.appendChild(video);

    // absolutely position canvas on top
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.right = 0;
    canvas.style.bottom = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    wrapper.appendChild(frame);
    wrapper.appendChild(canvas);

    // label box for names + thumbnail
    const labelBox = document.createElement('div');
    labelBox.className = 'feed-labels';
    wrapper.appendChild(labelBox);

    // insert into grid container
    this.container.appendChild(wrapper);

    // assign references
    video._canvas = canvas;
    video._wrapper = wrapper;
    video._labelBox = labelBox;

    // when loadedmetadata → resize canvas
    video.addEventListener('loadedmetadata', () => this._resizeCanvasToVideoElement(video));

    // add to list
    this.videos.push(video);

    return { video, canvas, wrapper, labelBox };
  }

  // -------------------------
  // Handle local camera creation
  // -------------------------
  async _createLocalCamera() {
    try {
      // pick first available device
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err) {
        console.warn('No se pudo acceder a la cámara local', err);
        return;
      }

      const { video, canvas } = this.createVideoCanvasPair('local', stream, { muted: true });
      this.localVideo = video;
      this.localCanvas = canvas;

      // prefer local at front
      // ensure only one 'local' exists
      this.videos = this.videos.filter(v => v.dataset.feedId !== 'local');
      this.videos.unshift(video);

      this._log('Cámara local creada.');
    } catch (e) {
      console.error('Error creando cámara local', e);
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

  // -------------------------
  // getActiveVideo used by faceRec if needed
  // -------------------------
  getActiveVideo() {
    return this.localVideo || (this.videos.length ? this.videos[0] : null);
  }

  // -------------------------
  // Start automatic multiperson detection
  // -------------------------
  _startAutoDetection() {
    // ensure canvases are resized
    this.videos.forEach(v => this._resizeCanvasToVideoElement(v));

    const vids = this.videos.slice(); // copy

    this.faceRec.startMultiDetection({
      videos: vids,
      // room detection: use feed id
      getRoomByVideo: (vid) => {
        if (!vid || !vid.dataset) return 'main';
        return vid.dataset.feedId === 'local' ? 'local' : 'remote';
      },
      onDetect: (name, sala) => this._onPersonDetected(name, sala)
    });

    // periodic cleanup for personState (detect disappear)
    setInterval(() => {
      const now = Date.now();
      for (const name in this.personState) {
        const p = this.personState[name];
        if (now - p.lastSeen > 2000) {
          // show leave notification and remove
          this._showOnce(`${name} salió de ${p.room}`, 'warning');
          delete this.personState[name];
          this._removeFromList(name);
        }
      }
    }, 500);
  }

  // -------------------------
  // When face-recognition reports someone
  // -------------------------
  _onPersonDetected(name, sala) {
    const now = Date.now();
    if (!name) name = 'Desconocido';

    // per-person state
    if (!this.personState[name]) {
      // first time
      this.personState[name] = { room: sala, lastSeen: now };
      this._showOnce(`${name} está en ${sala}`, 'success');
      this._addOrUpdateList(name, sala, now);
      return;
    }

    const person = this.personState[name];

    // changed room?
    if (person.room !== sala) {
      this._showOnce(`${name} salió de ${person.room} y entró a ${sala}`, 'success');
      person.room = sala;
    }

    person.lastSeen = now;
    this._addOrUpdateList(name, sala, now);
  }

  // -------------------------
  // UI: list of detected persons (mini thumbnails + name + last seen)
  // -------------------------
  _addOrUpdateList(name, sala, lastSeen) {
    const list = document.getElementById('remoteList'); // reuse remoteList area
    if (!list) return;

    let item = list.querySelector(`[data-name="${CSS.escape(name)}"]`);
    if (!item) {
      item = document.createElement('div');
      item.className = 'detected-item';
      item.dataset.name = name;

      const img = document.createElement('img');
      img.className = 'detected-thumb';
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';
      img.style.marginRight = '8px';
      img.alt = name;

      const text = document.createElement('div');
      text.className = 'detected-text';

      const nameEl = document.createElement('div');
      nameEl.className = 'detected-name';
      nameEl.textContent = name;

      const metaEl = document.createElement('div');
      metaEl.className = 'detected-meta';
      metaEl.style.fontSize = '12px';
      metaEl.style.opacity = '0.8';
      metaEl.textContent = `en ${sala}`;

      text.appendChild(nameEl);
      text.appendChild(metaEl);

      item.appendChild(img);
      item.appendChild(text);
      list.appendChild(item);

      // set thumbnail if available
      if (this.profileThumbs[name]) {
        img.src = this.profileThumbs[name];
      } else {
        img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23ddd"/></svg>';
      }
    } else {
      // update meta
      const metaEl = item.querySelector('.detected-meta');
      if (metaEl) metaEl.textContent = `en ${sala}`;
      const img = item.querySelector('img.detected-thumb');
      if (img && this.profileThumbs[name]) img.src = this.profileThumbs[name];
    }

    // update lastSeen attr for cleanup
    item.dataset.lastSeen = String(lastSeen);
  }

  _removeFromList(name) {
    const list = document.getElementById('remoteList');
    if (!list) return;
    const item = list.querySelector(`[data-name="${CSS.escape(name)}"]`);
    if (item) item.remove();
  }

}
