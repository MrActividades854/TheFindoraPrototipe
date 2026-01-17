const pool = require("../config/database");
const createTables = require("./createTables");

let connected = false;

async function initDB() {
    if (!pool) return false;

    try {
        const client = await pool.connect();
        client.release();
        await createTables(pool);
        connected = true;
        console.log("✅ PostgreSQL conectada");
        return true;
    } catch (err) {
        console.error("❌ Error DB:", err.message);
        connected = false;
        return false;
    }
}

module.exports = {
    initDB,
    pool,
    isDBConnected: () => connected
};
