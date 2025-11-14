// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });

console.log("Servidor WebSocket iniciado en ws://localhost:8080");

wss.on("connection", (ws) => {
    console.log("Cliente conectado");

    ws.on("message", (msg) => {
        // retransmitir a todos excepto al que envió
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });

    ws.on("close", () => {
        console.log("Cliente desconectado");
    });
});
