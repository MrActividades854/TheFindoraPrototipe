// background-init.js — versión final sin CDN ni doble faceapi
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
        // Cargar UIManager normalmente (usa ES Modules)
        const UIManager = (await import("./ui.js")).default;

        // Crear una instancia única
        if (!window.__uiManagerBG) {
            window.__uiManagerBG = new UIManager({
                wsUrl: CONFIG.WS_URL,
                modelPath: CONFIG.MODEL_PATH,
                notificationsMode: "history" // modo silencioso
            });

            await window.__uiManagerBG.init();
        } else {
            console.log("[BG] UIManager ya existía, reusando instancia.");
        }

        console.log("[BG] Background detection lista.");
    } catch (e) {
        console.error("Error background init:", e);
    }
}
