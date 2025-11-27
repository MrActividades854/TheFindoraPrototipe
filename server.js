// server.js listo para RENDER + local
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();

// Sirve SOLO la carpeta "public" (no toda la raíz)
app.use(express.static(path.join(__dirname, "public")));

// Crea servidor HTTP
const server = http.createServer(app);

// WebSocket en ruta /ws para evitar conflictos
const wss = new WebSocket.Server({ noServer: true });

// Manejo del upgrade correcto
server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    } else {
        socket.destroy();
    }
});

wss.on("connection", (ws) => {
    console.log("[WS] Cliente conectado");

    ws.on("message", (msg) => {
        // Redistribuir a los otros clientes
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });

    ws.on("close", () => {
        console.log("[WS] Cliente desconectado");
    });
});

// Render asigna PORT automáticamente
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
});
