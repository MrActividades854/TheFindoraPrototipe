// ui.js
// Clase que orquesta UI, cámaras locales y conecta WebRTCManager y FaceRecognitionManager (clases).
import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';

export default class UIManager {
  constructor({ wsUrl = 'ws://localhost:8080', modelPath = '/models' } = {}) {
    // DOM
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('overlay');
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = document.getElementById('status');
    this.addRefForm = document.getElementById('addRefForm');
    this.refNameInput = document.getElementById('refName');
    this.refFilesInput = document.getElementById('refFiles');
    this.refList = document.getElementById('refList');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.prevCamBtn = document.getElementById('prevCamBtn');
    this.nextCamBtn = document.getElementById('nextCamBtn');
    this.camNameEl = document.getElementById('camName');
    this.remoteList = document.getElementById('remoteList');
    this.clearRefsBtn = document.getElementById('clearRefsBtn');
    this.toggleDebugBtn = document.getElementById('toggleDebugBtn');
    this.thresholdInput = document.getElementById('threshold');
    this.thVal = document.getElementById('thVal');
    this.forceReloadBtn = document.getElementById('forceReloadBtn');

    // config
    this.wsUrl = wsUrl;
    this.modelPath = modelPath;

    // state
    this.videoDevices = [];
    this.currentCamIndex = 0;
    this.stream = null;

    // instances
    this.webrtc = new WebRTCManager({ wsUrl: this.wsUrl, onRemoteFeed: (id, stream)=>this._onRemoteFeed(id, stream), onLog: (m)=>this._log(m) });
    this.faceRec = new FaceRecognitionManager({ modelPath: this.modelPath, getActiveVideo: ()=>this.getActiveVideo(), onNotification: (msg, type)=>this._notify(msg, type) });

    // bind
    this._onStartClick = this._onStartClick.bind(this);
  }

async init() {
  this.statusEl.textContent = 'Cargando modelos...';
  try {
    // 1. Modelos
    await this.faceRec.loadModels();

    // 2. Cargar referencias desde storage
    this.faceRec.loadReferencesFromLocalStorage();

    // 3. Inicializar WebSocket + WebRTC
    this.statusEl.textContent = 'Inicializando WebSocket...';
    await this.webrtc.init();

    // 4. Cargar cámaras locales
    await this._loadCameras();

    // 5. UI
    this._bindUI();

    // 6. "Seleccionar" la primera cámara local o remota
    //    IMPORTANTE: si no haces esto, no tienes video listo para detectar
    await this.switchCamera(0);

    this.statusEl.textContent = '✅ Listo';

  } catch (e) {
    console.error(e);
    this.statusEl.textContent = 'Error inicializando: ' + e.message;
  }
}


  _log(msg) { console.log('[UI]', msg); this.statusEl.textContent = msg; }

  _notify(msg, type='warning') {
    // simple toast
    const container = document.getElementById('notificationContainer');
    const div = document.createElement('div');
    div.style.background = type==='warning' ? '#ff4d4d' : '#2ea043';
    div.style.color = '#fff';
    div.style.padding = '10px 14px';
    div.style.borderRadius = '8px';
    div.style.marginTop = '6px';
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(()=>div.remove(), 4000);
  }

