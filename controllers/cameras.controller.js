const { pool } = require("../database/initDB");

// Crear o registrar cámara
exports.createOrUpdate = async (req, res) => {
    const { device_id, name, location } = req.body;

    if (!device_id) {
        return res.status(400).json({ error: "device_id requerido" });
    }

    try {
        await pool.query(`
            INSERT INTO camaras (device_id, name, location)
            VALUES ($1, $2, $3)
            ON CONFLICT (device_id)
            DO UPDATE SET 
                name = EXCLUDED.name,
                location = EXCLUDED.location
        `, [device_id, name || device_id, location || null]);

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Error guardando cámara:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// Listar cámaras
exports.list = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM camaras ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error("❌ Error obteniendo cámaras:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// Obtener una cámara
exports.getOne = async (req, res) => {
    const { device_id } = req.params;

    try {
        const result = await pool.query(
            "SELECT * FROM camaras WHERE device_id = $1",
            [device_id]
        );

        res.json(result.rows[0] || null);

    } catch (err) {
        console.error("❌ Error obteniendo cámara:", err.message);
        res.status(500).json({ error: err.message });
    }
};

// Eliminar cámara
exports.delete = async (req, res) => {
    const { device_id } = req.params;

    try {
        await pool.query(
            "DELETE FROM camaras WHERE device_id = $1",
            [device_id]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Error eliminando cámara:", err.message);
        res.status(500).json({ error: err.message });
    }
};