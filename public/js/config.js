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
/**
 * Calcula la ruta correcta a /models basándose en la ubicación actual
 */
function calculateModelPath() {
    const currentPath = window.location.pathname;
    
    // Casos especiales
    if (currentPath === '/' || currentPath === '/index.html' || currentPath === '/public/index.html') {
        return './models';
    }
    
    // Contar niveles de profundidad desde la raíz
    // Eliminar vacíos y contar segmentos reales
    const segments = currentPath.split('/').filter(s => s && s !== 'index.html');
    
    // Si estamos en local con /public/, lo quitamos del conteo
    const hasPublic = segments.includes('public');
    let depth = segments.length;
    
    if (hasPublic) {
        // En local: /public/findorasections/camera/camara.html
        // segments = ['public', 'findorasections', 'camera', 'camara.html']
        // depth después de public = 2 (findorasections, camera)
        const publicIndex = segments.indexOf('public');
        depth = segments.length - publicIndex - 1;
    }
    
    // Ajustar por el archivo HTML en sí
    if (currentPath.endsWith('.html')) {
        depth = Math.max(0, depth - 1);
    }
    
    // Construir path relativo
    if (depth === 0) return './models';
    if (depth === 1) return '../models';
    if (depth === 2) return '../../models';
    if (depth === 3) return '../../../models';
    
    // Fallback genérico para mayor profundidad
    return '../'.repeat(depth) + 'models';
}

const MODEL_PATH = calculateModelPath();

console.log('[CONFIG] Model path calculado:', MODEL_PATH, 'desde:', window.location.pathname);

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
 *   resolvePath('findorasections/mainPage/Page.html') → '/public/findorasections/mainPage/Page.html' (local) o '/findorasections/mainPage/Page.html' (Render)
 */
function resolvePath(path) {
    // Limpiar path
    path = path.replace(/^\.?\/+/, ''); // quita ./ o / inicial (uno o más)
    
    // En local: agregar /public/
    // En Render: no agregar nada (NGINX ya sirve desde /public)
    return IS_RENDER ? `/${path}` : `/public/${path}`;
}

/**
 * Obtiene la ruta base según la profundidad actual
 * Útil para importar CSS/JS en diferentes niveles
 * 
 * @returns {string} - '../' o '../../' según profundidad
 * 
 * Ejemplos:
 *   Desde /public/index.html              → ''
 *   Desde /public/findorasections/Page.html   → '../'
 *   Desde /public/findorasections/camera/camara.html → '../../'
 */
function getBasePath() {
    const currentPath = window.location.pathname;
    
    // Casos especiales
    if (currentPath === '/' || currentPath === '/index.html' || currentPath === '/public/index.html') {
        return './';
    }
    
    const segments = currentPath.split('/').filter(s => s && s !== 'index.html');
    
    // Calcular profundidad relativa a /public/
    const hasPublic = segments.includes('public');
    let depth = segments.length;
    
    if (hasPublic) {
        const publicIndex = segments.indexOf('public');
        depth = segments.length - publicIndex - 1;
    }
    
    // Ajustar por el archivo HTML
    if (currentPath.endsWith('.html')) {
        depth = Math.max(0, depth - 1);
    }
    
    return depth > 0 ? '../'.repeat(depth) : './';
}

/**
 * Convierte una ruta relativa a absoluta según el entorno
 * Útil para imports desde diferentes niveles de carpetas
 * 
 * @param {string} relativePath - Ruta relativa (ej: '../../js/config.js')
 * @returns {string} - Ruta absoluta o relativa corregida
 */
function resolveImportPath(relativePath) {
    const basePath = getBasePath();
    
    // Si ya es absoluta, devolverla tal cual
    if (relativePath.startsWith('/') || relativePath.startsWith('http')) {
        return relativePath;
    }
    
    // Combinar base path con ruta relativa
    return basePath + relativePath;
}

// -----------------------------
// 4. Export final
// -----------------------------

export const CONFIG = {
    WS_URL: WS_BASE,
    API_URL: API_BASE,
    MODEL_PATH,
    IS_RENDER,
    
    // Utilidades de rutas
    resolvePath,
    getBasePath,
    resolveImportPath
};

// También exportar las funciones directamente
export { resolvePath, getBasePath, resolveImportPath };