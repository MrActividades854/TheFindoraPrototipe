// Inicialización compartida para TODAS las páginas

export async function initBackgroundDetection() {
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

    // Solo iniciar si estamos en una página que necesita detección (opcional)
    // if (!document.getElementById('container')) return;

    const ui = new UIManager({
      wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
      modelPath: '/models'
    });

    window.ui = ui;
    await ui.init();
    console.log('✓ Detección iniciada (background-init)');

  } catch (err) {
    console.error('Error en initBackgroundDetection', err);
  }
}

// small helpers
function loadScript(src) {
  return new Promise((resolve, reject) => {
    // si ya cargado, resolve
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
      if (condFn()) return resolve(true);
      if (Date.now() - start > timeout) return reject(new Error('timeout waiting for condition'));
      setTimeout(check, 50);
    })();
  });
}