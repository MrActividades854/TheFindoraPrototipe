// background-init.js — versión con mejor detección de páginas
import { CONFIG } from "./config.js";

(function () {
    const path = window.location.pathname;

    // ✅ MEJORADO: No correr en páginas con UI de cámaras
    const excludedPages = [
        'index.html',
        'camara.html',
        'test-header.html',
        'test-background.html'
    ];

    const shouldExclude = excludedPages.some(page => path.includes(page)) 
        || path === "/" 
        || path === "";

    if (shouldExclude) {
        console.log("[BG] Background init desactivado en:", path);
        return;
    }

    // Evitar doble inicialización
    if (window.__backgroundInit) {
        console.log("[BG] Background init ya ejecutado, saltando");
        return;
    }
    
    window.__backgroundInit = true;

    console.log("[BG] Inicializando background face detection en:", path);

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

        // ✅ Verificar que no exista ya una instancia global (evitar conflicto con index.html)
        if (window.uiManager) {
            console.log("[BG] Detectada instancia global de UIManager, usando esa en lugar de crear nueva");
            window.__uiManagerBG = window.uiManager;
            return;
        }

        // Crear una instancia única con backgroundMode
        if (!window.__uiManagerBG) {
            window.__uiManagerBG = new UIManager({
                wsUrl: CONFIG.WS_URL,
                modelPath: CONFIG.MODEL_PATH,
                notificationsMode: "history", // modo silencioso
                backgroundMode: true          // ✅ Modo background habilitado
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