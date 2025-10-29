// script.js - Reconocimiento facial local completo
// Requiere: face-api.js cargado en la página y carpeta /models con los pesos

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
const thresholdInput = document.getElementById('threshold');
const thVal = document.getElementById('thVal');

// Botón toggle debug (asegúrate que exista en HTML con id toggleDebugBtn)
const toggleDebugBtn = document.getElementById('toggleDebugBtn');

// --- Calibración para distancia ---
const FACE_REAL_WIDTH_CM = 14.0; // promedio rostro humano
let FOCAL_LENGTH_PX = null; // se calcula una vez


let labeledDescriptors = [];
let faceMatcher = null;
let stream = null;
let detecting = false;

const colors = ['#00FF00','#FF3B30','#007AFF','#FF9500','#AF52DE','#FFCC00','#00C7BE'];
const tracked = []; // { x, y, w, h, color, lastSeen, missing }
const MAX_DIST = 120;      // px, distancia para considerar mismo tracked
const MAX_MISSING_TIME = 6000; // ms antes de olvidar un tracked
let showDebugPoint = false; // toggle mediante botón

// --- Sistema de alertas tipo barra ---
let mainPersonLabel = null;
let lastSeenMain = Date.now();
const ALERT_TIMEOUT = 10000; // 10 segundos
let alertActive = false;

function createNotification(message, type = 'warning') {
  const container = document.getElementById('notificationContainer');

  // Crear elemento notificación
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
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      min-width: 240px;
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

  // Desaparece después de unos segundos si es aviso positivo
  if (type === 'success') {
    setTimeout(() => removeNotification(notif), 3000);
  }
}

function removeNotification(notif) {
  if (!notif) return;
  notif.firstElementChild.style.opacity = '0';
  notif.firstElementChild.style.transform = 'translateY(10px)';
  setTimeout(() => notif.remove(), 400);
}

// Mostrar alerta de que la persona salió
function showPersonAlert(personName) {
  if (!alertActive) {
    createNotification(`⚠️ ${personName} ha salido del cuarto`, 'warning');
    alertActive = true;
  }
}

// Mostrar notificación de regreso
function showPersonReturn(personName) {
  createNotification(`✅ ${personName} ha vuelto`, 'success');
  alertActive = false;
}




// escala para mapear coordenadas reales del video -> pixels visuales
canvas._scaleX = 1;
canvas._scaleY = 1;

// ------------------ UTILIDADES ------------------

function resizeCanvasToVideo() {
  // Ajusta canvas al tamaño visible del video (en pantalla)
  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;
  const rect = video.getBoundingClientRect();

  // Si video aún no tiene dimensiones razonables, usar dimensiones naturales
  // Establecemos canvas al tamaño visible
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);

  // Calculamos factor de escala entre coordenadas del stream (video.videoWidth) y el tamaño visible
  // Evitar división por cero
  canvas._scaleX = videoWidth > 0 ? (rect.width / videoWidth) : 1;
  canvas._scaleY = videoHeight > 0 ? (rect.height / videoHeight) : 1;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// assignTracked ahora almacena también w,h para poder mostrar "persona perdida" en su último tamaño conocido
function assignTracked(x, y, w, h) {
  for (const t of tracked) {
    if (distance(t, { x, y }) < MAX_DIST) {
      t.x = x; t.y = y; t.w = w; t.h = h;
      t.lastSeen = Date.now();
      t.missing = false;
      return t;
    }
  }
  const color = colors[tracked.length % colors.length];
  const newT = { x, y, w, h, color, lastSeen: Date.now(), missing: false };
  tracked.push(newT);
  return newT;
}

// ------------------ MODELOS y REFERENCIAS ------------------

async function loadModels() {
  statusEl.textContent = 'Cargando modelos...';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);
  statusEl.textContent = 'Modelos cargados.';
}

