// ---------------------------------------------------------
// SERVER.JS — POSTGRES + SUPABASE STORAGE + WebRTC
// ---------------------------------------------------------

require("dotenv").config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_KEY;

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

// Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Public folder
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------
// POSTGRESQL (RAILWAY)
// ---------------------------------------------------------
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Crear tablas automáticamente
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS perfiles (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS referencias (
            id SERIAL PRIMARY KEY,
            profile_id INTEGER REFERENCES perfiles(id),
            file_path TEXT
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ubicaciones (
    profile_id INTEGER REFERENCES perfiles(id),
    last_room TEXT,
    last_seen TIMESTAMP,
    CONSTRAINT unique_profile UNIQUE(profile_id)
        );
    `);

    console.log("✓ PostgreSQL conectado y listo");
}
initDB();

// ---------------------------------------------------------
// SUPABASE STORAGE
// ---------------------------------------------------------
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ---------------------------------------------------------
// MULTER (solo en memoria → NO usa disco)
// ---------------------------------------------------------
const upload = multer({
    storage: multer.memoryStorage(), // <<<<<< IMPORTANTE
    limits: { fileSize: 15 * 1024 * 1024 }
});

// ---------------------------------------------------------
// SUBIR ARCHIVOS A SUPABASE
// ---------------------------------------------------------
async function uploadImageToSupabase(profileId, file) {
    const fileName = `perfil-${profileId}/${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await supabase.storage
        .from("perfiles")
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
    }

    // obtener URL pública
    const { data } = supabase.storage
        .from("perfiles")
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// ---------------------------------------------------------
// API: CREAR PERFIL CON IMÁGENES
// ---------------------------------------------------------
app.post("/api/new_profile", upload.array("refs", 5), async (req, res) => {
    const { name, age } = req.body;
    const files = req.files;

    if (!name || !age || files.length === 0)
        return res.status(400).json({ error: "Faltan datos" });

    try {
        const result = await pool.query(
            "INSERT INTO perfiles (name, age) VALUES ($1, $2) RETURNING id",
            [name, age]
        );

        const profileId = result.rows[0].id;

        for (const file of files) {
            const publicUrl = await uploadImageToSupabase(profileId, file);

            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [profileId, publicUrl]
            );
        }

        res.json({ success: true, id: profileId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error creando perfil" });
    }
    console.log("FILES RECIBIDOS:", req.files);
});

app.get("/api/profiles_full", async (req, res) => {
    try {
        const profiles = await pool.query("SELECT * FROM perfiles ORDER BY id DESC");

        const finalList = [];

        for (let p of profiles.rows) {
            const refs = await pool.query(
                "SELECT file_path FROM referencias WHERE profile_id = $1",
                [p.id]
            );

            finalList.push({
                id: p.id,
                name: p.name,
                age: p.age,
                images: refs.rows.map(r => r.file_path)
            });

        }

        res.json(finalList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// ---------------------------------------------------------
// API: LISTAR TODOS LOS PERFILES
// ---------------------------------------------------------
app.get("/api/profiles", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, age FROM perfiles ORDER BY id DESC"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER PERFIL INDIVIDUAL
// ---------------------------------------------------------
app.get("/api/profile/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const p = await pool.query("SELECT * FROM perfiles WHERE id = $1", [id]);

        if (p.rows.length === 0)
            return res.status(404).json({ error: "Perfil no encontrado" });

        const refs = await pool.query(
            "SELECT file_path FROM referencias WHERE profile_id = $1",
            [id]
        );

        res.json({
            ...p.rows[0],
            references: refs.rows
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: EDITAR PERFIL
// ---------------------------------------------------------
app.put("/api/edit_profile/:id", async (req, res) => {
    const id = req.params.id;
    const { name, age } = req.body;

    try {
        await pool.query(
            "UPDATE perfiles SET name = $1, age = $2 WHERE id = $3",
            [name, age, id]
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: AGREGAR IMÁGENES A UN PERFIL
// ---------------------------------------------------------
app.post("/api/add_images/:id", upload.array("refs", 5), async (req, res) => {
    const profileId = req.params.id;
    const files = req.files;

    try {
        for (const file of files) {
            const publicUrl = await uploadImageToSupabase(profileId, file);

            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [profileId, publicUrl]
            );
        }

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/update_location", async (req, res) => {
    const { profile_id, last_room } = req.body;

    if (!profile_id || !last_room) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    try {
        await pool.query(`
            INSERT INTO ubicaciones (profile_id, last_room, last_seen)
            VALUES ($1, $2, NOW())
            ON CONFLICT (profile_id)
            DO UPDATE SET last_room = EXCLUDED.last_room, last_seen = NOW()
        `, [profile_id, last_room]);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/location/:profileId", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT last_room, last_seen FROM ubicaciones WHERE profile_id = $1",
            [req.params.profileId]
        );

        if (result.rows.length === 0) return res.json(null);

        res.json(result.rows[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// ---------------------------------------------------------
// API: ELIMINAR PERFIL (NO es necesario borrar archivo en Supabase)
// ---------------------------------------------------------
app.delete("/api/delete_profile/:id", async (req, res) => {
    const id = req.params.id;

    try {
        await pool.query("DELETE FROM referencias WHERE profile_id = $1", [id]);
        await pool.query("DELETE FROM perfiles WHERE id = $1", [id]);

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: GUARDAR NOTIFICACIONES
// ---------------------------------------------------------
app.post("/api/notifications", async (req, res) => {
    const { message, type } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Falta mensaje" });
    }

    try {
        await pool.query(
            "INSERT INTO notificaciones (message, type) VALUES ($1, $2)",
            [message, type || 'info']
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER NOTIFICACIONES
// ---------------------------------------------------------
app.get("/api/notifications", async (req, res) => {
    const limit = req.query.limit || 100;

    try {
        const result = await pool.query(
            "SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT $1",
            [limit]
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: LIMPIAR NOTIFICACIONES ANTIGUAS (más de 7 días)
// ---------------------------------------------------------
app.delete("/api/notifications/cleanup", async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM notificaciones WHERE created_at < NOW() - INTERVAL '7 days'"
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// WEBSOCKET (igual que tu código original)
// ---------------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    } else {
        socket.destroy();
    }
});

wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });
});

// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
});
