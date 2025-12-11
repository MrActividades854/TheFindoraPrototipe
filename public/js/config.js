// config.js – AUTOAJUSTABLE PARA LOCAL + RENDER + SUBCARPETAS

let WS_BASE = null;
let API_BASE = null;
let IS_RENDER = false;

// -----------------------------
// 1. DETECCIÓN DEL ENTORNO
// -----------------------------
const hostname = window.location.hostname;
const params = new URLSearchParams(window.location.search);
const forced = (params.get("env") || "").toLowerCase();

// MODO FORZADO (útil para debug)
if (forced === "local") {
    WS_BASE = "ws://localhost:8080/ws";
    API_BASE = "http://localhost:8080";
    IS_RENDER = false;
}
else if (forced === "lan") {
    WS_BASE = `ws://${hostname}:8080/ws`;
    API_BASE = `http://${hostname}:8080`;
    IS_RENDER = false;
}
else if (forced === "production") {
    WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
    API_BASE = "https://thefindoraprototipe.onrender.com";
    IS_RENDER = true;
}

// AUTO-DETECCIÓN SI NO HAY MODO FORZADO
if (!WS_BASE || !API_BASE) {

    // Localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        WS_BASE = WS_BASE || "ws://localhost:8080/ws";
        API_BASE = API_BASE || "http://localhost:8080";
        IS_RENDER = false;
    }

    // LAN
    else if (/^(192\.168|10\.|172\.)/.test(hostname)) {
        WS_BASE = WS_BASE || `ws://${hostname}:8080/ws`;
        API_BASE = API_BASE || `http://${hostname}:8080`;
        IS_RENDER = false;
    }

    // Render
    else if (hostname === "thefindoraprototipe.onrender.com") {
        WS_BASE = WS_BASE || "wss://thefindoraprototipe.onrender.com/ws";
        API_BASE = API_BASE || "https://thefindoraprototipe.onrender.com";
        IS_RENDER = true;
    }
}

// FALLBACK FINAL (nunca undefined)
if (!WS_BASE) {
    WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
    IS_RENDER = true;
}
if (!API_BASE) {
    API_BASE = "https://thefindoraprototipe.onrender.com";
    IS_RENDER = true;
}

// -----------------------------
// 2. RUTA AUTOMÁTICA PARA MODELS
// -----------------------------
let MODEL_PATH = "./models";

const depth = window.location.pathname.split("/").length - 2;

if (depth > 1) MODEL_PATH = "../models";
if (depth > 2) MODEL_PATH = "../../models";

// -----------------------------
// 3. RESOLVEDOR DE RUTAS UNIVERSAL
// -----------------------------

/**
 * Resuelve rutas según el entorno (local con /public/ vs Render sin /public/)
 * 
 * @param {string} path - Ruta relativa desde /public/
 * @returns {string} - Ruta ajustada según entorno
 * 
 * Ejemplos:
 *   resolvePath('header.html')           → '/public/header.html' (local) o '/header.html' (Render)
 *   resolvePath('js/config.js')          → '/public/js/config.js' (local) o '/js/config.js' (Render)
 *   resolvePath('mainPage/Page.html')    → '/public/mainPage/Page.html' (local) o '/mainPage/Page.html' (Render)
 */
function resolvePath(path) {
    // Limpiar path
    path = path.replace(/^\.?\//, ''); // quita ./ o / inicial
    
    // En local: agregar /public/
    // En Render: no agregar nada (NGINX ya sirve desde /public)
    return IS_RENDER ? `/${path}` : `/public/${path}`;
}

/**
 * Obtiene la ruta base según la profundidad actual
 * Útil para importar CSS/JS en diferentes niveles
 * 
 * @returns {string} - '../' o '../../' según profundidad
 */
function getBasePath() {
    const currentPath = window.location.pathname;
    const segments = currentPath.split('/').filter(s => s);
    
    // En local: /public/findorasections/mainPage/Page.html → subir 3 niveles
    // En Render: /findorasections/mainPage/Page.html → subir 2 niveles
    const publicIndex = segments.indexOf('public');
    const levelsAfterPublic = publicIndex >= 0 ? segments.length - publicIndex - 1 : segments.length - 1;
    
    return '../'.repeat(levelsAfterPublic > 0 ? levelsAfterPublic : 0);
}

// -----------------------------
// 4. Export final
// -----------------------------

export const CONFIG = {
    WS_URL: WS_BASE,
    API_URL: API_BASE,
    MODEL_PATH,
    IS_RENDER,
    
    // Nuevas utilidades
    resolvePath,
    getBasePath
};

// También exportar las funciones directamente
export { resolvePath, getBasePath };