// background-init.js - Versión configurable

import { CONFIG } from "./config.js";

// ============================================================
// CONFIGURACIÓN - LEER DESDE LOCALSTORAGE
// ============================================================
const BACKGROUND_CONFIG = {
    // Leer configuración guardada por el usuario
    enableLocalCamera: localStorage.getItem('bg_enableLocalCamera') === 'true',
    showMiniPreview: localStorage.getItem('bg_showMiniPreview') !== 'false',
    previewPosition: localStorage.getItem('bg_previewPosition') || 'bottom-right',
    previewSize: localStorage.getItem('bg_previewSize') || 'small'
};

// ============================================================
// AUTO-INIT
// ============================================================
(function () {
    const path = window.location.pathname;

    // No correr en index
    if (path.includes("index.html") || path === "/" || path === "") {
        console.log("[BG] Background init desactivado en index");
        return;
    }

    if (window.__backgroundInit) return;
    window.__backgroundInit = true;

    const mode = BACKGROUND_CONFIG.enableLocalCamera ? "CON cámara local" : "solo remotas";
    console.log(`[BG] Inicializando background detection (${mode})...`);

    initBackgroundDetection();
})();

// ============================================================
// INIT FUNCTION
// ============================================================
export async function initBackgroundDetection() {
    try {
        // Verificar WebSocket
        const useWS = localStorage.getItem("useWebSocket") === "true";
        
        if (!useWS) {
            console.log("[BG] WebSocket desactivado → Background detection no iniciada");
            return;
        }

        console.log("[BG] WebSocket habilitado, iniciando...");

        // Cargar UIManager
        const UIManager = (await import("./ui.js")).default;

        // Si se requiere cámara local, crear container
        if (BACKGROUND_CONFIG.enableLocalCamera) {
            createBackgroundContainer();
        }

        // Crear instancia
        if (!window.__uiManagerBG) {
            window.__uiManagerBG = new UIManager({
                wsUrl: CONFIG.WS_URL,
                modelPath: CONFIG.MODEL_PATH,
                notificationsMode: "history",
                backgroundMode: !BACKGROUND_CONFIG.enableLocalCamera
            });

        //Vigilar feeds remotos
        window.__uiManagerBG.onRemoteFeed = (senderId, stream) => {
            console.log(`[BG] Feed recibido / actualizado: ${senderId}`);

            stream.getTracks().forEach(track => {
                track.onended = () => {
                console.warn(`[BG] Stream terminado: ${senderId}`);
                };
            });

            // Se reengancha la detección
            const video = document.getElementById(`remote-${senderId}`);
            if (video) {
                video.dataset.bgAttached = "true"; // idempotente
            }
        };

            await window.__uiManagerBG.init();
            
            const mode = BACKGROUND_CONFIG.enableLocalCamera ? "con cámara local" : "solo feeds remotos";
            console.log(`[BG] Background detection inicializada (${mode})`);
        } else {
            console.log("[BG] UIManager ya existía.");
        }

    } catch (e) {
        console.error("[BG] Error:", e);
    }
}


