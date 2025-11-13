// Rutas y elementos
const MODEL_PATH = '/models';
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const addRefForm = document.getElementById('addRefForm');
const refNameInput = document.getElementById('refName');
const refFilesInput = document.getElementById('refFiles');
const refList = document.getElementById('refList');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const prevCamBtn = document.getElementById('prevCamBtn');
const nextCamBtn = document.getElementById('nextCamBtn');
const camNameEl = document.getElementById('camName');
const remoteList = document.getElementById('remoteList');
const clearRefsBtn = document.getElementById('clearRefsBtn');
const toggleDebugBtn = document.getElementById('toggleDebugBtn');
const thresholdInput = document.getElementById('threshold');
const thVal = document.getElementById('thVal');

let labeledDescriptors = [];
let faceMatcher = null;
let stream = null;
let detecting = false;
let showDebugPoint = false;

let videoDevices = [];
let currentCamIndex = 0;
let currentDeviceId = null;

// Remote feeds management (soporte hasta 5)
const MAX_REMOTE_FEEDS = 5;
const remoteVideos = {};   // { senderId: videoElement }
const remoteStreams = {};  // { senderId: MediaStream }
const receiverPCs = {};    // { senderId: RTCPeerConnection }

const colors = ['#00FF00','#FF3B30','#007AFF','#FF9500','#AF52DE','#FFCC00','#00C7BE'];
const tracked = [];
const MAX_DIST = 120;

const ALERT_TIMEOUT = 10000;
let peopleLastSeen = {};
let activeAlerts = {};
let knownPeople = new Set();

const bc = new BroadcastChannel("webrtc-signal");

// ---------- Utilidades UI / notificaciones (copié/ligeramente adaptado) ----------
function createNotification(message, type = 'warning') {
    const container = document.getElementById('notificationContainer');
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-CO', { hour12: false });
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            gap: 4px;
            background: ${type === 'warning' ? '#ff4d4d' : '#4caf50'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.25);
            min-width: 260px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 15px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.4s ease;
        ">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${type === 'warning' ? '⚠️' : '✅'}</span>
                <span>${message}</span>
            </div>
            <div style="text-align: right; font-size: 13px; opacity: 0.85;">
                🕒 ${timeString}
            </div>
        </div>
    `;
    container.appendChild(notif);
    requestAnimationFrame(() => {
        notif.firstElementChild.style.opacity = '1';
        notif.firstElementChild.style.transform = 'translateY(0)';
    });
    setTimeout(() => removeNotification(notif), type === 'warning' ? 5000 : 3000);

    try {
        const logs = JSON.parse(localStorage.getItem("notificationLog")) || [];
        logs.push({ id, message, type, time: timeString });
        if (logs.length > 100) logs.shift();
        localStorage.setItem("notificationLog", JSON.stringify(logs));
    } catch(e){}
}
function removeNotification(notif) {
    if (!notif) return;
    notif.firstElementChild.style.opacity = '0';
    notif.firstElementChild.style.transform = 'translateY(10px)';
    setTimeout(() => notif.remove(), 400);
}

// ---------- Detección de rostros / helpers ----------
function resizeCanvasToVideoElement(vid) {
    if (!vid || vid.videoWidth === 0 || vid.videoHeight === 0) {
        const rect = vid.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas._scaleX = 1;
        canvas._scaleY = 1;
        return;
    }
    const rect = vid.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas._scaleX = rect.width / vid.videoWidth;
    canvas._scaleY = rect.height / vid.videoHeight;
}

function distance(a,b){
    const dx = a.x - b.x; const dy = a.y - b.y;
    return Math.sqrt(dx*dx+dy*dy);
}
function assignTracked(x, y) {
    for (const t of tracked) {
        if (distance(t, { x, y }) < MAX_DIST) {
            t.x = x; t.y = y; t.lastSeen = Date.now(); t.missing = false;
            return t;
        }
    }
    const color = colors[tracked.length % colors.length];
    const newT = { x, y, color, lastSeen: Date.now(), missing: false };
    tracked.push(newT);
    return newT;
}

// ---------- Cargar modelos y cámaras ----------
async function loadModels(){
    statusEl.textContent = 'Cargando modelos...';

    // Pedir permiso para poder obtener labels en enumerateDevices
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (e) {
        console.warn("No se pudo obtener permiso de cámara (labels podrían estar ocultos):", e);
    }

    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_PATH);

    statusEl.textContent = 'Modelos cargados. Cargando cámaras...';
    await loadCameras();
}

async function loadCameras(){
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(d => d.kind === 'videoinput').map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Cámara ${i+1}`
        }));

        // Añadimos entradas para cada remote feed ya conectado (si existen)
        for (const sid of Object.keys(remoteVideos)) {
            if (!videoDevices.some(v => v.deviceId === `remote-${sid}`)) {
                videoDevices.push({ deviceId: `remote-${sid}`, label: `Cámara remota ${sid}`});
            }
        }

        if (videoDevices.length === 0) {
            statusEl.textContent = '❌ No se encontraron cámaras.';
            return;
        }

        currentCamIndex = 0;
        currentDeviceId = videoDevices[currentCamIndex].deviceId;
        updateCamName();
    } catch(err){
        console.error('Error listando cámaras:', err);
    }
}

