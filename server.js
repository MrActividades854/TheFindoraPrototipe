// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

console.log("Servidor WebSocket iniciado en ws://192.168.101.15:8080");

wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", async (msg) => {
    let text;

    // 1. Si viene como Blob → convertir
    if (msg instanceof Blob) {
        text = await msg.text();
    }
    // 2. Si es Buffer → convertir
    else if (Buffer.isBuffer(msg)) {
        text = msg.toString("utf8");
    }
    // 3. Si ya es string
    else {
        text = msg;
    }

    // Reenviar como texto JSON puro
    wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(text);
        }
    });
});


    ws.on("close", () => {
        console.log("Cliente desconectado");
    });
});
