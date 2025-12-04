// Inicialización compartida para TODAS las páginas

export async function initBackgroundDetection() {
  // Evitar inicialización múltiple
  if (window.__uiInitialized) return;
  window.__uiInitialized = true;

  try {
    // Cargar face-api.js si no existe
    if (!window.faceapi) {
      await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
      // espera breve para que el objeto se inicialice
      await waitFor(() => !!window.faceapi, 2000);
    }

    const UIManager = (await import('./ui.js')).default;

    // Crear una instancia única de UIManager y guardarla en el contexto global
    if (!window.__uiManager) {
      window.__uiManager = new UIManager({
        wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
        modelPath: '/models'
      });
    }

    // Inicia la detección de caras en segundo plano si no está ya activa
    if (!window.__faceDetectionActive) {
      window.__faceDetectionActive = true;
      startFaceDetection(window.__uiManager);
    }
  } catch (error) {
    console.error('Error al inicializar la detección de fondo:', error);
  }
}

function startFaceDetection(ui) {
  console.log('Detección de caras iniciada en segundo plano');
  setInterval(async () => {
    try {
      const detections = await ui.detectFaces();
      console.log('Detecciones:', detections);
    } catch (error) {
      console.error('Error en la detección de caras:', error);
    }
  }, 5000); // Ejecutar cada 5 segundos
}

// small helpers
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) || window.faceapi) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error('Failed loading ' + src));
    document.head.appendChild(s);
  });
}

function waitFor(condFn, timeout = 3000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function check() {
      if (condFn()) return resolve();
      if (Date.now() - start >= timeout) return reject(new Error('Timeout waiting for condition'));
      setTimeout(check, 50);
    })();
  });
}

// Llama a la función de inicialización al cargar el script
initBackgroundDetection();