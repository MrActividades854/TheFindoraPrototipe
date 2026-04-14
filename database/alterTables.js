module.exports = async (pool) => {

    // Modificar tabla perfiles
    await pool.query(`
        ALTER TABLE perfiles
        ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
        ADD COLUMN IF NOT EXISTS status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS grade VARCHAR(20),
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

    // Modificar tabla usuarios
    await pool.query(`
        ALTER TABLE usuarios
        ADD COLUMN IF NOT EXISTS age INTEGER NOT NULL,
        ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
        ADD COLUMN IF NOT EXISTS birthday DATE,
        ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'staff',
        ADD CCOLUMN IF NOT EXISTS grade VARCHAR(20),
        ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ADD COLUMN IF NOT EXISTS profile_id INTEGER UNIQUE REFERENCES perfiles(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS profile_image TEXT
    `);

    await pool.query(`
        ALTER TABLE usuarios
        ALTER COLUMN grade TYPE VARCHAR(2O)
    `);

    //
    await pool.query(`
        ALTER TABLE camaras
        ADD COLUMN IF NOT EXISTS name TEXT,
        ADD COLUMN IF NOT EXISTS location TEXT,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

};
