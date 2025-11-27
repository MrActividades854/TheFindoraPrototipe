// ui.js
// UI manager completo — integra WebRTCManager y FaceRecognitionManager
// Incluye: notificaciones, referencias, loadFromFolder, start/stop, thumbnails remotos, forceReload, etc.

import WebRTCManager from './webrtc.js';
import FaceRecognitionManager from './face-recognition.js';

export default class UIManager {
  constructor({ wsUrl = 'https://thefindoraprototipe.onrender.com', modelPath = '/models' } = {}) {
    // DOM
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('overlay');
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = document.getElementById('status');

    this.addRefForm = document.getElementById('addRefForm');
    this.refNameInput = document.getElementById('refName');
    this.refFilesInput = document.getElementById('refFiles');
    this.refList = document.getElementById('refList');
    this.addMoreFiles = document.getElementById('addMoreFiles') || this._createHiddenFileInput();

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
    this.notificationContainer = document.getElementById('notificationContainer');

    if (!this.notificationContainer) {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'notificationContainer';
    document.body.appendChild(this.notificationContainer);
}

// 🔥 Estilos forzados desde el primer render
this.notificationContainer.style.position = "fixed";
this.notificationContainer.style.bottom = "20px";
this.notificationContainer.style.right = "20px";
this.notificationContainer.style.pointerEvents = "none";

// Muy importante: usar setProperty con prioridad "important"
this.notificationContainer.style.setProperty(
    "z-index",
    "2147483647",
    "important"
);



    // config/state
    this.wsUrl = wsUrl;
    this.modelPath = modelPath;
    this.videoDevices = [];
    this.currentCamIndex = 0;
    this.stream = null;

    this.getActiveRoom = this.getActiveRoom.bind(this);

    

    // instances
    this.webrtc = new WebRTCManager({
      wsUrl: this.wsUrl,
      onRemoteFeed: (id, stream) => this._onRemoteFeed(id, stream),
      onLog: (m) => this._log(m)
    });

    this.faceRec = new FaceRecognitionManager({
      modelPath: this.modelPath,
      getActiveVideo: () => this.getActiveVideo(),
      onNotification: (msg, type) => this._createNotification(msg, type)
    });

    // bind
    this._onStartClick = this._onStartClick.bind(this);

    this.bc = new BroadcastChannel("canal_notificaciones");

  }



  // -------------------------
  // Initialization
  // -------------------------
  async init() {
    try {
      this.statusEl.textContent = 'Cargando modelos...';
      await this.faceRec.loadModels();

      // load local references and render UI list
      this.faceRec.loadReferencesFromLocalStorage();

      this._renderSavedReferences();

      this.statusEl.textContent = 'Conectando señalización (WebSocket)...';
      await this.webrtc.init();

      // load cameras
      await this._loadCameras();

      // bind ui handlers
      this._bindUI();

      // pick first camera (important)
      await this.switchCamera(0);

      this.statusEl.textContent = '✅ Listo';
    } catch (err) {
      console.error(err);
      this.statusEl.textContent = 'Error inicializando: ' + (err.message || err);
    }
  }

