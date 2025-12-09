// main.js — versión correcta sin window.faceapi
import { CONFIG } from "./js/config.js";
import UIManager from './js/ui.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Crear UIManager directamente (solo usa ES modules)
    const ui = new UIManager({
      wsUrl: "wss://thefindoraprototipe.onrender.com/ws",
      modelPath: CONFIG.MODEL_PATH,
    });

    window.ui = ui;

    // Inicializar UI
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
