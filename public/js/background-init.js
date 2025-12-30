// background-init.js — versión con backgroundMode habilitado
import { CONFIG } from "./config.js";

(function () {
    const path = window.location.pathname;

    // No correr en index
    if (path.includes("index") || path === "/" || path === "") {
        console.log("[BG] Background init desactivado en index");
        return;
    }

    if (window.__backgroundInit) return;
    window.__backgroundInit = true;

    console.log("[BG] Inicializando background face detection...");

    initBackgroundDetection();
})();

export async function initBackgroundDetection() {
    try {
        // Verificar que WebSocket esté habilitado
        const useWS = localStorage.getItem("useWebSocket") === "true";
        
        if (!useWS) {
            console.log("[BG] WebSocket desactivado → Background detection no iniciada");
            return;
        }

        console.log("[BG] WebSocket habilitado, iniciando background detection...");

        // Cargar UIManager normalmente (usa ES Modules)
        const UIManager = (await import("./ui.js")).default;

        // Crear una instancia única con backgroundMode
        if (!window.__uiManagerBG) {
            window.__uiManagerBG = new UIManager({
                wsUrl: CONFIG.WS_URL,
                modelPath: CONFIG.MODEL_PATH,
                notificationsMode: "history", // modo silencioso
                backgroundMode: true          // ✅ NUEVO: Modo background habilitado
            });

            console.log("[BG] Inicializando UIManager en modo background...");
            await window.__uiManagerBG.init();
            console.log("[BG] ✅ Background detection inicializada");
        } else {
            console.log("[BG] UIManager ya existía, reusando instancia.");
        }

        console.log("[BG] Background detection lista.");
    } catch (e) {
        console.error("[BG] ❌ Error background init:", e);
        console.error("[BG] Stack:", e.stack);
    }
}