  // -------------------------
  // Logging & Notifications
  // -------------------------
  _log(msg) {
    console.log('[UI]', msg);
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  // Reusa el sistema bonito de notificaciones del script original
_createNotification(message, type = 'warning') {
  const container = this.notificationContainer || document.getElementById('notificationContainer');
  if (!container) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString('es-CO', { hour12: false });

  // ---- NUEVO: enviar al BroadcastChannel ----
  const log = {
    id: Date.now() + Math.random(),
    message,
    type,
    time: timeString
  };
  if (this.bc) this.bc.postMessage(log);
  // --------------------------------------------

  const notif = document.createElement('div');
  notif.className = 'notification';
  notif.style.marginTop = '8px';

  notif.innerHTML = `
    <div style="
      display:flex;
      flex-direction:column;
      gap:6px;
      background:${type === 'warning' ? '#ff4d4d' : '#4caf50'};
      color:white;
      padding:12px;
      border-radius:8px;
      box-shadow:0 6px 18px rgba(0,0,0,0.25);
      min-width:220px;
      position:relative;
      z-index:9999999;
      ">
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="font-size:18px">${type === 'warning' ? '⚠️' : '✅'}</div>
        <div style="flex:1">${message}</div>
      </div>
      <div style="text-align:right; font-size:12px; opacity:0.9;">🕒 ${timeString}</div>
    </div>
  `;

  container.appendChild(notif);
  notif.style.setProperty("z-index", "2147483647", "important");
  setTimeout(() => notif.remove(), type === 'warning' ? 5000 : 3000);
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
        this._createNotification('⚠️ Feed remoto no disponible (aún).', 'warning');
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
    this._createNotification("Error activando cámara local: " + err.message, "warning");
}


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

    // references: add
    this.addRefForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.refNameInput.value.trim();
      const files = [...this.refFilesInput.files];
      if (!name || !files.length) { alert('Pon un nombre y elige al menos una imagen.'); return; }
      this.statusEl.textContent = `Procesando referencias para ${name}...`;
      const labeled = await this.faceRec.addReferenceImages(name, files);
      if (labeled) {
        this._renderRefItem(name, files[0]);
        this._createNotification(`Referencia "${name}" agregada`, 'success');
      } else {
        this._createNotification(`No se pudo generar descriptor para "${name}"`, 'warning');
      }
      this.refNameInput.value = '';
      this.refFilesInput.value = null;
      this.statusEl.textContent = 'Listo';
    });

    // clear refs
    this.clearRefsBtn.addEventListener('click', () => {
      localStorage.removeItem('faceRefs');
      this.faceRec.labeledDescriptors = [];
      this.faceRec.updateMatcher();
      this.refList.innerHTML = 'No hay referencias aún.';
      this._createNotification('Referencias locales eliminadas', 'warning');
    });

    // force reload folder
    if (this.forceReloadBtn) {
      this.forceReloadBtn.addEventListener('click', async () => {
        await this.loadReferencesFromFolder(true);
      });
    }

    // hidden addMoreFiles input for adding images to existing ref items
    this.addMoreFiles.addEventListener('change', async (e) => {
      const targetRef = e.target.dataset.targetRef;
      if (!targetRef) return;
      const files = [...e.target.files];
      if (!files.length) return;
      this.statusEl.textContent = `Agregando ${files.length} imagen(es) a ${targetRef}...`;
      const descriptors = [];
      for (const f of files) {
        const img = await faceapi.bufferToImage(f);
        const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (det) descriptors.push(det.descriptor);
      }
      if (!descriptors.length) {
        this._createNotification('No se detectaron caras en las nuevas imágenes', 'warning');
        return;
      }
      const existing = this.faceRec.labeledDescriptors.find(ld => ld.label === targetRef);
      if (existing) {
        existing.descriptors.push(...descriptors);
        this.faceRec.updateMatcher();
        this.faceRec.saveReferencesToLocalStorage?.();
        this._createNotification(`${files.length} imágenes añadidas a ${targetRef}`, 'success');
      } else {
        const labeled = new faceapi.LabeledFaceDescriptors(targetRef, descriptors);
        this.faceRec.labeledDescriptors.push(labeled);
        this.faceRec.updateMatcher();
        this.faceRec.saveReferencesToLocalStorage?.();
        this._renderRefItem(targetRef, files[0]);
        this._createNotification(`Referencia ${targetRef} creada y añadida`, 'success');
      }
    });
  }

  // -------------------------
  // Start detection (button handler)
  // -------------------------
  async _onStartClick() {
    try {
      // ensure active video ready
      const vid = this.getActiveVideo();
      this._resizeCanvasToVideoElement(vid);

      this.faceRec.startDetection({
        canvasCtx: this.ctx,
        resizeCanvasToVideoElement: (v) => this._resizeCanvasToVideoElement(v),
        getActiveVideo: () => this.getActiveVideo(),
        getActiveRoom: () => this.getActiveRoom()
      });

      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
    } catch (err) {
      console.error('Error iniciando detección', err);
      this._createNotification('No se pudo iniciar la detección', 'warning');
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;
    }
  }

  // -------------------------
  // References rendering & helpers
  // -------------------------
  _renderSavedReferences() {
    const raw = localStorage.getItem('faceRefs');
    if (!raw) {
      this.refList.innerHTML = 'No hay referencias aún.';
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this.refList.innerHTML = '';
      for (const r of parsed) {
        this._renderRefItem(r.label, null);
      }
    } catch (err) {
      console.error('Error parseando refs', err);
    }
  }

  _renderRefItem(name, file) {
    const div = document.createElement('div');
    div.className = 'ref-item';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.dataset.name = name;

    if (file) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.width = 64; img.height = 64;
      img.style.objectFit = 'cover'; img.style.borderRadius = '6px';
      div.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = name;
    div.appendChild(span);

    // add click handler to add more images to this ref
    div.addEventListener('click', () => {
      // set a flag so onchange knows which ref to add to
      this.addMoreFiles.dataset.targetRef = name;
      this.addMoreFiles.value = null;
      this.addMoreFiles.click();
    });

    if (this.refList.textContent.trim() === 'No hay referencias aún.') this.refList.textContent = '';
    this.refList.appendChild(div);
  }

  // -------------------------
  // Load references from folder (server-side JSON)
  // -------------------------
  async loadReferencesFromFolder(forceReload = false) {
    try {
      const res = await fetch('./references/references.json?_=' + Date.now());
      if (!res.ok) throw new Error('No se pudo cargar references.json');
      const data = await res.json();

      this.statusEl.textContent = '🔍 Revisando referencias en carpeta...';
      let newRefsCount = 0;

      for (const [name, files] of Object.entries(data)) {
        const existing = this.faceRec.labeledDescriptors.find(ld => ld.label === name);
        if (existing && !forceReload) continue;

        const descriptors = [];
        for (const file of files) {
          const url = `./references/${name}/${file}?_=${Date.now()}`;
          try {
            const img = await faceapi.fetchImage(url);
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (detection) descriptors.push(detection.descriptor);
            else this._createNotification(`No se detectó rostro en ${name}/${file}`, 'warning');
          } catch (err) {
            this._createNotification(`Error leyendo ${name}/${file}`, 'warning');
          }
        }

        if (descriptors.length) {
          if (existing) {
            existing.descriptors.push(...descriptors);
          } else {
            this.faceRec.labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(name, descriptors));
            this._renderRefItem(name, null);
          }
          newRefsCount++;
        }
      }

      if (newRefsCount > 0) {
        this.faceRec.updateMatcher();
        // persist
        if (this.faceRec.saveReferencesToLocalStorage) this.faceRec.saveReferencesToLocalStorage();
        this.statusEl.textContent = `✅ ${newRefsCount} nuevas referencias cargadas desde carpeta.`;
      } else {
        this.statusEl.textContent = '📁 No se encontraron nuevas referencias.';
      }
    } catch (err) {
      console.error('Error cargando referencias desde carpeta:', err);
      this.statusEl.textContent = '⚠️ Error al cargar referencias desde carpeta.';
    }
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

  // -------------------------
  // Helper - create hidden input for adding images to refs
  // -------------------------
  _createHiddenFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'addMoreFiles';
    document.body.appendChild(input);
    return input;
  }

}
