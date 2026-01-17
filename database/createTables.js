module.exports = async (pool) => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS perfiles (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS referencias (
            id SERIAL PRIMARY KEY,
            profile_id INTEGER REFERENCES perfiles(id) ON DELETE CASCADE,
            file_path TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ubicaciones (
            profile_id INTEGER UNIQUE REFERENCES perfiles(id),
            last_room TEXT,
            last_seen TIMESTAMP
        )
    `);
};
