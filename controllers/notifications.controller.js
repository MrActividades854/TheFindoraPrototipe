const { pool } = require("../database/initDB");

exports.create = async (req, res) => {
    const { message, type } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Falta mensaje" });
    }

    try {
        await pool.query(
            "INSERT INTO notificaciones (message, type) VALUES ($1, $2)",
            [message, type || "info"]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error guardando notificación:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.list = async (req, res) => {
    const limit = req.query.limit || 100;

    try {
        const result = await pool.query(
            "SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT $1",
            [limit]
        );

        res.json(result.rows);
    } catch (err) {
        console.error("Error obteniendo notificaciones:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.cleanup = async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM notificaciones WHERE created_at < NOW() - INTERVAL '7 days'"
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error limpiando notificaciones:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.clearall = async (req, res) => {
    try {
        await pool.query("DELETE FROM notificaciones");
        res.json({ success: true });
    } catch (err) {
        console.error("Error clearing all notifications:", err.message);
        res.status(500).json({ error: err.message });
    }
};