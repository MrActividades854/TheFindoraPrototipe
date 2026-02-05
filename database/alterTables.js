module.exports = async (pool) => {

    // Modificar tabla perfiles
    await pool.query(`
        ALTER TABLE perfiles
        ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
        ADD COLUMN IF NOT EXISTS status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS birthday DATE
    `);

    // Modificar tabla referencias
    await pool.query(`
        ALTER TABLE referencias
        ADD COLUMN IF NOT EXISTS file_path TEXT
    `);

    // Modificar tabla notificaciones
    await pool.query(`
        ALTER TABLE notificaciones
        ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // Modificar tabla ubicaciones
    await pool.query(`
        ALTER TABLE ubicaciones
        ADD COLUMN IF NOT EXISTS last_room TEXT,
        ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP
    `);

};
