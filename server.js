require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initDB, pool, isDBConnected } = require("./database/initDB");
const setupWebSocket = require("./sockets/websocket");

const PORT = process.env.PORT || 8080;

async function startServer() {
    console.log('\n🚀 Iniciando servidor Findora...');
    await initDB();

    const server = http.createServer(app);
    setupWebSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Servidor escuchando en puerto ${PORT}`);
        console.log(`🗄️ PostgreSQL: ${isDBConnected() ? 'Conectada ✅' : 'Desconectada ⚠️'}`);
    });
}

// Cierre graceful
process.on('SIGINT', async () => {
    if (pool) await pool.end();
    process.exit(0);
});

startServer();
