// main.js (simple, estable y compatible con la nueva UI)
import UIManager from './js/ui.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const ui = new UIManager({
      wsUrl: 'https://thefindoraprototipe.onrender.com/ws',
      modelPath: '/models'
    });

    // Exponer para debug
    window.ui = ui;

    // ui.init() ahora hace TODO:
    // - cargar modelos
    // - cargar perfiles desde la base de datos
    // - iniciar WebRTC
    // - crear la cámara local
    // - detectar en todas las cámaras automáticamente
    await ui.init();

  } catch (err) {
    console.error("❌ Error crítico inicializando la app:", err);
    const status = document.getElementById("status");
    if (status) status.textContent = "Error: " + err;
  }
});

// Manejo global de errores opcional
window.addEventListener("error", (e) => {
  console.error("⚠️ Error global:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("⚠️ Promesa no manejada:", e.reason);
});
