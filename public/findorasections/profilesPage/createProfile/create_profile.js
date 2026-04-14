import { CONFIG } from './../../../js/config.js';
document.getElementById('saveProfileBtn').onclick = async () => {
// Validar campos
  const name = document.getElementById('nameInput').value.trim();
  const age = parseInt(document.getElementById('ageInput').value.trim());
  const gender = document.getElementById('genderInput').value;
  const status = document.getElementById('statusInput').value;
  const birthday = document.getElementById('birthdayInput').value;
  const files = document.getElementById('refFiles').files;
  const grade = document.getElementById('gradeInput').value;

    if (status === 'estudiante' && !grade) {
        alert('Selecciona un grado para el estudiante');
        return;
    }
// Validación básica
const statusInput = document.getElementById('statusInput');
const gradeLabel = document.getElementById('gradeLabel');

statusInput.addEventListener('change', () => {
  if (statusInput.value === 'estudiante') {
    gradeLabel.style.display = 'block';
  } else {
    gradeLabel.style.display = 'none';
  }
});
  if (!name || !age || !gender || !status || !birthday || files.length === 0) {
      alert('Completa todos los campos y agrega entre 1 y 5 imágenes.');
      return;
  }
// Crear FormData para enviar al backend
const form = new FormData();
form.append('name', name);
form.append('age', age);
form.append('gender', gender);
form.append('status', status);
form.append('grade', grade);
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
// Función para subir perfiles desde Excel
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
        form.append('grade', row.grade || '');

        if (row.status === 'estudiante' && !row.grade) {
            console.warn("Estudiante sin grado:", row);
            return false;
        }

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