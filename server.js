// ---------------------------------------------------------
// SERVER.JS — POSTGRES + SUPABASE STORAGE + WebRTC
// Versión con manejo de errores mejorado
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

// Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public folder
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/findorasections/mainPage/Page.html");
});

// ---------------------------------------------------------
// POSTGRESQL CON MANEJO DE ERRORES MEJORADO
// ---------------------------------------------------------
const { Pool } = require("pg");

let pool = null;
let dbConnected = false;

// ✅ Configuración con timeout y retry
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
};

// Crear pool con manejo de errores
try {
    if (process.env.DATABASE_URL) {
        pool = new Pool(poolConfig);
        
        // ✅ Manejar errores del pool sin crashear
        pool.on('error', (err) => {
            console.error('❌ Error inesperado en pool de DB:', err.message);
            dbConnected = false;
            // NO lanzar error, solo marcar como desconectado
        });

        pool.on('connect', () => {
            console.log('✅ Nueva conexión establecida al pool');
        });

        console.log('🔧 Pool de PostgreSQL configurado');
    } else {
        console.warn('⚠️ DATABASE_URL no encontrada en variables de entorno');
    }
} catch (error) {
    console.error('❌ Error configurando pool:', error.message);
    pool = null;
}

// ✅ Función de inicialización con retry y manejo de errores
async function initDB(retries = 5) {
    if (!pool) {
        console.warn('⚠️ Pool no disponible, servidor continuará sin DB');
        return false;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`\n🔄 Intento ${attempt}/${retries} - Conectando a PostgreSQL...`);
            
            // Test de conexión
            const client = await pool.connect();
            console.log('✅ Conexión a PostgreSQL exitosa');
            
            // Verificar versión
            const versionResult = await client.query('SELECT version()');
            const version = versionResult.rows[0].version.split(' ');
            console.log(`📊 PostgreSQL: ${version[0]} ${version[1]}`);
            
            client.release();

            // Crear tablas
            await createTables();
            
            dbConnected = true;
            console.log('🎉 Base de datos inicializada correctamente\n');
            return true;

        } catch (error) {
            console.error(`❌ Intento ${attempt}/${retries} falló:`);
            console.error('   Error:', error.message);
            console.error('   Código:', error.code);

            if (attempt === retries) {
                console.error('\n💥 No se pudo conectar a PostgreSQL después de todos los intentos');
                console.warn('⚠️ El servidor continuará sin base de datos');
                console.warn('⚠️ Solo estarán disponibles funciones que no requieren DB\n');
                dbConnected = false;
                return false;
            }

            // Esperar antes de reintentar (backoff exponencial)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`⏳ Esperando ${delay/1000}s antes de reintentar...\n`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return false;
}

