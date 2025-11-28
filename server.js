// server.js listo para RENDER + WebRTC + SQL + subida de imágenes

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sqlite3 = require("sqlite3");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------
// SERVIR /public (tu proyecto actual)
// ---------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------
// CREAR BD SQLITE
// ---------------------------------------------------------
const db = new sqlite3.Database("database.sqlite");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS perfiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS referencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER,
            file_path TEXT,
            FOREIGN KEY(profile_id) REFERENCES perfiles(id)
        )
    `);
});

// ---------------------------------------------------------
// CONFIGURAR MULTER PARA SUBIR IMAGENES
// ---------------------------------------------------------
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, "public", "references", "perfiles");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const unique = Date.now() + "-" + Math.round(Math.random() * 99999);
        cb(null, unique + ext);
    }
});
const upload = multer({ storage });

// ---------------------------------------------------------
// API: CREAR PERFIL NUEVO
// ---------------------------------------------------------
app.post("/api/new_profile", upload.array("refs", 5), (req, res) => {
    const { name, age } = req.body;
    const files = req.files;

    if (!name || !age || files.length === 0) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    db.run(
        `INSERT INTO perfiles (name, age) VALUES (?, ?)`,
        [name, age],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const profileId = this.lastID;

            const stmt = db.prepare(`
                INSERT INTO referencias (profile_id, file_path)
                VALUES (?, ?)
            `);

            files.forEach(f => {
                stmt.run(profileId, `/references/perfiles/${f.filename}`);
            });

            stmt.finalize();

            res.json({ success: true, id: profileId });
        }
    );
});

// ---------------------------------------------------------
// API: LISTA DE PERFILES
// ---------------------------------------------------------
app.get("/api/profiles", (req, res) => {
    db.all(`SELECT id, name, age FROM perfiles ORDER BY id DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ---------------------------------------------------------
// API: PERFIL INDIVIDUAL
// ---------------------------------------------------------
app.get("/api/profile/:id", (req, res) => {
    const id = req.params.id;

    db.get(`SELECT * FROM perfiles WHERE id = ?`, [id], (err, profile) => {
        if (err || !profile) return res.status(404).json({ error: "Perfil no encontrado" });

        db.all(`SELECT file_path FROM referencias WHERE profile_id = ?`, [id], (err, refs) => {
            if (err) return res.status(500).json({ error: err.message });

            profile.references = refs;
            res.json(profile);
        });
    });
});

// ---------------------------------------------------------
// WEBSOCKET (Tu código original, intacto)
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
// API: EDITAR NOMBRE Y EDAD
// ---------------------------------------------------------
app.put("/api/edit_profile/:id", (req, res) => {
    const id = req.params.id;
    const { name, age } = req.body;

    if (!name || !age)
        return res.status(400).json({ error: "Datos incompletos" });

    db.run(
        `UPDATE perfiles SET name = ?, age = ? WHERE id = ?`,
        [name, age, id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// ---------------------------------------------------------
// API: AGREGAR NUEVAS IMÁGENES AL PERFIL
// ---------------------------------------------------------
app.post("/api/add_images/:id", upload.array("refs", 5), (req, res) => {
    const id = req.params.id;
    const files = req.files;

    if (!files || files.length === 0)
        return res.status(400).json({ error: "No llegaron imágenes" });

    const stmt = db.prepare(
        `INSERT INTO referencias (profile_id, file_path) VALUES (?, ?)`
    );

    files.forEach((file) => {
        stmt.run(id, `/references/perfiles/${file.filename}`);
    });

    stmt.finalize();

    res.json({ success: true });
});


// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log("Servidor escuchando en puerto " + PORT);
});
