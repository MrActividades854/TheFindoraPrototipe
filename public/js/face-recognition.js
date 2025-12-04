// face-recognition.js (versión corregida y optimizada)
// Mejoras:
// - Anti-falsos positivos
// - Confirmación multi-frame para desconocido
// - Ignora detecciones pequeñas y arranque inicial
// - Mantiene alertas de entrada, salida y regreso

export default class FaceRecognitionManager {
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

    // NUEVO: sistema anti falsos positivos
    this.detectionStartedAt = 0;
    this.unconfirmedUnknownFrames = 0;
    this.confirmUnknownAfter = 5; // número de frames para confirmar desconocido


    this.currentRoom = null;
    this.lastRoomDetected = null;

    this.getCanvasForVideo = () => null;


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
          const labeled = new faceapi.LabeledFaceDescriptors(p.name,descriptors);
          this.labeledDescriptors.push(labeled);
        }
    }

    console.log("[FaceRec] Perfiles cargados:", this.labeledDescriptors.length);

    // Descriptores YA están cargados aquí
if (!this.labeledDescriptors || this.labeledDescriptors.length === 0) {
    console.warn("⚠ No hay perfiles. Se crea un FaceMatcher vacío.");
    this.faceMatcher = new faceapi.FaceMatcher([], this.threshold);
} else {
    this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, this.threshold);
    console.log("FaceMatcher inicializado con", this.labeledDescriptors.length, "personas.");
}

}


  async loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri(this.modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromUri(this.modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromUri(this.modelPath);
    await faceapi.nets.ssdMobilenetv1.loadFromUri(this.modelPath);

    console.log("Modelos cargados.");
  }

startMultiDetection({ videos, getRoomByVideo, onDetect }) {
  if (this.detecting) return;
  
  this.detecting = true;
  this.trackedByVideo = new Map();
  
  const process = async () => {
    while (this.detecting) {
      const startTime = performance.now();
      
      for (const vid of videos) {
        if (!vid || !vid._canvas || vid.readyState < 2 || !vid.videoWidth) continue;
        
        const canvas = vid._canvas;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        
        // LIMPIA
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
          const detections = await faceapi
            .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
          
          if (!this.faceMatcher || detections.length === 0) continue;
          
          for (const det of detections) {
            const bestMatch = this.faceMatcher.findBestMatch(det.descriptor);
            const label = bestMatch.distance < this.threshold ? bestMatch.label : "Desconocido";
            const room = getRoomByVideo(vid);
            
            if (onDetect) onDetect(label, room, vid);
            this.drawSingleBox(canvas, det, label);
          }
        } catch (e) {
          console.warn("Error en detección:", e);
        }
      }
      
      // mantén 60fps aproximadamente
      const elapsed = performance.now() - startTime;
      const delay = Math.max(16, 33 - elapsed); // 30fps target
      await this._sleep(delay);
    }
  };
  
  process();
}


  updatePersonLocation(name, room) {
    if (!name || name === "Desconocido") return;

    if (!this.lastRoomDetected) {
        this.lastRoomDetected = room;
        this.onNotification(`${name} detectado en ${room}`, "success");
        return;
    }

    if (this.lastRoomDetected !== room) {
        this.onNotification(`${name} salió de ${this.lastRoomDetected} y entró a ${room}`, "success");
        this.lastRoomDetected = room;
    }
}


  // Tracking helpers
  distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }

  assignTracked(x,y,w,h){
    for(const t of this.tracked){
      t.lastBoxWidth = 0;
      t.lastBoxHeight = 0;
      const dist=this.distance({x:t.smoothedX||t.x,y:t.smoothedY||t.y},{x,y});
      if(dist < this.MAX_DIST){
        const f=0.7;
        t.smoothedX = t.smoothedX*(1-f) + x*f;
        t.smoothedY = t.smoothedY*(1-f) + y*f;
        t.smoothedWidth = t.smoothedWidth*(1-f) + w*f;
        t.smoothedHeight = t.smoothedHeight*(1-f) + h*f;
        t.lastSeen=Date.now();
        t.missing=false;
        return t;
      }
    }

    const colors=['#00FF00','#FF3B30','#007AFF','#FF9500','#AF52DE','#FFCC00','#00C7BE'];
    const newT={
      x,y,width:w,height:h,
      smoothedX:x,smoothedY:y,smoothedWidth:w,smoothedHeight:h,
      color:colors[this.tracked.length % colors.length],
      lastSeen:Date.now(),missing:false, lastLabel: "Desconocido", stabilityFrames: 0
    };
    this.tracked.push(newT);
    return newT;
  }

  // Alert helpers
  showPersonEntry(name){ this.onNotification(`${name} ha entrado al cuarto`,'success'); this.activeAlerts[name]=false; }
  showPersonReturn(name){ this.onNotification(`${name} ha vuelto`,'success'); this.activeAlerts[name]=false; }
  showPersonExit(name){
    if(name === 'Desconocido')
      this.onNotification('Un desconocido ha salido del cuarto','warning');
    else
      this.onNotification(`${name} ha salido del cuarto`,'warning');

    this.activeAlerts[name]=true;
  }

  updateTrackedPersonDetection(track, label) {
    const now = Date.now();

    if (label !== 'Desconocido') {
        track.unconfirm = 0;

        if (!this.knownPeople.has(label)) {
            this.knownPeople.add(label);
            this.onNotification(`${label} ha entrado al cuarto`, "success");
        }

        track.lastSeen = now;

        if (track.alertActive) {
            this.onNotification(`${label} ha vuelto`, "success");
            track.alertActive = false;
        }

        track.lastLabel = label;
        return;
    }

    // DESCONOCIDO
    track.unconfirm = (track.unconfirm || 0) + 1;

    if (track.unconfirm >= 5) {
        if (!track.unknownShown) {
            this.onNotification(`Un desconocido ha entrado`, "warning");
            track.unknownShown = true;
        }
        track.lastSeen = now;
    }
}


  updatePersonDetection(label){
    const now = Date.now();

    // ---- ANTI-FALSOS POSITIVOS ----
    // muy pequeño → ruido
    if (this.lastBoxWidth < 20 || this.lastBoxHeight < 20) return;

    // ignore detecciones en los primeros 1.5s
    if (now - this.detectionStartedAt < 1500) return;

    // ---- LÓGICA DE PERSONAS CONOCIDAS ----
    if (label !== 'Desconocido'){
      this.unconfirmedUnknownFrames = 0; // reset

      if (!this.knownPeople.has(label)){
        this.knownPeople.add(label);
        this.showPersonEntry(label);
      }

      this.peopleLastSeen[label] = now;

      if (this.activeAlerts[label]) this.showPersonReturn(label);
      return;
    }

    // ---- DESCONOCIDO (solo confirmar después de varios frames reales) ----
    this.unconfirmedUnknownFrames++;

    if (this.unconfirmedUnknownFrames >= this.confirmUnknownAfter){
      if (!this.knownPeople.has('Desconocido')){
        this.knownPeople.add('Desconocido');
        this.onNotification('Un desconocido ha entrado al cuarto','warning');
      }
      this.peopleLastSeen['Desconocido'] = now;

      if (this.activeAlerts['Desconocido'])
        this.showPersonReturn('Desconocido');
    }
  }

  checkAllGone(){
    const now = Date.now();
    if (Object.keys(this.peopleLastSeen).length === 0) return;

    for (const p in this.peopleLastSeen){
      const t = now - this.peopleLastSeen[p];

      if (t > this.ALERT_TIMEOUT && !this.activeAlerts[p]){
        this.showPersonExit(p);
      }
    }
  }

  // Detección principal
  startDetection({canvasCtx, resizeCanvasToVideoElement, getActiveVideo, getActiveRoom}={}){
    if (this.detecting) return; // evita múltiples loops
    
    this.detecting = true;
    this.detectionStartedAt = Date.now();
    
    this._detectionLoop({
      canvasCtx,
      resizeCanvasToVideoElement,
      getActiveVideo,
      getActiveRoom
    });
  }

  stopDetection(){
    this.detecting = false;
    this.tracked = [];
    this.peopleLastSeen = {};
    this.activeAlerts = {};
    this.knownPeople = new Set();
    this.unconfirmedUnknownFrames = 0;
    this.lastRoomDetected = null;
    this.currentRoom = null;

  }

