// main.js (simple, estable y compatible con la nueva UI)
import UIManager from './js/ui.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Esperar a que face-api esté disponible
    if (!window.faceapi) {
      console.warn('⏳ Esperando face-api.js...');
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (window.faceapi) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    const ui = new UIManager({
      wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
      modelPath: '/models'
    });

    window.ui = ui;
    await ui.init();

  } catch (err) {
    console.error("❌ Error crítico inicializando la app:", err);
    const status = document.getElementById("status");
    if (status) status.textContent = "Error: " + err;
  }
});

window.addEventListener("error", (e) => {
  console.error("⚠️ Error global:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("⚠️ Promesa no manejada:", e.reason);
});