// ---------- UI / cam switching ----------
function updateCamName(){
    const cam = videoDevices[currentCamIndex];
    const label = cam?.label || `Cámara ${currentCamIndex+1}`;
    camNameEl.textContent = `🎥 ${label} (${currentCamIndex + 1} de ${videoDevices.length})`;
    currentDeviceId = cam?.deviceId;
}

async function switchCamera(indexChange){
    if (videoDevices.length === 0) return;
    currentCamIndex = (currentCamIndex + indexChange + videoDevices.length) % videoDevices.length;
    updateCamName();

    const selected = videoDevices[currentCamIndex];
    if (!selected) return;

    // Si remote
    if (selected.deviceId.startsWith('remote-')) {
        const senderId = selected.deviceId.replace('remote-','');
        const rv = remoteVideos[senderId];
        if (rv && rv.srcObject) {
            // Esconder local y mostrar remoto (el canvas se ajustará al remoto)
            video.style.display = 'none';
            rv.style.display = 'block';
            resizeCanvasToVideoElement(rv);
        } else {
            createNotification('⚠️ Feed remoto no disponible (aún).', 'warning');
        }
        return;
    }

    // Local camera
    try {
        // detener cualquier stream anterior
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selected.deviceId } }, audio: false });
        video.srcObject = stream;
        video.style.display = 'block';
        // esconder cualquier remote video visible
        for (const rv of Object.values(remoteVideos)) rv.style.display = 'none';
        await video.play();
        resizeCanvasToVideoElement(video);
    } catch (err) {
        console.error('Error cambiando de cámara:', err);
        createNotification('Error al activar cámara local: ' + err.message, 'warning');
    }
}

// ---------- Start / Stop ----------
startBtn.addEventListener('click', async () => {
    try {
        const cam = videoDevices[currentCamIndex];
        // Si es remoto, solo aseguramos que la UI muestre el remoto y empezamos detección
        if (cam.deviceId.startsWith('remote-')) {
            const sid = cam.deviceId.replace('remote-','');
            if (!remoteVideos[sid]) {
                createNotification('Feed remoto no conectado aún.', 'warning');
                return;
            }
            detecting = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            runDetectionLoop();
            return;
        }

        // local camera start
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();
        resizeCanvasToVideoElement(video);
        window.addEventListener('resize', () => resizeCanvasToVideoElement(getActiveVideoElement()));
        detecting = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        runDetectionLoop();
    } catch (err) {
        alert('Error al acceder a la cámara: ' + err.message);
    }
});

stopBtn.addEventListener('click', ()=>{
    detecting = false;
    startBtn.disabled=false;
    stopBtn.disabled=true;
    if (stream) stream.getTracks().forEach(t=>t.stop());
    ctx.clearRect(0,0,canvas.width,canvas.height);
});

