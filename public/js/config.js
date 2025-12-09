// config.js – AUTOAJUSTABLE PARA LOCAL + RENDER + SUBCARPETAS

let WS_BASE = null;
let API_BASE = null;

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
}
else if (forced === "lan") {
    WS_BASE = `ws://${hostname}:8080/ws`;
    API_BASE = `http://${hostname}:8080`;
}
else if (forced === "production") {
    WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
    API_BASE = "https://thefindoraprototipe.onrender.com";
}

// AUTO-DETECCIÓN SI NO HAY MODO FORZADO
if (!WS_BASE || !API_BASE) {

    // Localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        WS_BASE = WS_BASE || "ws://localhost:8080/ws";
        API_BASE = API_BASE || "http://localhost:8080";
    }

    // LAN
    else if (/^(192\.168|10\.|172\.)/.test(hostname)) {
        WS_BASE = WS_BASE || `ws://${hostname}:8080/ws`;
        API_BASE = API_BASE || `http://${hostname}:8080`;
    }

    // Render
    else if (hostname === "thefindoraprototipe.onrender.com") {
        WS_BASE = WS_BASE || "wss://thefindoraprototipe.onrender.com/ws";
        API_BASE = API_BASE || "https://thefindoraprototipe.onrender.com";
    }
}

// FALLBACK FINAL (nunca undefined)
if (!WS_BASE) WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
if (!API_BASE) API_BASE = "https://thefindoraprototipe.onrender.com";

// -----------------------------
// 2. RUTA AUTOMÁTICA PARA MODELS
// -----------------------------
//
// Sirve para todas tus páginas:
// /public/index.html
// /public/findorasections/camera/camara.html
// /public/findorasections/notifications/...
//
// Si estás en /public → "./models"
// Si estás en /public/findorasections/... → "../models"
//
let MODEL_PATH = "./models";

const depth = window.location.pathname.split("/").length - 2;

// si estás dentro de /findorasections/camera/, depth = 3
// entonces debemos subir un nivel
if (depth > 1) MODEL_PATH = "../models";

// si estás a 2 niveles de profundidad:
if (depth > 2) MODEL_PATH = "../../models";

// nunca usar rutas absolutas para modelos en local
// en Render, igualmente funciona por NGINX desde /public

// -----------------------------
// 3. Export final
// -----------------------------
console.log(`CONFIG:\nWS → ${WS_BASE}\nAPI → ${API_BASE}\nMODELS → ${MODEL_PATH}`);

export const CONFIG = {
    WS_URL: WS_BASE,
    API_URL: API_BASE,
    MODEL_PATH
};
