// face-recognition.js
// Clase que carga modelos de face-api, mantiene labeledDescriptors y ejecuta el loop de detección.
// Recibe una función getActiveVideoElement() proporcionada por UI para saber sobre qué video detectar.

export default class FaceRecognitionManager {
  /**
   * constructor options:
   * - modelPath: carpeta con modelos face-api
   * - getActiveVideo: () => HTMLVideoElement (UI debe proporcionar)
   * - onNotification: function(string, 'warning'|'success') para mensajes UI
   */
  constructor({ modelPath = '/models', getActiveVideo = ()=>null, onNotification = ()=>{} } = {}) {
    this.modelPath = modelPath;
    this.getActiveVideo = getActiveVideo;
    this.onNotification = onNotification;

    this.labeledDescriptors = [];
    this.faceMatcher = null;
    this.detecting = false;
    this.showDebugPoint = false;

    this.tracked = [];
    this.MAX_DIST = 120;
    this.ALERT_TIMEOUT = 10000;
    this.peopleLastSeen = {};
    this.activeAlerts = {};
    this.knownPeople = new Set();

    this.threshold = 0.6;
  }

  async loadModels() {
    // carga modelos
    await faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath);
    await faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath);
    return;
  }

  setThreshold(val) {
    this.threshold = parseFloat(val);
    this.updateMatcher();
  }

  updateMatcher() {
    if (this.labeledDescriptors.length) {
      this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, this.threshold);
    } else {
      this.faceMatcher = null;
    }
  }

  // Añadir referencias desde FileList
  async addReferenceImages(name, files) {
    const descriptors = [];
    for (const f of files) {
      const img = await faceapi.bufferToImage(f);
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (!detection) {
        this.onNotification(`No se detectó cara en ${f.name}`, 'warning');
        continue;
      }
      descriptors.push(detection.descriptor);
    }
    if (!descriptors.length) return null;
    const labeled = new faceapi.LabeledFaceDescriptors(name, descriptors);
    this.labeledDescriptors.push(labeled);
    this.updateMatcher();
    this.saveReferencesToLocalStorage();
    return labeled;
  }

  saveReferencesToLocalStorage() {
    try {
      const data = this.labeledDescriptors.map(ld => ({ label: ld.label, descriptors: ld.descriptors.map(d => Array.from(new Float32Array(d))) }));
      localStorage.setItem('faceRefs', JSON.stringify(data));
      this.onNotification('Referencias guardadas localmente', 'success');
    } catch (e) {
      console.error('Error guardando refs', e);
    }
  }

  loadReferencesFromLocalStorage() {
    const raw = localStorage.getItem('faceRefs');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this.labeledDescriptors = parsed.map(p => new faceapi.LabeledFaceDescriptors(p.label, p.descriptors.map(d => new Float32Array(d))));
      this.updateMatcher();
    } catch (e) { console.error('Error cargando refs', e); }
  }

  // ---------- Tracking helpers ----------
  distance(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
  assignTracked(x, y, width, height) {
    for (const t of this.tracked) {
      const dist = this.distance({x: t.smoothedX || t.x, y: t.smoothedY || t.y}, {x,y});
      if (dist < this.MAX_DIST) {
        // Apply smoothing to position and size
        const smoothingFactor = 0.7; // Further increased for more smoothing
        t.smoothedX = t.smoothedX ? t.smoothedX * (1 - smoothingFactor) + x * smoothingFactor : x;
        t.smoothedY = t.smoothedY ? t.smoothedY * (1 - smoothingFactor) + y * smoothingFactor : y;
        t.smoothedWidth = t.smoothedWidth ? t.smoothedWidth * (1 - smoothingFactor) + width * smoothingFactor : width;
        t.smoothedHeight = t.smoothedHeight ? t.smoothedHeight * (1 - smoothingFactor) + height * smoothingFactor : height;
        t.lastSeen = Date.now();
        t.missing = false;
        return t;
      }
    }
    const color = ['#00FF00','#FF3B30','#007AFF','#FF9500','#AF52DE','#FFCC00','#00C7BE'][this.tracked.length % 7];
    const newT = {
      x, y, width, height,
      smoothedX: x, smoothedY: y, smoothedWidth: width, smoothedHeight: height,
      color, lastSeen: Date.now(), missing: false
    };
    this.tracked.push(newT);
    return newT;
  }

  // ---------- Alert helpers ----------
  showPersonAlert(name) { this.onNotification(`${name} ha salido del cuarto`, 'warning'); this.activeAlerts[name]=true; }
  showPersonReturn(name) { this.onNotification(`${name} ha vuelto`, 'success'); this.activeAlerts[name]=false; }
  showPersonEntry(name) { this.onNotification(`${name} ha entrado al cuarto`, 'success'); this.activeAlerts[name]=false; }

  updatePersonDetection(label) {
    const now = Date.now();
    if (label && label !== 'Desconocido') {
      if (!this.knownPeople.has(label)) { this.knownPeople.add(label); this.showPersonEntry(label); }
      this.peopleLastSeen[label] = now;
      if (this.activeAlerts[label]) this.showPersonReturn(label);
    } else if (label === 'Desconocido') {
      const name = 'Desconocido';
      if (!this.knownPeople.has(name)) { this.knownPeople.add(name); this.onNotification('Un desconocido ha entrado al cuarto','warning'); }
      this.peopleLastSeen[name] = now;
      if (this.activeAlerts[name]) { this.onNotification('Un desconocido ha vuelto a aparecer', 'warning'); this.activeAlerts[name]=false; }
    }
  }

  checkAllGone() {
    const now = Date.now();
    if (Object.keys(this.peopleLastSeen).length === 0) return;
    let allGone = true, someoneReturned = false;
    for (const p in this.peopleLastSeen) {
      const t = now - this.peopleLastSeen[p];
      if (t > this.ALERT_TIMEOUT && !this.activeAlerts[p]) {
        if (p === 'Desconocido') this.onNotification('Un desconocido ha salido del cuarto','warning'); else this.showPersonAlert(p);
      }
      if (t <= this.ALERT_TIMEOUT) { allGone = false; if (this.activeAlerts[p]) { someoneReturned = true; this.activeAlerts[p]=false; } }
    }
    if (allGone) {
      if (!Object.values(this.activeAlerts).some(v=>v)) { this.onNotification('Todos se han ido del cuarto','warning'); for (const p in this.peopleLastSeen) this.activeAlerts[p]=true; }
    } else if (someoneReturned) {
      this.onNotification('Alguien ha vuelto al cuarto','success');
    }
  }

  // ---------- Detección ----------
  startDetection({ canvasCtx, resizeCanvasToVideoElement, getActiveVideo } = {}) {
    if (this.detecting) return;
    if (!canvasCtx || !resizeCanvasToVideoElement || !getActiveVideo) throw new Error('Se requieren canvasCtx / resize / getActiveVideo');
    this.detecting = true;
    this._detectionLoop({ canvasCtx, resizeCanvasToVideoElement, getActiveVideo });
  }

  stopDetection() {
    this.detecting = false;
    this.tracked = [];
    // reset people timers?
    this.peopleLastSeen = {};
    this.activeAlerts = {};
    this.knownPeople = new Set();
  }

  async _detectionLoop({ canvasCtx, resizeCanvasToVideoElement, getActiveVideo }) {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    while (this.detecting) {
      const vid = getActiveVideo();
      if (!vid || vid.readyState < 2) { await this._sleep(100); continue; }
      resizeCanvasToVideoElement(vid);
      const results = await faceapi.detectAllFaces(vid, options).withFaceLandmarks().withFaceDescriptors();
      // limpiar canvas
      canvasCtx.clearRect(0,0,canvasCtx.canvas.width, canvasCtx.canvas.height);
      const now = Date.now();
      for (let i=this.tracked.length-1;i>=0;i--) if (now - this.tracked[i].lastSeen > 3000) this.tracked.splice(i,1);

      for (const res of results) {
        const box = res.detection.box;
        const scaleX = canvasCtx.canvas._scaleX || 1;
        const scaleY = canvasCtx.canvas._scaleY || 1;
        const x = box.x * scaleX, y = box.y * scaleY, width = box.width * scaleX, height = box.height * scaleY;
        const xCenter = x + width/2, yCenter = y + height/2;
        const t = this.assignTracked(xCenter, yCenter, width, height);

        // matching
        let label = 'Desconocido';
        if (this.faceMatcher) {
          const best = this.faceMatcher.findBestMatch(res.descriptor);
          if (best && best.label !== 'unknown') label = best.label;
          this.updatePersonDetection(label);
        }

        // Use smoothed values for drawing
        const smoothedX = t.smoothedX - t.smoothedWidth / 2;
        const smoothedY = t.smoothedY - t.smoothedHeight / 2;
        const smoothedWidth = t.smoothedWidth;
        const smoothedHeight = t.smoothedHeight;

        // dibujar
        canvasCtx.lineWidth = Math.max(2, smoothedWidth/100);
        canvasCtx.strokeStyle = t.color;
        canvasCtx.strokeRect(smoothedX, smoothedY, smoothedWidth, smoothedHeight);

        const padding = 6;
        canvasCtx.font = `${Math.max(14, smoothedWidth/18)}px sans-serif`;
        const text = label;
        const textW = canvasCtx.measureText(text).width + padding*2;
        const textH = Math.max(26, smoothedHeight/9);
        let tagX = smoothedX, tagY = smoothedY + smoothedHeight + textH + 4;
        if (tagY > canvasCtx.canvas.height - 5) tagY = smoothedY - 10;
        canvasCtx.fillStyle = 'rgba(0,0,0,0.65)';
        canvasCtx.fillRect(tagX - 2, tagY - textH, textW + 4, textH);
        canvasCtx.fillStyle = '#fff';
        canvasCtx.fillText(text, tagX + padding, tagY - textH/3);

        if (this.showDebugPoint) {
          canvasCtx.beginPath();
          canvasCtx.arc(t.smoothedX, t.smoothedY, 4, 0, Math.PI*2);
          canvasCtx.fillStyle = 'red';
          canvasCtx.fill();
        }
      }

      this.checkAllGone();
      await this._sleep(100);
    }
  }

  _sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
}
