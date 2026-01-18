const WebSocket = require("ws");

module.exports = (server) => {
    const wss = new WebSocket.Server({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
        if (req.url === "/ws") {
            wss.handleUpgrade(req, socket, head, ws => {
                wss.emit("connection", ws);
            });
        }
    });

    wss.on("connection", ws => {
        ws.on("message", msg => {
            wss.clients.forEach(c => {
                if (c !== ws && c.readyState === WebSocket.OPEN) {
                    c.send(msg);
                }
            });
        });
    });
};
