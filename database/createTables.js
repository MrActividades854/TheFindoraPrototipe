module.exports = async (pool) => {

    // Tabla para almacenar perfiles de usuario
    await pool.query(`
        CREATE TABLE IF NOT EXISTS perfiles (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender VARCHAR(10),
            status VARCHAR(20),
            birthday DATE
        )
    `);

    // Tabla para almacenar imágenes de perfil
    await pool.query(`
        CREATE TABLE IF NOT EXISTS referencias (
            id SERIAL PRIMARY KEY,
            profile_id INTEGER REFERENCES perfiles(id) ON DELETE CASCADE,
            file_path TEXT
        )
    `);

    // Tabla para notificaciones
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla para ubicaciones
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ubicaciones (
            profile_id INTEGER UNIQUE REFERENCES perfiles(id),
            last_room TEXT,
            last_seen TIMESTAMP
        )
    `);

    // Tabla de usuarios (login y permisos)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender VARCHAR(10),
            birthday DATE,
            role VARCHAR(20) DEFAULT 'staff', -- admin o staff
            registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            profile_id INTEGER UNIQUE REFERENCES perfiles(id) ON DELETE SET NULL,
            profile_image TEXT
        )
    `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS camaras (
        id SERIAL PRIMARY KEY,
        device_id TEXT UNIQUE NOT NULL, -- ID real de la cámara
        name TEXT,
        location TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
};

