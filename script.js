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
const clearRefsBtn = document.getElementById('clearRefsBtn');
const toggleDebugBtn = document.getElementById('toggleDebugBtn');

toggleDebugBtn.addEventListener('click', () => {
    showDebugPoint = !showDebugPoint;
    toggleDebugBtn.textContent = showDebugPoint ? '⚪ Ocultar punto rojo' : '🔴 Mostrar punto rojo';
});

const thresholdInput = document.getElementById('threshold');
const thVal = document.getElementById('thVal');

let labeledDescriptors = [];
let faceMatcher = null;
let stream = null;
let detecting = false;
let showDebugPoint = false;


const colors = ['#00FF00','#FF3B30','#007AFF','#FF9500','#AF52DE','#FFCC00','#00C7BE'];
const tracked = [];
const MAX_DIST = 120;
const MAX_MISSING_TIME = 6000; // tiempo máximo en ms antes de olvidar (6s)

// ======================================================
// SISTEMA DE ALERTAS (versión completa multipersona)
// ======================================================

const ALERT_TIMEOUT = 10000; // 10 segundos sin verse

// Estado de cada persona
let peopleLastSeen = {};  // { "Kevin": timestamp }
let activeAlerts = {};    // { "Kevin": true/false }
let knownPeople = new Set(); // personas ya detectadas alguna vez

// --- Crear una notificación visual ---
function createNotification(message, type = 'warning') {
    const container = document.getElementById('notificationContainer');

    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerHTML = `
        <div style="
        display: flex;
        align-items: center;
        gap: 10px;
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
        <span style="font-size: 20px;">${type === 'warning' ? '⚠️' : '✅'}</span>
        <span>${message}</span>
        </div>
    `;
    container.appendChild(notif);

    // Animación de entrada
    requestAnimationFrame(() => {
        notif.firstElementChild.style.opacity = '1';
        notif.firstElementChild.style.transform = 'translateY(0)';
    });

    // 🔔 Desaparecer automáticamente después de X segundos
    const timeout = type === 'warning' ? 5000 : 3000; // 5s para rojo, 3s para verde
    setTimeout(() => removeNotification(notif), timeout);
}


// --- Eliminar notificación ---
function removeNotification(notif) {
    if (!notif) return;
    notif.firstElementChild.style.opacity = '0';
    notif.firstElementChild.style.transform = 'translateY(10px)';
    setTimeout(() => notif.remove(), 400);
}

// --- Mostrar tipos de alertas ---
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



// --- Actualizar detección ---
function updatePersonDetection(label) {
    const now = Date.now();

    if (label && label !== 'Desconocido') {
        const seenBefore = knownPeople.has(label);

        // Registrar nueva persona
        if (!seenBefore) {
            knownPeople.add(label);
            showPersonEntry(label);
        }

        // Actualizar último tiempo visto
        peopleLastSeen[label] = now;

        // Si tenía una alerta activa (se había ido) y vuelve
        if (activeAlerts[label]) {
            showPersonReturn(label);
        }
    }

    // Comprobar si alguien lleva más de X segundos sin verse
    for (const person in peopleLastSeen) {
        const timeSinceSeen = now - peopleLastSeen[person];
        if (timeSinceSeen > ALERT_TIMEOUT && !activeAlerts[person]) {
            showPersonAlert(person);
        }
    }
}



function resizeCanvasToVideo() {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Ajusta el tamaño del canvas al tamaño visible del video (en píxeles reales en pantalla)
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Guarda el factor de escala entre las dimensiones reales y las visuales
    canvas._scaleX = rect.width / videoWidth;
    canvas._scaleY = rect.height / videoHeight;
}


function distance(a,b){
    const dx = a.x - b.x; const dy = a.y - b.y;
    return Math.sqrt(dx*dx+dy*dy);
}

function assignTracked(x, y) {
    // Buscar coincidencia cercana
    for (const t of tracked) {
        if (distance(t, { x, y }) < MAX_DIST) {
            t.x = x;
            t.y = y;
            t.lastSeen = Date.now();
            t.missing = false;
            return t;
        }
    }
    // Nueva persona
    const color = colors[tracked.length % colors.length];
    const newT = { x, y, color, lastSeen: Date.now(), missing: false };
    tracked.push(newT);
    return newT;
}


