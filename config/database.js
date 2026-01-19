const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL no definida");
    module.exports = null;
    return;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on("error", err => {
    console.error("❌ Pool error:", err.message);
});

module.exports = pool;
