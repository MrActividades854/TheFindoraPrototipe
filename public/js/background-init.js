// background-init.js (versión corregida)
import { CONFIG } from "./js/config.js";

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

export async function initBackgroundDetection() {
  try {
    if (!window.faceapi) {
      await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
      await waitFor(() => !!window.faceapi);
    }


    const UIManager = (await import('./ui.js') ).default;


    // Crear UIManager solo una vez, pasando modo 'history'
    if (!window.__uiManagerBG) {
      window.__uiManagerBG = new UIManager({
        wsUrl: CONFIG.WS_URL,
        modelPath: '/models',
        notificationsMode: 'history'   // <-- evita pop-ups, guarda solo historial
      });
      await window.__uiManagerBG.init();
    } else {
      console.log('[BG] UIManager ya existía, reusando instancia.');
      // si quieres forzar modo history en una instancia existente:
      if (window.__uiManagerBG.notifier) {
        // reemplaza el notifier si es necesario
        window.__uiManagerBG.notifier = new (await import('./notifications.js')).default('/api/notifications', 'history');
      }
    }

    console.log('[BG] Background detection lista.');
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
