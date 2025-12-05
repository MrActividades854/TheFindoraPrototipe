// background-init.js (versión corregida)
// Solo corre en páginas que NO son index.html

(function() {
  const path = window.location.pathname;

  // ⛔ NO correr en index.html
  if (path.includes('index') || path === '/' || path === '') {
    console.log('[BG] Background init desactivado en index');
    return;
  }

  // Evitar múltiples inicializaciones
  if (window.__backgroundInit) return;
  window.__backgroundInit = true;

  console.log('[BG] Inicializando background face detection...');

  initBackgroundDetection();
})();

// -------------------------

export async function initBackgroundDetection() {
  try {
    if (!window.faceapi) {
      await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
      await waitFor(() => !!window.faceapi);
    }

    const UIManager = (await import('./ui.js')).default;

    // Crear UIManager solo una vez
    if (!window.__uiManagerBG) {
      window.__uiManagerBG = new UIManager({
        wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
        modelPath: '/models'
      });
      await window.__uiManagerBG.init();
    }

    console.log('[BG] Background detection lista.');

    const ui = new UIManager({
   notificationsMode: "history"
});

this.notifier = new NotificationManager('/api/notifications', this.config.notificationsMode);

  } catch (e) {
    console.error('Error background init:', e);
  }
}

// Helpers...
function loadScript(src) {
  return new Promise(r => {
    if (document.querySelector(`script[src="${src}"]`) || window.faceapi) return r();
    const s = document.createElement('script');
    s.src = src;
    s.onload = r;
    document.head.appendChild(s);
  });
}

function waitFor(fn, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if (fn()) return resolve();
      if (Date.now() - start > timeout) return reject();
      setTimeout(check, 50);
    }
    check();
  });
}
