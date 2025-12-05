// config.js (VERSION CORREGIDA)

// 1. Declarar las variables una sola vez al principio
let API_BASE = "";
let WS_BASE = "";

const hostname = window.location.hostname;
const params = new URLSearchParams(window.location.search);
const forced = params.get("env");

// 2. PRIORIZAR la configuración forzada
if (forced) {
    if (forced === "local") {
        WS_BASE = "ws://localhost:8000/ws";
        API_BASE = "https://thefindoraprototipe.onrender.com"; // Si el API de perfiles está en Render
        console.log(hostname, forced);
    } else if (forced === "lan") {
        WS_BASE = `ws://${hostname}:5501/ws`; // Si tu servidor LAN usa 5501
        API_BASE = `http://${hostname}:8000`; // Asumiendo que el API está en LAN
        console.log(hostname, forced);
    } else if (forced === "production") {
        WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";
        API_BASE = "https://thefindoraprototipe.onrender.com";
        console.log(hostname, forced);
    }
    // NOTA: Con la estructura de abajo no necesitas un 'return'
    // porque los 'else if' detienen la ejecución de esa parte.
} 
// 3. Si NO hay configuración forzada (o forced = null/otro valor), usar la detección automática
// Se usa un 'else' para asegurar que SOLO se ejecuta la detección automática si 'forced' no aplica.
else {
    // Localhost o 127.0.0.1
    alert(hostname);
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        WS_BASE = "ws://localhost:8000/ws";  
        API_BASE = "https://thefindoraprototipe.onrender.com";
    }
    // LAN (192.168.x.x / 10.x.x.x / 172.x.x.x)
    else if (/^(192\\.168|10\\.|172\\.)/.test(hostname)) {
        WS_BASE = `ws://${hostname}:8000/ws`; // Usamos 8000 en el ejemplo original
        API_BASE = ""; // O la URL de tu API en LAN
    }
    // Producción (cualquier otro dominio)
    else if (hostname === "thefindoraprototipe.onrender.com") {
        WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";  
        API_BASE = ""; // O la URL de tu API en producción
    }
}

console.log(`Configuración final - WS_BASE: ${WS_BASE}, API_BASE: ${API_BASE}`);

// 4. Exportar la configuración


export const CONFIG = {
    WS_URL: WS_BASE,
    API_URL: API_BASE, // ¡Asegúrate de exportar también la URL del API!
    MODEL_PATH: '/models' // Puedes mover esto aquí también si quieres
};