// ---------- References (cargar, guardar, añadir) ----------
async function addReferenceImages(name, files){
    const descriptors = [];
    for(const f of files){
        const img = await faceapi.bufferToImage(f);
        const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        if(!detection){ console.warn('No se detectó cara en', f.name); continue; }
        descriptors.push(detection.descriptor);
    }
    if(descriptors.length === 0) return null;
    const labeled = new faceapi.LabeledFaceDescriptors(name, descriptors);
    labeledDescriptors.push(labeled);
    updateMatcher();
    saveReferencesToLocalStorage();
    return labeled;
}

function updateMatcher(){
    if(labeledDescriptors.length > 0){
        const threshold = parseFloat(thresholdInput.value);
        faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
    } else {
        faceMatcher = null;
    }
}

addRefForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = refNameInput.value.trim();
    const files = [...refFilesInput.files];
    if(!name || files.length===0){
        alert('Pon un nombre y elige al menos una imagen.');
        return;
    }
    statusEl.textContent = `Procesando referencias para ${name}...`;
    const labeled = await addReferenceImages(name, files);
    if(labeled){
        renderRefItem(name, files[0]);
        statusEl.textContent = `Referencia "${name}" agregada.`;
    } else {
        statusEl.textContent = `No se pudo generar descriptor para "${name}".`;
    }
    refNameInput.value = '';
    refFilesInput.value = null;
});

function renderRefItem(name, file) {
    const div = document.createElement('div');
    div.className = 'ref-item';
    div.dataset.name = name;

    if (file) {
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url;
      div.appendChild(img);
    }

    const span = document.createElement('span');
    span.textContent = name;
    div.appendChild(span);

    if (refList.textContent.trim() === 'No hay referencias aún.') refList.textContent = '';
    refList.appendChild(div);

    div.addEventListener('click', async () => {
      const addMoreInput = document.getElementById('addMoreFiles');
      addMoreInput.value = '';
      addMoreInput.click();

      addMoreInput.onchange = async (e) => {
        const files = [...e.target.files];
        if (!files.length) return;
        statusEl.textContent = `Agregando más referencias para ${name}...`;

        const descriptors = [];
        for (const f of files) {
          const img = await faceapi.bufferToImage(f);
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) descriptors.push(detection.descriptor);
          else console.warn(`No se detectó rostro en ${f.name}`);
        }

        const existing = labeledDescriptors.find(ld => ld.label === name);
        if (existing && descriptors.length) {
          existing.descriptors.push(...descriptors);
          updateMatcher();
          saveReferencesToLocalStorage();
          statusEl.textContent = `✅ ${files.length} nuevas imágenes añadidas a "${name}".`;
        } else {
          statusEl.textContent = `⚠️ No se pudieron añadir referencias a "${name}".`;
        }
      };
    });
}

// ---------- Guardado / carga localStorage ----------
function saveReferencesToLocalStorage() {
  try {
    const data = labeledDescriptors.map(ld => ({
      label: ld.label,
      descriptors: ld.descriptors.map(d => Array.from(new Float32Array(d)))
    }));
    localStorage.setItem('faceRefs', JSON.stringify(data));
    statusEl.textContent = 'Referencias guardadas localmente.';
  } catch (err) {
    console.error('Error guardando referencias:', err);
  }
}

async function loadReferencesFromLocalStorage() {
    const saved = localStorage.getItem('faceRefs');
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        labeledDescriptors = parsed.map(p =>
        new faceapi.LabeledFaceDescriptors(p.label, p.descriptors.map(d => new Float32Array(d)))
        );
        updateMatcher();
        for (const ref of parsed) renderRefItem(ref.label, null);
        statusEl.textContent = 'Referencias cargadas desde almacenamiento local.';
    } catch (err) {
        console.error('Error cargando referencias:', err);
    }
}

// ---------- Loop de detección (usa el video activo) ----------
function getActiveVideoElement() {
    const selected = videoDevices[currentCamIndex];
    if (selected && selected.deviceId && selected.deviceId.startsWith('remote-')) {
        const sid = selected.deviceId.replace('remote-','');
        return remoteVideos[sid] || video;
    }
    return video;
}