// Añade imágenes de referencia (archivos Filelist) y crea descriptors
async function addReferenceImages(name, files) {
  const descriptors = [];
  for (const f of files) {
    try {
      const img = await faceapi.bufferToImage(f);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        console.warn('No se detectó cara en', f.name);
        continue;
      }
      descriptors.push(detection.descriptor);
    } catch (err) {
      console.error('Error procesando referencia', f.name, err);
    }
  }
  if (descriptors.length === 0) return null;
  const labeled = new faceapi.LabeledFaceDescriptors(name, descriptors);
  labeledDescriptors.push(labeled);
  updateMatcher();
  saveReferencesToLocalStorage();
  return labeled;
}

function updateMatcher() {
  if (labeledDescriptors.length > 0) {
    const threshold = parseFloat(thresholdInput.value);
    faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
  } else {
    faceMatcher = null;
  }
}

function renderRefItem(name, file) {
  const div = document.createElement('div');
  div.className = 'ref-item';
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
}

// ------------------ LOCAL STORAGE ------------------

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
    labeledDescriptors = parsed.map(p => new faceapi.LabeledFaceDescriptors(
      p.label, p.descriptors.map(d => new Float32Array(d))
    ));
    updateMatcher();
    for (const ref of parsed) renderRefItem(ref.label, null);
    statusEl.textContent = 'Referencias cargadas desde almacenamiento local.';
  } catch (err) {
    console.error('Error cargando referencias:', err);
  }
}

// ------------------ EVENTOS UI ------------------

addRefForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = refNameInput.value.trim();
  const files = [...refFilesInput.files];
  if (!name || files.length === 0) {
    alert('Pon un nombre y elige al menos una imagen.');
    return;
  }
  statusEl.textContent = `Procesando referencias para ${name}...`;
  const labeled = await addReferenceImages(name, files);
  if (labeled) {
    renderRefItem(name, files[0]);
    statusEl.textContent = `Referencia "${name}" agregada.`;
  } else {
    statusEl.textContent = `No se pudo generar descriptor para "${name}".`;
  }
  refNameInput.value = '';
  refFilesInput.value = null;
});

clearRefsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todas las referencias guardadas?')) return;
  localStorage.removeItem('faceRefs');
  labeledDescriptors = [];
  refList.textContent = 'No hay referencias aún.';
  updateMatcher();
  statusEl.textContent = 'Referencias locales eliminadas.';
});

thresholdInput.addEventListener('input', () => {
  thVal.textContent = thresholdInput.value;
  updateMatcher();
});

// Start / Stop camera
startBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = stream;
    await video.play();
    resizeCanvasToVideo();
    window.addEventListener('resize', resizeCanvasToVideo);
    detecting = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    runDetectionLoop();
  } catch (err) {
    alert('Error al acceder a la cámara: ' + err.message);
  }
});

