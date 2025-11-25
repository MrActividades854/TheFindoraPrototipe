// ================================
// main.js (versión profesional)
// ================================

// Importa la capa principal de interfaz
import UIManager from './js/ui.js';

// Espera a que el DOM esté listo
window.addEventListener('DOMContentLoaded', async () => {
    console.log("⏳ Inicializando sistema...");

    try {
        // Crear instancia principal
        const ui = new UIManager({
            wsUrl: 'https://thefindoraprototipe.onrender.com',
            modelPath: '/models'
        });

        // Exponer para debugging
        window.ui = ui;
        window.webrtc = ui.webrtc;

        // Importante: cargar referencias ANTES de iniciar UI
        await ui.faceRec.loadModels();
        ui.faceRec.loadReferencesFromLocalStorage();

        // Iniciar la aplicación
        await ui.init();

        console.log("✅ Sistema inicializado correctamente");

    } catch (err) {
        console.error("❌ Error crítico inicializando la app:", err);
        alert("Error inicializando la aplicación:\n" + (err.message || err));
    }

    // Mover notificationContainer al final de body y forzar estilos
(function ensureNotifOnTop() {
  const nc = document.getElementById('notificationContainer');
  if (!nc) return;

  // mover al final del body para evitar stacking contexts padres
  document.body.appendChild(nc);

  // y forzar los estilos por si hay inline previos
  Object.assign(nc.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: String(2147483647),
    pointerEvents: 'auto'
  });
})();

});


// ================================
// Manejo de errores globales
// ================================
window.addEventListener("error", (e) => {
    console.error("⚠️ Error global:", e.message, e.filename, e.lineno);
});

window.addEventListener("unhandledrejection", (e) => {
    console.error("⚠️ Promesa no manejada:", e.reason);
});


// ================================
// Helper: solicitar permisos ANTES de enumerar cámaras
// Evita deviceId vacío y OverconstrainedError
// ================================
(async () => {
    try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("🎥 Permiso de cámara concedido.");
    } catch (err) {
        console.warn("⚠️ No se pudo obtener permiso de cámara:", err);
    }
})();