async function runDetectionLoop(){
    const options = new faceapi.TinyFaceDetectorOptions({inputSize: 320, scoreThreshold: 0.5});
    while(detecting){
        const vid = getActiveVideoElement();
        if (!vid || (vid.readyState < 2)) {
            await new Promise(r=>setTimeout(r,100));
            continue;
        }

        resizeCanvasToVideoElement(vid);

        const results = await faceapi.detectAllFaces(vid, options)
            .withFaceLandmarks()
            .withFaceDescriptors();

        ctx.clearRect(0,0,canvas.width,canvas.height);
        const now = Date.now();

        for(let i=tracked.length-1;i>=0;i--)
            if(now - tracked[i].lastSeen > 3000) tracked.splice(i,1);

        for (const res of results) {
            const box = res.detection.box;
            const scaleX = canvas._scaleX || 1;
            const scaleY = canvas._scaleY || 1;

            const x = box.x * scaleX;
            const y = box.y * scaleY;
            const width = box.width * scaleX;
            const height = box.height * scaleY;
            const xCenter = x + width / 2;
            const yCenter = y + height / 2;

            const t = assignTracked(xCenter, yCenter);

            let label = 'Desconocido';
            if (faceMatcher) {
                const best = faceMatcher.findBestMatch(res.descriptor);
                if (best && best.label !== 'unknown') label = best.label;
                updatePersonDetection(label);
            }

            ctx.lineWidth = Math.max(2, width / 100);
            ctx.strokeStyle = t.color;
            ctx.strokeRect(x, y, width, height);

            const padding = 6;
            ctx.font = `${Math.max(14, width / 18)}px sans-serif`;
            const text = label;
            const textW = ctx.measureText(text).width + padding * 2;
            const textH = Math.max(26, height / 9);

            let tagX = x;
            let tagY = y + height + textH + 4;
            if (tagY > canvas.height - 5) tagY = y - 10;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(tagX - 2, tagY - textH, textW + 4, textH);
            ctx.fillStyle = '#fff';
            ctx.fillText(text, tagX + padding, tagY - textH / 3);

            if (showDebugPoint) {
                ctx.beginPath();
                ctx.arc(xCenter, yCenter, 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
            }
        }

        checkAllGone();
        await new Promise(r=>setTimeout(r,100));
    }
}

// ---------- Alert system (like antes) ----------
function updatePersonDetection(label) {
    const now = Date.now();

    if (label && label !== 'Desconocido') {
        const seenBefore = knownPeople.has(label);
        if (!seenBefore) {
            knownPeople.add(label);
            showPersonEntry(label);
        }
        peopleLastSeen[label] = now;
        if (activeAlerts[label]) showPersonReturn(label);
    }

    if (label === 'Desconocido') {
        const name = 'Desconocido';
        const seenBefore = knownPeople.has(name);
        if (!seenBefore) {
            knownPeople.add(name);
            createNotification('⚠️ Un desconocido ha entrado al cuarto', 'warning');
        }
        peopleLastSeen[name] = now;
        if (activeAlerts[name]) {
            createNotification('⚠️ Un desconocido ha vuelto a aparecer', 'warning');
            activeAlerts[name] = false;
        }
    }
}

function showPersonAlert(personName) {
    if (!activeAlerts[personName]) {
        createNotification(`⚠️ ${personName} ha salido del cuarto`, 'warning');
        activeAlerts[personName] = true;
    }
}
function showPersonReturn(personName) {
    createNotification(`✅ ${personName} ha vuelto`, 'success');
    activeAlerts[personName] = false;
}
function showPersonEntry(personName) {
    createNotification(`✅ ${personName} ha entrado al cuarto`, 'success');
    activeAlerts[personName] = false;
}

function checkAllGone() {
    const now = Date.now();
    if (Object.keys(peopleLastSeen).length === 0) return;
    let allGone = true;
    let someoneReturned = false;
    for (const person in peopleLastSeen) {
        const timeSinceSeen = now - peopleLastSeen[person];
        if (timeSinceSeen > ALERT_TIMEOUT && !activeAlerts[person]) {
            if (person === 'Desconocido') {
                createNotification('⚠️ Un desconocido ha salido del cuarto', 'warning');
            } else {
                showPersonAlert(person);
            }
            activeAlerts[person] = true;
        }
        if (timeSinceSeen <= ALERT_TIMEOUT) {
            allGone = false;
            if (activeAlerts[person]) {
                someoneReturned = true;
                activeAlerts[person] = false;
            }
        }
    }
    if (allGone) {
        const anyActive = Object.values(activeAlerts).some((v) => v);
        if (!anyActive) {
            createNotification(`⚠️ Todos se han ido del cuarto`, 'warning');
            for (const p in peopleLastSeen) activeAlerts[p] = true;
        }
    } else if (someoneReturned) {
        createNotification(`✅ Alguien ha vuelto al cuarto`, 'success');
    }
}

// ---------- Remote feed management (WebRTC via BroadcastChannel) ----------
bc.onmessage = async (ev) => {
    const data = ev.data || {};
    const { type } = data;

    if (type === 'offer') {
        const from = data.from;
        const offer = data.offer;
        if (!from || !offer) return;

        // Limitar número de feeds remotos
        if (Object.keys(remoteVideos).length >= MAX_REMOTE_FEEDS && !receiverPCs[from]) {
            console.warn("Máximo de feeds remotos alcanzado. Ignorando offer de", from);
            createNotification(`Se ha rechazado feed remoto de ${from}: máximo alcanzado`, 'warning');
            return;
        }

        // Crear RTCPeerConnection para este sender
        if (receiverPCs[from]) {
            console.log("Ya existe PC para", from);
            return;
        }

        const pc = new RTCPeerConnection();
        receiverPCs[from] = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                bc.postMessage({ type: 'ice', to: from, ice: e.candidate });
            }
        };

        pc.ontrack = (e) => {
            console.log("✅ Feed remoto conectado desde", from);
            const remoteStream = e.streams[0];
            registerRemoteFeed(from, remoteStream);
        };

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            bc.postMessage({ type: 'answer', to: from, answer: pc.localDescription.toJSON() });
        } catch (err) {
            console.error("Error procesando offer:", err);
        }
    } else if (type === 'answer') {
        // No hay acción en receptor; los senders reciben las answers
    } else if (type === 'ice') {
        // ICE enviado desde sender al receiver o viceversa
        const to = data.to;
        const from = data.from;
        const ice = data.ice;
        // si el message es para el receptor (to === undefined), o es para un pc que existe
        if (to && receiverPCs[to]) {
            // receiver recibiendo ICE para su pc con id=to (cuando receiver envía a sender)
            try { receiverPCs[to].addIceCandidate(new RTCIceCandidate(ice)); } catch(e){ console.warn(e); }
        } else if (from && receiverPCs[from]) {
            try { receiverPCs[from].addIceCandidate(new RTCIceCandidate(ice)); } catch(e){ console.warn(e); }
        }
    }
};

