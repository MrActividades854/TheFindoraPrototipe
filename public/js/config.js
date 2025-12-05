// config.js – versión definitiva a prueba de undefined

let WS_BASE = null;
let API_BASE = null;

const hostname = window.location.hostname;
const params = new URLSearchParams(window.location.search);
const forced = (params.get("env") || "").toLowerCase();

// ------------------------------------------------------------
// 1. Modo forzado (?env=local / lan / production)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 2. Si NO hay forced válido → autodetección
// ------------------------------------------------------------
if (!WS_BASE || !API_BASE) {

    // Localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        WS_BASE = WS_BASE || "ws://localhost:8080/ws";
        API_BASE = API_BASE || "http://localhost:8080";
    }

    // LAN privadas
    else if (/^(192\.168|10\.|172\.)/.test(hostname)) {
        WS_BASE = WS_BASE || `ws://${hostname}:8080/ws`;
        API_BASE = API_BASE || `http://${hostname}:8080`;
    }

    // Producción oficial
    else if (hostname === "thefindoraprototipe.onrender.com") {
        WS_BASE = WS_BASE || "wss://thefindoraprototipe.onrender.com/ws";
        API_BASE = API_BASE || "https://thefindoraprototipe.onrender.com";
    }
}

// ------------------------------------------------------------
// 3. Fallback GLOBAL (último recurso, nunca undefined)
// ------------------------------------------------------------
if (!WS_BASE) WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
if (!API_BASE) API_BASE = "https://thefindoraprototipe.onrender.com";

// ------------------------------------------------------------
// 4. Export final
// ------------------------------------------------------------
console.log(`CONFIG FINAL → WS: ${WS_BASE} | API: ${API_BASE}`);

export const CONFIG = {
    WS_URL: WS_BASE,
    API_URL: API_BASE,
    MODEL_PATH: "/models"
};
