const { pool } = require("../database/initDB");

exports.update = async (req, res) => {
    const { profile_id, last_room } = req.body;

    if (!profile_id || !last_room) {
        return res.status(400).json({
            error: "Faltan datos (profile_id, last_room)"
        });
    }

    try {
        await pool.query(`
            INSERT INTO ubicaciones (profile_id, last_room, last_seen)
            VALUES ($1, $2, NOW())
            ON CONFLICT (profile_id)
            DO UPDATE SET
                last_room = EXCLUDED.last_room,
                last_seen = NOW()
        `, [profile_id, last_room]);

        res.json({ success: true });
    } catch (err) {
        console.error("❌ Error actualizando ubicación:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.get = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT last_room, last_seen FROM ubicaciones WHERE profile_id = $1",
            [req.params.profileId]
        );

        if (result.rows.length === 0) {
            return res.json(null);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error obteniendo ubicación:", err.message);
        res.status(500).json({ error: err.message });
    }
};
