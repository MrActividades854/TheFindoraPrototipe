// ---------------------------------------------------------
// SERVER.JS — COMPLETAMENTE MIGRADO A POSTGRESQL (RAILWAY)
// WebRTC conservado, Multer funcionando, API full SQL
// ---------------------------------------------------------

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");

// ---------------------------------------------------------
// EXPRESS CONFIG
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------
// POSTGRESQL (RAILWAY)
// ---------------------------------------------------------
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Crear tablas si no existen
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

    console.log("✓ PostgreSQL listo en Railway");
}

initDB().catch(console.error);

// ---------------------------------------------------------
// MULTER — SUBIDA DE IMÁGENES
// ---------------------------------------------------------
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, "public", "references", "perfiles");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + "-" + Math.round(Math.random() * 99999);
        const ext = path.extname(file.originalname);
        cb(null, unique + ext);
    }
});

const upload = multer({ storage });

// ---------------------------------------------------------
// API: CREAR PERFIL NUEVO
// ---------------------------------------------------------
app.post("/api/new_profile", upload.array("refs", 5), async (req, res) => {
    const { name, age } = req.body;
    const files = req.files;

    if (!name || !age || files.length === 0)
        return res.status(400).json({ error: "Faltan datos" });

    try {
        // Crear el perfil
        const profileResult = await pool.query(
            "INSERT INTO perfiles (name, age) VALUES ($1, $2) RETURNING id",
            [name, age]
        );

        const profileId = profileResult.rows[0].id;

        // Guardar imágenes
        for (const file of files) {
            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [profileId, `/references/perfiles/${file.filename}`]
            );
        }

        res.json({ success: true, id: profileId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error guardando perfil" });
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
// API: PERFIL INDIVIDUAL
// ---------------------------------------------------------
app.get("/api/profile/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const profile = await pool.query(
            "SELECT * FROM perfiles WHERE id = $1",
            [id]
        );

        if (profile.rows.length === 0)
            return res.status(404).json({ error: "Perfil no encontrado" });

        const refs = await pool.query(
            "SELECT file_path FROM referencias WHERE profile_id = $1",
            [id]
        );

        res.json({
            ...profile.rows[0],
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

    if (!name || !age)
        return res.status(400).json({ error: "Datos incompletos" });

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
// API: AGREGAR IMÁGENES A PERFIL EXISTENTE
// ---------------------------------------------------------
app.post("/api/add_images/:id", upload.array("refs", 5), async (req, res) => {
    const id = req.params.id;
    const files = req.files;

    if (!files || files.length === 0)
        return res.status(400).json({ error: "No llegaron imágenes" });

    try {
        for (const file of files) {
            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [id, `/references/perfiles/${file.filename}`]
            );
        }

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: ELIMINAR PERFIL COMPLETO
// ---------------------------------------------------------
app.delete("/api/delete_profile/:id", async (req, res) => {
    const id = req.params.id;

    try {
        // Borrar imágenes del servidor
        const refs = await pool.query(
            "SELECT file_path FROM referencias WHERE profile_id = $1",
            [id]
        );

        refs.rows.forEach(r => {
            const filePath = path.join(__dirname, "public", r.file_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        // Borrar referencias de DB
        await pool.query(
            "DELETE FROM referencias WHERE profile_id = $1",
            [id]
        );

        // Borrar perfil
        await pool.query(
            "DELETE FROM perfiles WHERE id = $1",
            [id]
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// WEBSOCKET (TU CÓDIGO ORIGINAL, INTACTO)
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
    console.log("[WS] Cliente conectado");

    ws.on("message", (msg) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });

    ws.on("close", () => {
        console.log("[WS] Cliente desconectado");
    });
});

// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
});
