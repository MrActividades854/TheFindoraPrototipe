// main.js — versión sin conflictos de cámara
import { CONFIG } from "./js/config.js";
import UIManager from './js/ui.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 [MAIN] Iniciando aplicación principal...');

    localStorage.setItem("useWebSocket", true);

    // Prevenir que background-init interfiera
    window.__backgroundInit = true; // Marcar como ya inicializado
    
    // Crear UIManager en modo normal (con cámaras)
    const ui = new UIManager({
      wsUrl: CONFIG.WS_URL,
      modelPath: CONFIG.MODEL_PATH,
      notificationsMode: 'live', // Notificaciones visibles en index
      backgroundMode: false       // Modo normal con UI
    });

    // Guardar instancia global
    window.uiManager = ui;
    window.ui = ui; // Alias

    await ui.init();

  } catch (err) {
    console.error("[MAIN] Error crítico:", err);
    const status = document.getElementById("status");
    if (status) status.textContent = "Error: " + err.message;
  }
});

window.addEventListener("error", (e) => {
  console.error("[MAIN] Error global:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[MAIN] Promesa no manejada:", e.reason);
});