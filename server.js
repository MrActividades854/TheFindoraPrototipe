const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();

// Sirve TODOS los archivos EXACTAMENTE como los tienes
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("[WS] Cliente conectado");

    ws.on("message", (msg) => {
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

// Render/railway asignarán PORT automáticamente
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
});