// ✅ Crear tablas con manejo de errores individual
async function createTables() {
    const tables = [
        {
            name: 'perfiles',
            sql: `CREATE TABLE IF NOT EXISTS perfiles (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL
            )`
        },
        {
            name: 'referencias',
            sql: `CREATE TABLE IF NOT EXISTS referencias (
                id SERIAL PRIMARY KEY,
                profile_id INTEGER REFERENCES perfiles(id) ON DELETE CASCADE,
                file_path TEXT
            )`
        },
        {
            name: 'notificaciones',
            sql: `CREATE TABLE IF NOT EXISTS notificaciones (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'ubicaciones',
            sql: `CREATE TABLE IF NOT EXISTS ubicaciones (
                profile_id INTEGER REFERENCES perfiles(id) ON DELETE CASCADE,
                last_room TEXT,
                last_seen TIMESTAMP,
                CONSTRAINT unique_profile UNIQUE(profile_id)
            )`
        }
    ];

    for (const table of tables) {
        try {
            await pool.query(table.sql);
            console.log(`  ✅ Tabla '${table.name}' verificada/creada`);
        } catch (error) {
            console.error(`  ❌ Error creando tabla '${table.name}':`, error.message);
            throw error; // Re-lanzar para que initDB maneje el retry
        }
    }
}

// ✅ Middleware para verificar que la DB esté disponible
function requireDB(req, res, next) {
    if (!dbConnected || !pool) {
        return res.status(503).json({ 
            error: 'Base de datos no disponible',
            message: 'El servicio requiere conexión a base de datos. Por favor, intente más tarde.'
        });
    }
    next();
}

// ---------------------------------------------------------
// SUPABASE STORAGE
// ---------------------------------------------------------
const { createClient } = require("@supabase/supabase-js");

let supabase = null;

try {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        console.log('✅ Cliente de Supabase configurado');
    } else {
        console.warn('⚠️ Credenciales de Supabase no encontradas');
    }
} catch (error) {
    console.error('❌ Error configurando Supabase:', error.message);
}

// ✅ Middleware para verificar Supabase
function requireSupabase(req, res, next) {
    if (!supabase) {
        return res.status(503).json({ 
            error: 'Almacenamiento no disponible',
            message: 'El servicio de almacenamiento no está configurado.'
        });
    }
    next();
}

// ---------------------------------------------------------
// MULTER (solo en memoria)
// ---------------------------------------------------------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// ---------------------------------------------------------
// SUBIR ARCHIVOS A SUPABASE
// ---------------------------------------------------------
async function uploadImageToSupabase(profileId, file) {
    if (!supabase) {
        throw new Error('Supabase no está configurado');
    }

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

    const { data } = supabase.storage
        .from("perfiles")
        .getPublicUrl(fileName);

    return data.publicUrl;
}

// ---------------------------------------------------------
// HEALTH CHECK (no requiere DB)
// ---------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database: dbConnected ? 'connected' : 'disconnected',
            supabase: supabase ? 'configured' : 'not configured'
        }
    });
});

// ---------------------------------------------------------
// API: CREAR PERFIL CON IMÁGENES
// ---------------------------------------------------------
app.post("/api/new_profile", requireDB, requireSupabase, upload.array("refs", 5), async (req, res) => {
    const { name, age } = req.body;
    const files = req.files;

    console.log("📥 Nueva solicitud de perfil:", { name, age, filesCount: files?.length });

    if (!name || !age || !files || files.length === 0) {
        return res.status(400).json({ error: "Faltan datos (name, age, refs)" });
    }

    try {
        const result = await pool.query(
            "INSERT INTO perfiles (name, age) VALUES ($1, $2) RETURNING id",
            [name, age]
        );

        const profileId = result.rows[0].id;
        console.log(`✅ Perfil creado con ID: ${profileId}`);

        for (const file of files) {
            const publicUrl = await uploadImageToSupabase(profileId, file);

            await pool.query(
                "INSERT INTO referencias (profile_id, file_path) VALUES ($1, $2)",
                [profileId, publicUrl]
            );
            
            console.log(`  ✅ Imagen subida: ${file.originalname}`);
        }

        res.json({ success: true, id: profileId });

    } catch (err) {
        console.error('❌ Error creando perfil:', err);
        res.status(500).json({ error: "Error creando perfil: " + err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER PERFILES COMPLETOS
// ---------------------------------------------------------
app.get("/api/profiles_full", requireDB, async (req, res) => {
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
        console.error('❌ Error obteniendo perfiles:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: LISTAR TODOS LOS PERFILES
// ---------------------------------------------------------
app.get("/api/profiles", requireDB, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, age FROM perfiles ORDER BY id DESC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error listando perfiles:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER PERFIL INDIVIDUAL
// ---------------------------------------------------------
app.get("/api/profile/:id", requireDB, async (req, res) => {
    const id = req.params.id;

    try {
        const p = await pool.query("SELECT * FROM perfiles WHERE id = $1", [id]);

        if (p.rows.length === 0) {
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

    } catch (err) {
        console.error('❌ Error obteniendo perfil:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: EDITAR PERFIL
// ---------------------------------------------------------
app.put("/api/edit_profile/:id", requireDB, async (req, res) => {
    const id = req.params.id;
    const { name, age } = req.body;

    try {
        await pool.query(
            "UPDATE perfiles SET name = $1, age = $2 WHERE id = $3",
            [name, age, id]
        );

        res.json({ success: true });

    } catch (err) {
        console.error('❌ Error editando perfil:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: AGREGAR IMÁGENES A UN PERFIL
// ---------------------------------------------------------
app.post("/api/add_images/:id", requireDB, requireSupabase, upload.array("refs", 5), async (req, res) => {
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
        console.error('❌ Error agregando imágenes:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: ACTUALIZAR UBICACIÓN
// ---------------------------------------------------------
app.post("/api/update_location", requireDB, async (req, res) => {
    const { profile_id, last_room } = req.body;

    if (!profile_id || !last_room) {
        return res.status(400).json({ error: "Faltan datos (profile_id, last_room)" });
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
        console.error('❌ Error actualizando ubicación:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER UBICACIÓN
// ---------------------------------------------------------
app.get("/api/location/:profileId", requireDB, async (req, res) => {
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
        console.error('❌ Error obteniendo ubicación:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: ELIMINAR PERFIL
// ---------------------------------------------------------
app.delete("/api/delete_profile/:id", requireDB, async (req, res) => {
    const id = req.params.id;

    try {
        // Las referencias se eliminan automáticamente por ON DELETE CASCADE
        await pool.query("DELETE FROM perfiles WHERE id = $1", [id]);

        res.json({ success: true });

    } catch (err) {
        console.error('❌ Error eliminando perfil:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: GUARDAR NOTIFICACIONES
// ---------------------------------------------------------
app.post("/api/notifications", requireDB, async (req, res) => {
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
        console.error('❌ Error guardando notificación:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: OBTENER NOTIFICACIONES
// ---------------------------------------------------------
app.get("/api/notifications", requireDB, async (req, res) => {
    const limit = req.query.limit || 100;

    try {
        const result = await pool.query(
            "SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT $1",
            [limit]
        );

        res.json(result.rows);

    } catch (err) {
        console.error('❌ Error obteniendo notificaciones:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// API: LIMPIAR NOTIFICACIONES ANTIGUAS
// ---------------------------------------------------------
app.delete("/api/notifications/cleanup", requireDB, async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM notificaciones WHERE created_at < NOW() - INTERVAL '7 days'"
        );

        res.json({ success: true });

    } catch (err) {
        console.error('❌ Error limpiando notificaciones:', err);
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// WEBSOCKET
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
    console.log('🔌 Nuevo cliente WebSocket conectado');
    
    ws.on("message", (msg) => {
        // Broadcast a todos los demás clientes
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });

    ws.on('close', () => {
        console.log('🔌 Cliente WebSocket desconectado');
    });

    ws.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error.message);
    });
});

// ---------------------------------------------------------
// INICIAR SERVIDOR
// ---------------------------------------------------------
const PORT = process.env.PORT || 8080;

async function startServer() {
    try {
        console.log('\n🚀 Iniciando servidor Findora...');
        console.log('='.repeat(60));
        
        // Intentar inicializar DB (no bloqueante)
        await initDB();
        
        // Iniciar servidor HTTP
        server.listen(PORT, '0.0.0.0', () => {
            console.log('='.repeat(60));
            console.log(`✅ Servidor HTTP escuchando en puerto ${PORT}`);
            console.log(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🗄️  PostgreSQL: ${dbConnected ? 'Conectada ✅' : 'Desconectada ⚠️'}`);
            console.log(`☁️  Supabase: ${supabase ? 'Configurado ✅' : 'No configurado ⚠️'}`);
            console.log(`🔌 WebSocket: Disponible en /ws`);
            console.log('='.repeat(60));
            console.log('\n📡 Esperando conexiones...\n');
        });

    } catch (error) {
        console.error('💥 Error crítico iniciando servidor:', error);
        process.exit(1);
    }
}

// Manejar cierre graceful
process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM recibido, cerrando servidor...');
    
    if (pool) {
        await pool.end();
        console.log('✅ Pool de PostgreSQL cerrado');
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT recibido, cerrando servidor...');
    
    if (pool) {
        await pool.end();
        console.log('✅ Pool de PostgreSQL cerrado');
    }
    
    process.exit(0);
});

// Iniciar servidor
startServer();

module.exports = { app, pool };