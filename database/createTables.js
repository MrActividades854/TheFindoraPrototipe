module.exports = async (pool) => {

    // Tabla para almacenar perfiles de usuario
    await pool.query(`
        CREATE TABLE IF NOT EXISTS perfiles (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            status VARCHAR(20),
            birthday DATE,
            last_seen TIMESTAMP
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
};