stopBtn.addEventListener('click', () => {
  detecting = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  if (stream) stream.getTracks().forEach(t => t.stop());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Toggle debug point button (asegúrate de que exista en HTML)
if (toggleDebugBtn) {
  toggleDebugBtn.addEventListener('click', () => {
    showDebugPoint = !showDebugPoint;
    toggleDebugBtn.textContent = showDebugPoint ? '⚪ Ocultar punto rojo' : '🔴 Mostrar punto rojo';
  });
}

// ------------------ BUCLE DE DETECCIÓN ------------------

async function runDetectionLoop() {
  // Opciones para TinyFaceDetector (ajustables)
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

  while (detecting) {
    // detectAllFaces devuelve coordenadas en la resolución del stream (video.videoWidth)
    const results = await faceapi.detectAllFaces(video, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    // Actualizar escala canvas <-> video por si cambió tamaño visual
    resizeCanvasToVideo();

    // limpieza del canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();

    // Marcar todos los tracked como temporalmente 'missing' antes de procesar detecciones
    for (const t of tracked) t.missing = true;

    // Procesar cada detección
    for (const res of results) {
      // box en coordenadas del stream (no escaladas)
      const box = res.detection.box;

      // Convertir al tamaño visual del canvas usando factores de escala guardados
      const scaleX = canvas._scaleX || 1;
      const scaleY = canvas._scaleY || 1;

      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const width = box.width * scaleX;
      const height = box.height * scaleY;
      const xCenter = x + width / 2;
      const yCenter = y + height / 2;

      // --- Calcular distancia aproximada (solo si tenemos focal_length calibrada o la calibramos ahora) ---
if (!FOCAL_LENGTH_PX) {
  // Calibrar automáticamente la primera vez: asumimos que al iniciar estás a ~50cm
  const KNOWN_DISTANCE_CM = 50;
  FOCAL_LENGTH_PX = (width * KNOWN_DISTANCE_CM) / FACE_REAL_WIDTH_CM;
}

const distanceCm = (FACE_REAL_WIDTH_CM * FOCAL_LENGTH_PX) / width;


      // Actualizar/crear tracked (pasamos las coordenadas ya escaladas y w,h escalados)
      const t = assignTracked(xCenter, yCenter, width, height);

      // Intento de reconocimiento (usa descriptor original res.descriptor)
      let label = 'Desconocido';
      if (faceMatcher) {
        const best = faceMatcher.findBestMatch(res.descriptor);
        if (best && best.label !== 'unknown') label = best.label;
        // --- Registrar tiempo de última vez que se vio a la persona principal ---
if (!mainPersonLabel && label !== 'Desconocido') {
  mainPersonLabel = label; // la primera persona reconocida será la "principal"
  console.log('Persona principal establecida como:', mainPersonLabel);
}

if (mainPersonLabel && label === mainPersonLabel) {
  lastSeenMain = Date.now();
  if (alertVisible) hideAlert();
}

      }

      // Dibujar rectángulo alineado (en tamaño visual)
      ctx.lineWidth = Math.max(2, width / 100);
      ctx.strokeStyle = t.color;
      ctx.strokeRect(x, y, width, height);

      // Etiqueta debajo (ajustada para que no se recorte)
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

      // Mostrar distancia debajo del nombre
const distanceText = `${distanceCm.toFixed(1)} cm`;
ctx.fillStyle = '#00FFFF';
ctx.font = `${Math.max(12, width / 20)}px sans-serif`;
ctx.fillText(distanceText, tagX + padding, tagY + 14);


      // Punto rojo de depuración (si está activo)
      if (showDebugPoint) {
        ctx.beginPath();
        ctx.arc(xCenter, yCenter, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
      }
    }

    // -------- Dibujar personas 'perdidas' (última posición conocida) ----------
    // Mantenemos visibles las personas marcadas como missing por hasta MAX_MISSING_TIME
    for (const t of tracked) {
      const missingFor = now - t.lastSeen;
      if (t.missing && missingFor < MAX_MISSING_TIME) {
        // rectángulo tenue basado en última w/h conocidos, centrado en x,y
        const w = t.w || 100;
        const h = t.h || 120;
        const x = (t.x - w / 2);
        const y = (t.y - h / 2);

        ctx.lineWidth = 2;
        // usar el color con transparencia (agregamos '55' si color en hex, fallback rgba)
        let strokeStyle = t.color;
        if (/^#([A-Fa-f0-9]{6})$/.test(t.color)) {
          strokeStyle = t.color + '66'; // semi-transparente
        } else {
          strokeStyle = 'rgba(255,255,255,0.5)';
        }
        ctx.strokeStyle = strokeStyle;
        ctx.strokeRect(x, y, w, h);

        // etiqueta pequeña indicando 'perdido'
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('(Perdido)', x + 6, y - 8);
      }
    }

    // Eliminar rastros demasiado antiguos
    for (let i = tracked.length - 1; i >= 0; i--) {
      if (now - tracked[i].lastSeen > MAX_MISSING_TIME) {
        tracked.splice(i, 1);
      }
    }

// --- Verificar si la persona principal ha desaparecido ---
if (mainPersonLabel) {
  const timeSinceSeen = Date.now() - lastSeenMain;
  if (timeSinceSeen > ALERT_TIMEOUT && !alertVisible) {
    showAlert(mainPersonLabel); // muestra el nombre correcto
  }
}



    // Pequeña espera para no saturar CPU (ajusta según necesidad)
    await new Promise(r => setTimeout(r, 100));
  }
}

// ------------------ INICIALIZACIÓN ------------------

(async () => {
  await loadModels();
  await loadReferencesFromLocalStorage();
  statusEl.textContent = 'Modelos listos. Puedes agregar o usar las referencias guardadas.';
})();
