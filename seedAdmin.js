const bcrypt = require("bcrypt");
const { pool } = require("./initDB");

async function seedAdmin() {

  const password = await bcrypt.hash("admin123", 10);

  await pool.query(`
    INSERT INTO usuarios
    (name,email,password,age,gender,birthday,role,registration_date)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
  `, [
    "Admin",
    "admin@findora.com",
    password,
    30,
    "otro",
    "1995-01-01",
    "admin"
  ]);

  console.log("✅ Admin creado");
  process.exit();
}

seedAdmin();