function registerRemoteFeed(senderId, stream) {
    // Si ya tenemos este feed, reemplazamos
    if (remoteVideos[senderId]) {
        remoteVideos[senderId].srcObject = stream;
        remoteStreams[senderId] = stream;
        return;
    }

    // Crear video oculto dentro de remoteList (y también lo guardamos)
    const videoEl = document.createElement('video');
    videoEl.className = 'remote-video';
    videoEl.autoplay = true;
    videoEl.playsinline = true;
    videoEl.muted = true;
    videoEl.srcObject = stream;
    videoEl.id = `remote-video-${senderId}`;

    videoEl.onloadedmetadata = () => {
        // ajustar canvas si actualmente es la cámara seleccionada
        if (videoDevices[currentCamIndex]?.deviceId === `remote-${senderId}`) {
            video.style.display = 'none';
            videoEl.style.display = 'block';
            resizeCanvasToVideoElement(videoEl);
        }
    };

    // Mostrar thumbnail small para el usuario y permitir seleccionar la cámara remota
    const thumbWrap = document.createElement('div');
    thumbWrap.style.display = 'flex';
    thumbWrap.style.flexDirection = 'column';
    thumbWrap.style.alignItems = 'center';
    thumbWrap.style.gap = '6px';

    const thumb = document.createElement('video');
    thumb.width = 160;
    thumb.height = 90;
    thumb.style.borderRadius = '8px';
    thumb.autoplay = true;
    thumb.muted = true;
    thumb.playsinline = true;
    thumb.srcObject = stream;

    const label = document.createElement('div');
    label.style.fontSize = '13px';
    label.style.color = '#fff';
    label.textContent = `Remoto ${senderId}`;

    thumbWrap.appendChild(thumb);
    thumbWrap.appendChild(label);

    thumbWrap.onclick = () => {
        // si hacemos click, agregamos la cámara remota a videoDevices (si aún no) y cambiamos a ella
        if (!videoDevices.some(v => v.deviceId === `remote-${senderId}`)) {
            videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}`});
        }
        updateCamName();
        // buscar index del remote inserted
        const idx = videoDevices.findIndex(v => v.deviceId === `remote-${senderId}`);
        if (idx >= 0) {
            currentCamIndex = idx;
            switchCamera(0);
        }
    };

    remoteList.appendChild(thumbWrap);

    // Añadimos al DOM (oculto) y guardamos referencias
    document.body.appendChild(videoEl);
    remoteVideos[senderId] = videoEl;
    remoteStreams[senderId] = stream;

    // Asegurarnos que la lista de cámaras refleje este nuevo remote
    if (!videoDevices.some(v => v.deviceId === `remote-${senderId}`)) {
        videoDevices.push({ deviceId: `remote-${senderId}`, label: `Cámara remota ${senderId}`});
    }
    updateCamName();
}

// ---------- ICE & signaling desde receptor: nos encargamos de ICE en bc.onmessage arriba ----------

// ---------- Botones prev/next ----------
prevCamBtn.addEventListener('click', () => switchCamera(-1));
nextCamBtn.addEventListener('click', () => switchCamera(1));

// ---------- toggle debug ----------
toggleDebugBtn.addEventListener('click', () => {
    showDebugPoint = !showDebugPoint;
    toggleDebugBtn.textContent = showDebugPoint ? '⚪ Ocultar punto rojo' : '🔴 Mostrar punto rojo';
});

// ---------- threshold ----------
thresholdInput.addEventListener('input', ()=>{
    thVal.textContent = thresholdInput.value;
    updateMatcher();
});

// ---------- force reload references (si existe) ----------
document.getElementById('forceReloadBtn').addEventListener('click', async () => {
    await loadReferencesFromFolder(true);
});

// ---------- load references from folder (igual que antes) ----------
async function loadReferencesFromFolder(forceReload = false) {
    try {
      const res = await fetch('./references/references.json?_=' + Date.now());
      if (!res.ok) throw new Error('No se pudo cargar references.json');
      const data = await res.json();

      statusEl.textContent = '🔍 Revisando referencias en carpeta...';
      let newRefsCount = 0;

      for (const [name, files] of Object.entries(data)) {
        const existing = labeledDescriptors.find(ld => ld.label === name);
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

            if (detection) {
              descriptors.push(detection.descriptor);
            } else {
              createNotification(`No se detectó rostro en ${name}/${file}`, 'warning');
            }
          } catch (err) {
            createNotification(`Error leyendo ${name}/${file}`, 'warning');
          }
        }

        if (descriptors.length) {
          if (existing) {
            existing.descriptors.push(...descriptors);
          } else {
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(name, descriptors));
            renderRefItem(name, null);
          }
          newRefsCount++;
        }
      }

      if (newRefsCount > 0) {
        updateMatcher();
        saveReferencesToLocalStorage();
        statusEl.textContent = `✅ ${newRefsCount} nuevas referencias cargadas desde carpeta.`;
      } else {
        statusEl.textContent = '📁 No se encontraron nuevas referencias.';
      }
    } catch (err) {
      console.error('Error cargando referencias desde carpeta:', err);
      statusEl.textContent = '⚠️ Error al cargar referencias desde carpeta.';
    }
}

// ---------- Clear refs ----------
clearRefsBtn.addEventListener('click', () => {
    localStorage.removeItem('faceRefs');
    labeledDescriptors = [];
    refList.textContent = 'No hay referencias aún.';
    updateMatcher();
    statusEl.textContent = 'Referencias locales eliminadas.';
});

// ---------- Inicialización ----------
(async () => {
  await loadModels();
  await loadReferencesFromLocalStorage();
  await loadReferencesFromFolder(false);
  statusEl.textContent = '✅ Modelos y referencias listos.';
})();

