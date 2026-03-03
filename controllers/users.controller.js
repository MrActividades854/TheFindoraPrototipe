const { pool } = require("../database/initDB");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

exports.register = async (req, res) => {
    const {
        name,
        email,
        password,
        age,
        gender,
        birthday,
        role
    } = req.body;

    try {
        if (!name || !email || !password || !age || !gender || !birthday) {
            return res.status(400).json({ error: "Faltan datos" });
        }

        const existing = await pool.query(
            "SELECT id FROM usuarios WHERE email = $1",
            [email]
        );

        if (existing.rows.length) {
            return res.status(400).json({ error: "Email ya registrado" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(`
            INSERT INTO usuarios
            (name, email, password, age, gender, birthday, role)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [
            name,
            email,
            hashedPassword,
            age,
            gender,
            birthday,
            role || "staff"
        ]);

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Error registrando usuario:", err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM usuarios WHERE email = $1",
            [email]
        );

        if (!result.rows.length) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const user = result.rows[0];

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role,
                profile_id: user.profile_id
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({ token });

    } catch (err) {
        console.error("❌ Error login:", err.message);
        res.status(500).json({ error: err.message });
    }
};