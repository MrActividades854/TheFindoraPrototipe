const pool = require("../config/database");
const createTables = require("./createTables");

let connected = false;
let initializing = false;

async function initDB(retries = 3) {
    if (!pool) {
        console.warn("⚠️ DATABASE_URL no definida");
        connected = false;
        return false;
    }

    if (connected) return true;
    if (initializing) return false;

    initializing = true;

    for (let i = 1; i <= retries; i++) {
        try {
            console.log(`🔄 DB intento ${i}/${retries}`);

            const client = await pool.connect();
            await client.query("SELECT 1");
            client.release();

            await createTables(pool);

            connected = true;
            initializing = false;
            console.log("✅ PostgreSQL conectada");
            return true;

        } catch (err) {
            console.error("❌ Error DB:", err.message);
            connected = false;

            if (i < retries) {
                await new Promise(r => setTimeout(r, i * 1000));
            }
        }
    }

    initializing = false;
    console.warn("⚠️ DB no disponible, servidor seguirá sin DB");
    return false;
}

function isDBConnected() {
    return connected;
}

module.exports = {
    initDB,
    pool,
    isDBConnected
};
