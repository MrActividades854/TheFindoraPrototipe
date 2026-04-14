const { pool } = require("../database/initDB");
const supabase = require("../config/supabase");

async function uploadImage(profileId, file) {
    const fileName = `perfil-${profileId}/${Date.now()}-${file.originalname}`;

    const { error } = await supabase.storage
        .from("perfiles")
        .upload(fileName, file.buffer, {
            contentType: file.mimetype
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from("perfiles")
        .getPublicUrl(fileName);

    return data.publicUrl;
}

exports.create = async (req, res) => {
    const { name, age, gender, status, grade, birthday } = req.body;
    const files = req.files;

    if (!name || !age || !files?.length) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    if (status === 'estudiante' && !grade) {
        return res.status(400).json({ error: "El estudiante debe tener grado" });
    }

    try {
        const result = await pool.query(
            "INSERT INTO perfiles (name, age, gender, status, birthday, grade) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [name, age, gender, status, birthday, grade]
        );

        const profileId = result.rows[0].id;

        for (const file of files) {
            const url = await uploadImage(profileId, file);
            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [profileId, url]
            );
        }

        res.json({ success: true, id: profileId });
    } catch (err) {
        console.error("Error creando perfil:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.list = async (req, res) => {
    try {
        const result = await pool.query(
        "SELECT id, name, age FROM perfiles ORDER BY id DESC"
    );
    res.json(result.rows);
    } catch (err) {
        console.error("Error listando perfiles:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.listFull = async (req, res) => {
    try {
        const profiles = await pool.query("SELECT * FROM perfiles ORDER BY id DESC");

        const final = [];

        for (const p of profiles.rows) {
            const refs = await pool.query(
                "SELECT file_path FROM referencias WHERE profile_id = $1",
                [p.id]
            );

            final.push({
                ...p,
                images: refs.rows.map(r => r.file_path)
            });
        }

        res.json(final);

    } catch (err) {
        console.error("Error listando perfiles completos:", err.message);
        res.status(500).json({ error: err.message });
};
};

exports.getOne = async (req, res) => {
    const id = req.params.id;

    const p = await pool.query(
        "SELECT * FROM perfiles WHERE id = $1",
        [id]
    );

    if (!p.rows.length) {
        return res.status(404).json({ error: "Perfil no encontrado" });
    }

    const refs = await pool.query(
        "SELECT file_path FROM referencias WHERE profile_id = $1",
        [id]
    );

    res.json({
        ...p.rows[0],
        references: refs.rows
    });
};

exports.update = async (req, res) => {
    const { name, age, gender, status, birthday, grade } = req.body;

    try {
        await pool.query(
            "UPDATE perfiles SET name = $1, age = $2, gender = $3, status = $4, birthday = $5, grade = $6 WHERE id = $7",
            [name, age, gender, status, birthday, grade, req.params.id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Error actualizando perfil:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.remove = async (req, res) => {
    await pool.query(
        "DELETE FROM perfiles WHERE id = $1",
        [req.params.id]
    );

    res.json({ success: true });
};
