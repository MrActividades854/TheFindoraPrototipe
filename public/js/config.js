// Detect automatically environment
const hostname = window.location.hostname;
const params = new URLSearchParams(window.location.search);
const forced = params.get("env");

if (forced === "local") WS_BASE = "ws://localhost:8000/ws";
if (forced === "lan") WS_BASE = `ws://${hostname}:5501/ws`;
if (forced === "production") WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";

let WS_BASE = "";

// Localhost or local network
if (hostname === "localhost" || hostname === "127.0.0.1") {
    WS_BASE = "ws://localhost:8000/ws";  
}
// LAN (192.168.x.x / 10.x.x.x / 172.x.x.x)
else if (/^(192\.168|10\.|172\.)/.test(hostname)) {
    WS_BASE = `ws://${hostname}:8000/ws`;  
}
// Production (Render)
else {
    WS_BASE = "wss://thefindoraprototipe.onrender.com/ws";  
}

export const CONFIG = {
    
    WS_URL: WS_BASE
};