// ============================================================
// UI DEL BACKGROUND
// ============================================================
function createBackgroundContainer() {
    if (document.getElementById('container')) {
        console.log("[BG] Container ya existe");
        return;
    }

    console.log("[BG] Creando container para background...");

    // Determinar tamaño
    const sizes = {
        small: '200px',
        medium: '300px',
        large: '400px'
    };
    const width = sizes[BACKGROUND_CONFIG.previewSize] || '200px';

    // Determinar posición
    const positions = {
        'bottom-right': { bottom: '0', right: '0', borderRadius: '10px 0 0 0' },
        'bottom-left': { bottom: '0', left: '0', borderRadius: '0 10px 0 0' },
        'top-right': { top: '80px', right: '0', borderRadius: '0 0 0 10px' },
        'top-left': { top: '80px', left: '0', borderRadius: '0 0 10px 0' }
    };
    const pos = positions[BACKGROUND_CONFIG.previewPosition] || positions['bottom-right'];

    // Container
    const container = document.createElement('div');
    container.id = 'container';
    container.style.cssText = `
        position: fixed;
        ${Object.entries(pos).map(([k, v]) => `${k}: ${v}`).join('; ')};
        width: ${width};
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 99998;
        background: rgba(0, 0, 0, 0.9);
        padding: 10px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
        display: ${BACKGROUND_CONFIG.showMiniPreview ? 'none' : 'none'};
        transition: opacity 0.3s;
    `;

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '📹';
    toggleBtn.title = 'Mostrar/Ocultar detección en background';
    
    const btnPos = { ...pos };
    if (btnPos.bottom) btnPos.bottom = '20px';
    if (btnPos.top) btnPos.top = '20px';
    if (btnPos.right) btnPos.right = '20px';
    if (btnPos.left) btnPos.left = '20px';
    
    toggleBtn.style.cssText = `
        position: fixed;
        ${Object.entries(btnPos).map(([k, v]) => `${k}: ${v}`).join('; ')};
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: 3px solid rgba(255,255,255,0.3);
        font-size: 24px;
        cursor: pointer;
        z-index: 99999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        transition: all 0.3s;
        display: ${BACKGROUND_CONFIG.showMiniPreview ? 'flex' : 'none'};
        align-items: center;
        justify-content: center;
    `;

    let isVisible = false;
    toggleBtn.onclick = () => {
        isVisible = !isVisible;
        container.style.display = isVisible ? 'block' : 'none';
        toggleBtn.innerHTML = isVisible ? '❌' : '📹';
        toggleBtn.style.background = isVisible 
            ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    };

    toggleBtn.onmouseenter = () => {
        toggleBtn.style.transform = 'scale(1.1)';
    };

    toggleBtn.onmouseleave = () => {
        toggleBtn.style.transform = 'scale(1)';
    };

    // Badge contador
    const badge = document.createElement('div');
    badge.id = 'bg-feed-count';
    badge.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 11px;
        font-weight: bold;
        min-width: 18px;
        text-align: center;
        display: none;
    `;
    toggleBtn.appendChild(badge);

    // Header del container
    const header = document.createElement('div');
    header.style.cssText = `
        color: white;
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.2);
        font-family: Arial, sans-serif;
    `;
    header.textContent = 'Detección Activa';
    container.appendChild(header);

    // Agregar al DOM
    document.body.appendChild(container);
    document.body.appendChild(toggleBtn);

    // Actualizar badge cuando cambien videos
    setInterval(() => {
        const videos = document.querySelectorAll('#container video');
        const count = videos.length;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }, 1000);

    // Estilos para feeds
    addBackgroundStyles();

    console.log("[BG] Container creado (click en 📹 para mostrar)");
}

function addBackgroundStyles() {
    const style = document.createElement('style');
    style.id = 'bg-detection-styles';
    style.textContent = `
        #container .feed {
            width: 100%;
            margin-bottom: 10px;
            border-radius: 8px;
            overflow: hidden;
            background: #000;
            position: relative;
        }

        #container .feed-frame {
            position: relative;
            width: 100%;
            padding-bottom: 75%;
        }

        #container .feed-frame video,
        #container .feed-frame canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        #container::-webkit-scrollbar {
            width: 6px;
        }

        #container::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
        }

        #container::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 3px;
        }

        #container::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.5);
        }
    `;
    
    if (!document.getElementById('bg-detection-styles')) {
        document.head.appendChild(style);
    }
}

// ============================================================
// UTILIDADES PÚBLICAS
// ============================================================

// Cambiar configuración en runtime
export function setBackgroundConfig(key, value) {
    if (key in BACKGROUND_CONFIG) {
        BACKGROUND_CONFIG[key] = value;
        console.log(`[BG] Configuración actualizada: ${key} = ${value}`);
        
        // Si cambia enableLocalCamera, recargar
        if (key === 'enableLocalCamera') {
            console.log("[BG] Cambio de configuración requiere recargar la página");
        }
    }
}

// Obtener estado actual
export function getBackgroundStatus() {
    return {
        initialized: !!window.__uiManagerBG,
        config: { ...BACKGROUND_CONFIG },
        videos: window.__uiManagerBG?.videos?.length || 0
    };
}