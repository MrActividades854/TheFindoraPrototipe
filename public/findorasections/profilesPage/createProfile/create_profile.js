import { CONFIG } from './../../../js/config.js';
document.getElementById('saveProfileBtn').onclick = async () => {
  const name = document.getElementById('nameInput').value.trim();
  const age = parseInt(document.getElementById('ageInput').value.trim());
  const gender = document.getElementById('genderInput').value;
  const status = document.getElementById('statusInput').value;
  const birthday = document.getElementById('birthdayInput').value;
  const files = document.getElementById('refFiles').files;

  if (!name || !age || !gender || !status || !birthday || files.length === 0) {
      alert('Completa todos los campos y agrega entre 1 y 5 imágenes.');
      return;
  }

const form = new FormData();
form.append('name', name);
form.append('age', age);
form.append('gender', gender);
form.append('status', status);
form.append('birthday', birthday);
for (let f of files) form.append('refs', f);

const res = await fetch(`https://thefindoraprototipe.onrender.com/api/new_profile`, {
  method: 'POST',
  body: form
});

if (res.ok) {
  alert('Perfil guardado correctamente');
  localStorage.removeItem(CONFIG.PROFILES_KEY);
  fetchProfiles();
  location.href = './../profiles.html';
} else {
  alert('Error guardando perfil');
}
};

document.getElementById('uploadExcelBtn').onclick = async () => {
    const file = document.getElementById('excelInput').files[0];

    if (!file) {
        alert("Selecciona un archivo Excel");
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        console.log(jsonData);

        for (let row of jsonData) {
            await crearPerfilDesdeExcel(row);
        }

        alert("Perfiles subidos correctamente");
    };

    reader.readAsArrayBuffer(file);
};

async function crearPerfilDesdeExcel(row) {
    try {
        if (!row.name || !row.age || !row.gender || !row.status || !row.birthday) {
            console.warn("Fila inválida:", row);
            return false;
        }

        const form = new FormData();

        form.append('name', row.name);
        form.append('age', row.age);
        form.append('gender', row.gender);
        form.append('status', row.status);
        form.append('birthday', row.birthday);

        const res = await fetch(`https://thefindoraprototipe.onrender.com/api/new_profile`, {
            method: 'POST',
            body: form
        });

        return res.ok;

    } catch (err) {
        console.error("Error:", err);
        return false;
    }
}