async function loadModels(){
    statusEl.textContent = 'Cargando modelos...';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);
    statusEl.textContent = 'Modelos cargados.';
}

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

function renderRefItem(name, file){
  let div = document.createElement('div');
  div.className = 'ref-item';
  if(file){
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.src = url;
    div.appendChild(img);
  }
  const span = document.createElement('span');
  span.textContent = name;
  div.appendChild(span);
  if(refList.textContent.trim() === 'No hay referencias aún.') refList.textContent='';
  refList.appendChild(div);
}

startBtn.addEventListener('click', async ()=>{
  try{
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    video.srcObject = stream;
    await video.play();
    resizeCanvasToVideo();
    window.addEventListener('resize', resizeCanvasToVideo);
    detecting = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    runDetectionLoop();
  }catch(err){
    alert('Error al acceder a la cámara: ' + err.message);
  }
});

stopBtn.addEventListener('click', ()=>{
  detecting = false;
  startBtn.disabled=false;
  stopBtn.disabled=true;
  if(stream) stream.getTracks().forEach(t=>t.stop());
  ctx.clearRect(0,0,canvas.width,canvas.height);
});

thresholdInput.addEventListener('input', ()=>{
  thVal.textContent = thresholdInput.value;
  updateMatcher();
});

async function runDetectionLoop(){
  const options = new faceapi.TinyFaceDetectorOptions({inputSize: 320, scoreThreshold: 0.5});
  while(detecting){
    const results = await faceapi.detectAllFaces(video, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    ctx.clearRect(0,0,canvas.width,canvas.height);
    const now = Date.now();
    
    for(let i=tracked.length-1;i>=0;i--)
      if(now - tracked[i].lastSeen > 3000) tracked.splice(i,1);

    for (const res of results) {
  // Coordenadas reales del rostro (sin redimensionar con faceapi)
  const box = res.detection.box;

  // Convertir coordenadas al tamaño visible del video
  const scaleX = canvas._scaleX || 1;
  const scaleY = canvas._scaleY || 1;

  const x = box.x * scaleX;
  const y = box.y * scaleY;
  const width = box.width * scaleX;
  const height = box.height * scaleY;
  const xCenter = x + width / 2;
  const yCenter = y + height / 2;

  // Seguimiento persistente
  const t = assignTracked(xCenter, yCenter);

  // Coincidencia de persona
  let label = 'Desconocido';
  if (faceMatcher) {
    const best = faceMatcher.findBestMatch(res.descriptor);
    if (best && best.label !== 'unknown') label = best.label;

     // 🔔 Actualizar alertas
    updatePersonDetection(label);
  }

  // --- Rectángulo perfectamente alineado ---
  ctx.lineWidth = Math.max(2, width / 100);
  ctx.strokeStyle = t.color;
  ctx.strokeRect(x, y, width, height);

  // --- Etiqueta debajo ---
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

  // --- DEPURACIÓN: punto rojo en el centro del rostro (solo si está activado) ---
if (showDebugPoint) {
  ctx.beginPath();
  ctx.arc(xCenter, yCenter, 4, 0, 2 * Math.PI);
  ctx.fillStyle = 'red';
  ctx.fill();
}

}




    await new Promise(r=>setTimeout(r,100));
  }
}

// --- Guardado en localStorage ---
function saveReferencesToLocalStorage() {
  try {
    const data = labeledDescriptors.map(ld => ({
      label: ld.label,
      descriptors: ld.descriptors.map(d => Array.from(d))
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

clearRefsBtn.addEventListener('click', () => {
  localStorage.removeItem('faceRefs');
  labeledDescriptors = [];
  refList.textContent = 'No hay referencias aún.';
  updateMatcher();
  statusEl.textContent = 'Referencias locales eliminadas.';
});

// init
(async ()=>{
  await loadModels();
  await loadReferencesFromLocalStorage();
  statusEl.textContent = 'Modelos listos. Puedes agregar o usar las referencias guardadas.';
})();