drawSingleBox(canvas, detection, label) {
  const ctx = canvas.getContext("2d");
  const { x, y, width, height } = detection.detection.box;
  
  ctx.strokeStyle = "#00FF00";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  
  ctx.fillStyle = "#00FF00";
  ctx.font = "14px Arial";
  ctx.fillText(label, x, y - 5);
}





  async _detectionLoop({canvasCtx,resizeCanvasToVideoElement,getActiveVideo, getActiveRoom}){
    const options=new faceapi.TinyFaceDetectorOptions({
      inputSize:512, scoreThreshold:0.5
    });

    while(this.detecting){
      const vid = getActiveVideo();
      if(!vid || vid.readyState < 2){
        await this._sleep(40);
        continue;
      }

      resizeCanvasToVideoElement(vid);

      canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);

      const results = await faceapi
        .detectAllFaces(vid, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const now=Date.now();
      for(let i=this.tracked.length-1;i>=0;i--) {
        const t = this.tracked[i];  // AÑADE ESTA LÍNEA
        if (now - t.lastSeen > 3000) {
          if (!t.alertActive) {
            this.onNotification(`${t.lastLabel} ha salido`, "warning");
            t.alertActive = true;
          }
          this.tracked.splice(i,1);
        }
      }


      //canvasCtx.clearRect(0,0,canvasCtx.canvas.width,canvasCtx.canvas.height);

      for(const res of results){
        const b=res.detection.box;
        const scaleX=canvasCtx.canvas._scaleX||1;
        const scaleY=canvasCtx.canvas._scaleY||1;

        const x=b.x*scaleX, y=b.y*scaleY;
        const w=b.width*scaleX, h=b.height*scaleY;

        // guardar tamaño real para anti-ruido
        this.lastBoxWidth = w;
        this.lastBoxHeight = h;

        const t=this.assignTracked(x+w/2,y+h/2,w,h);

        let label='Desconocido';
        if(this.faceMatcher){
          const best=this.faceMatcher.findBestMatch(res.descriptor);
          if(best && best.label!=='unknown') label=best.label;
        }
        // anti-confusión por persona (NO global)
if (t.lastLabel === label) {
    // sigue siendo la misma identidad → sumar frames
    t.stabilityFrames++;
} else {
    // identidad cambió → reiniciar contador
    t.stabilityFrames = 0;
}

// solo confirmar identidad si lleva X frames siendo consistente
const STABLE_FRAMES = 6;  // puedes ajustar este número

let finalLabel = t.lastLabel;

if (t.stabilityFrames >= STABLE_FRAMES) {
    finalLabel = label;
    t.lastLabel = label; // actualizar identidad confirmada
}



        this.updateTrackedPersonDetection(t, finalLabel);


 // si hay una función para saber la sala activa, úsala
if (label !== "Desconocido" && typeof getActiveRoom === 'function') {
    try {
        const room = getActiveRoom();
        if (room) this.updatePersonLocation(finalLabel, room);
    } catch (e) {
        // no interrumpe el loop si getActiveRoom falla
        console.warn('getActiveRoom error:', e);
    }
}


        // dibujo
        const sx=t.smoothedX-t.smoothedWidth/2;
        const sy=t.smoothedY-t.smoothedHeight/2;

        canvasCtx.lineWidth=Math.max(2,t.smoothedWidth/100);
        canvasCtx.strokeStyle=t.color;
        canvasCtx.strokeRect(sx,sy,t.smoothedWidth,t.smoothedHeight);

        const text=finalLabel;
        const pad=6;
        canvasCtx.font=`${Math.max(14,t.smoothedWidth/18)}px sans-serif`;

        const tw=canvasCtx.measureText(text).width + pad*2;
        const th=Math.max(26,t.smoothedHeight/9);

        let tx=sx, ty=sy+t.smoothedHeight+th+4;
        if(ty > canvasCtx.canvas.height - 5)
          ty = sy - 10;

        canvasCtx.fillStyle='rgba(0,0,0,0.65)';
        canvasCtx.fillRect(tx-2,ty-th,tw+4,th);

        canvasCtx.fillStyle='#fff';
        canvasCtx.fillText(text,tx+pad,ty-th/3);

        if (this.showDebugPoint){
          canvasCtx.beginPath();
          canvasCtx.arc(t.smoothedX,t.smoothedY,4,0,Math.PI*2);
          canvasCtx.fillStyle='red';
          canvasCtx.fill();
        }
      }

      this.checkAllGone();

      await this._sleep(40);
    }
  }

  _sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
}