  // ---------- cameras ----------
  async _loadCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.videoDevices = devices.filter(d => d.kind === 'videoinput').map((d,i)=>({ deviceId: d.deviceId, label: d.label || `Cámara ${i+1}` }));
    // add any remote placeholders already registered by WebRTCManager
    for (const sid in this.webrtc.remoteVideos) {
      if (!this.videoDevices.some(v=>v.deviceId===`remote-${sid}`)) this.videoDevices.push({ deviceId: `remote-${sid}`, label: `Cámara remota ${sid}`});
    }
    if (!this.videoDevices.length) this.statusEl.textContent = '❌ No se encontraron cámaras.';
    this.currentCamIndex = 0;
    this._updateCamName();
  }

  _updateCamName() {
    const cam = this.videoDevices[this.currentCamIndex];
    this.camNameEl.textContent = `🎥 ${cam?.label || '—'} (${this.currentCamIndex+1} de ${this.videoDevices.length})`;
  }

  async switchCamera(indexChange=0) {
    if (!this.videoDevices.length) return;
    this.currentCamIndex = (this.currentCamIndex + indexChange + this.videoDevices.length) % this.videoDevices.length;
    this._updateCamName();
    const selected = this.videoDevices[this.currentCamIndex];
    if (!selected) return;

    if (selected.deviceId.startsWith('remote-')) {
      const sid = selected.deviceId.replace('remote-','');
      const rv = this.webrtc.remoteVideos[sid];
      if (rv && rv.srcObject) {
        // hide local video
        this.video.style.display = 'none';
        rv.style.display = 'block';
        this._resizeCanvasToVideoElement(rv);
      } else {
        this._notify('Feed remoto no disponible aún', 'warning');
      }
      return;
    }

    // local camera
    try {
      if (this.stream) this.stream.getTracks().forEach(t=>t.stop());
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selected.deviceId } }, audio: false });
      this.video.srcObject = this.stream;
      this.video.style.display = 'block';
      for (const rv of Object.values(this.webrtc.remoteVideos)) rv.style.display = 'none';
      await this.video.play();
      this._resizeCanvasToVideoElement(this.video);
    } catch (err) {
      this._notify('Error cambiando cámara: ' + err.message, 'warning');
    }
  }

  getActiveVideo() {
    const selected = this.videoDevices[this.currentCamIndex];
    if (selected && selected.deviceId && selected.deviceId.startsWith('remote-')) {
      const sid = selected.deviceId.replace('remote-','');
      return this.webrtc.remoteVideos[sid] || this.video;
    }
    return this.video;
  }

  _resizeCanvasToVideoElement(vid) {
    const rect = vid.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.canvas._scaleX = rect.width / (vid.videoWidth || rect.width);
    this.canvas._scaleY = rect.height / (vid.videoHeight || rect.height);
  }

  // ---------- UI binding ----------
  _bindUI() {
    this.startBtn.addEventListener('click', this._onStartClick);
    this.stopBtn.addEventListener('click', ()=>{ this.faceRec.stopDetection(); this.startBtn.disabled=false; this.stopBtn.disabled=true; });
    this.prevCamBtn.addEventListener('click', ()=>this.switchCamera(-1));
    this.nextCamBtn.addEventListener('click', ()=>this.switchCamera(1));
    this.toggleDebugBtn.addEventListener('click', ()=>{ this.faceRec.showDebugPoint = !this.faceRec.showDebugPoint; this.toggleDebugBtn.textContent = this.faceRec.showDebugPoint ? '⚪ Ocultar punto rojo' : '🔴 Mostrar punto rojo'; });
    this.thresholdInput.addEventListener('input', ()=>{ this.thVal.textContent = this.thresholdInput.value; this.faceRec.setThreshold(this.thresholdInput.value); });

    // references
    this.addRefForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const name = this.refNameInput.value.trim();
      const files = [...this.refFilesInput.files];
      if (!name || !files.length) { alert('Pon un nombre y elige al menos una imagen.'); return; }
      this.statusEl.textContent = `Procesando referencias para ${name}...`;
      const labeled = await this.faceRec.addReferenceImages(name, files);
      if (labeled) this._renderRefItem(name, files[0]);
      this.refNameInput.value = ''; this.refFilesInput.value = null;
      this.statusEl.textContent = `Referencia "${name}" agregada.`;
    });

    this.clearRefsBtn.addEventListener('click', ()=>{ localStorage.removeItem('faceRefs'); this.faceRec.labeledDescriptors = []; this.faceRec.updateMatcher(); this.refList.textContent = 'No hay referencias aún.'; });

    this.forceReloadBtn.addEventListener('click', async ()=>{ await this._loadReferencesFromFolder(true); });

    // populate saved refs UI
    // populate saved refs UI
try {
  const raw = localStorage.getItem('faceRefs');
  if (raw) {
    this.refList.innerHTML = ""; // <<< FIX
    const parsed = JSON.parse(raw);
    for (const r of parsed) this._renderRefItem(r.label, null);
  }
} catch(e){}

  }

  _renderRefItem(name, file) {
    const div = document.createElement('div');
    div.className = 'ref-item';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    if (file) {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url; img.style.width='64px'; img.style.height='64px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
      div.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = name;
    div.appendChild(span);
    this.refList.appendChild(div);
  }

  // ---------- Remote feed callback from WebRTCManager ----------
  _onRemoteFeed(senderId, stream) {
    // create thumbnail + hidden video (if not exists)
    if (this.webrtc.remoteVideos[senderId]) {
      // already created by WebRTCManager: webrtc.remoteVideos[senderId] is the element
    } else {
      // but WebRTCManager normally creates the element; ensure we reference it
    }

    const videoEl = this.webrtc.remoteVideos[senderId] || (() => {
      const v = document.createElement('video'); v.autoplay=true; v.muted=true; v.playsInline=true; v.className='remote-video'; v.id = `remote-${senderId}`; v.srcObject = stream; document.body.appendChild(v); return v;
    })();

    // create thumbnail UI block
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb';
    thumbWrap.style.width = '160px';
    const thumb = document.createElement('video');
    thumb.autoplay = true; thumb.muted = true; thumb.playsInline = true;
    thumb.width = 160; thumb.height = 90; thumb.srcObject = stream; thumb.style.borderRadius='8px';
    const label = document.createElement('div'); label.textContent = `Remoto ${senderId}`; label.style.color='#fff'; label.style.fontSize='13px';
    thumbWrap.appendChild(thumb); thumbWrap.appendChild(label);

    thumbWrap.onclick = async () => {
      if (!this.videoDevices.some(v => v.deviceId === `remote-${senderId}`)) this.videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}`});
      this._updateCamName();
      const idx = this.videoDevices.findIndex(v => v.deviceId === `remote-${senderId}`);
      if (idx >= 0) { this.currentCamIndex = idx; await this.switchCamera(0); }
    };

    this.remoteList.appendChild(thumbWrap);

    // keep the element in the webrtc remoteVideos map (WebRTCManager may have created it)
    this.webrtc.remoteVideos[senderId] = videoEl;

    // also add placeholder device entry if missing
    if (!this.videoDevices.some(v => v.deviceId === `remote-${senderId}`)) {
      this.videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}`});
    }
    this._updateCamName();
  }
}
