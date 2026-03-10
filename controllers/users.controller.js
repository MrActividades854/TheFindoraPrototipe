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

        // verificar si ya existe un admin
        const adminCheck = await pool.query(
            "SELECT id FROM usuarios WHERE role = 'admin'"
        );

        const adminExists = adminCheck.rows.length > 0;

        // si ya existe admin, exigir autenticación
        if (adminExists) {

            const token = req.headers.authorization?.split(" ")[1];

            if (!token) {
                return res.status(401).json({ error: "No autorizado" });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.role !== "admin") {
                return res.status(403).json({ error: "Solo admin puede registrar usuarios" });
        }
        }

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

exports.listUsers = async (req,res)=>{

const result = await pool.query(`
SELECT id,name,email,role,registration_date
FROM usuarios
ORDER BY registration_date DESC
`);

res.json(result.rows);
};

exports.getUser = async (req,res)=>{

const {id}=req.params;

const result = await pool.query(
"SELECT id,name,email,age,gender,birthday,role,registration_date FROM usuarios WHERE id=$1",
[id]
);

if(result.rows.length===0){
return res.status(404).json({error:"Usuario no encontrado"});
}

res.json(result.rows[0]);

};

exports.updateUser = async (req,res)=>{

const {id}=req.params;

const {name,email,age,gender,birthday,role}=req.body;

await pool.query(`
UPDATE usuarios
SET name=$1,email=$2,age=$3,gender=$4,birthday=$5,role=$6
WHERE id=$7
`,
[name,email,age,gender,birthday,role,id]);

res.json({message:"Usuario actualizado"});

};

exports.deleteUser = async (req,res)=>{

const {id}=req.params;

await pool.query(
"DELETE FROM usuarios WHERE id=$1",
[id]
);

res.json({message:"Usuario eliminado"});

};