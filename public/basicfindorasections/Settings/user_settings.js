const API = "https://thefindoraprototipe.onrender.com/api";
const token = localStorage.getItem("token");

// ======================
// 🔹 MENU
// ======================
document.querySelectorAll(".menu-item").forEach(item => {
  item.onclick = () => {

    document.querySelectorAll(".menu-item")
      .forEach(i => i.classList.remove("active"));

    item.classList.add("active");

    document.querySelectorAll(".panel")
      .forEach(p => p.classList.remove("active"));

    document.getElementById(item.dataset.data)
      .classList.add("active");
  };
});

// ======================
// 🔹 CARGAR USUARIO
// ======================
async function loadUser() {
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: "Bearer " + token }
  });

  const user = await res.json();

  document.getElementById("nameInput").value = user.name;
  document.getElementById("emailInput").value = user.email;

  if (user.profile_image) {
    document.getElementById("profileImg").src = user.profile_image;
  }
}

// ======================
// 🔹 ACTUALIZAR DATOS
// ======================
window.updateName = async () => {
  const name = document.getElementById("nameInput").value;

  await fetch(`${API}/user/update_name`, {
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body:JSON.stringify({name})
  });

  alert("Nombre actualizado");
};

window.updateEmail = async () => {
  const email = document.getElementById("emailInput").value;

  await fetch(`${API}/user/update_email`, {
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body:JSON.stringify({email})
  });

  alert("Email actualizado");
};

window.updatePassword = async () => {
  const currentPassword = document.getElementById("currentPass").value;
  const newPassword = document.getElementById("newPass").value;

  await fetch(`${API}/user/update_password`, {
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body:JSON.stringify({currentPassword,newPassword})
  });

  alert("Contraseña actualizada");
};

// ======================
// 🔹 IMAGEN
// ======================
window.uploadImage = async () => {
  const file = document.getElementById("imgInput").files[0];
  if (!file) return alert("Selecciona una imagen");

  const form = new FormData();
  form.append("image", file);

  await fetch(`${API}/user/upload_profile`, {
    method:"POST",
    headers:{
      Authorization:"Bearer "+token
    },
    body:form
  });

  alert("Imagen subida");
  loadUser();
};

// ======================
// 🔹 PREFERENCIAS
// ======================
window.savePreferences = () => {
  localStorage.setItem("darkMode",
    document.getElementById("darkMode").checked);

  localStorage.setItem("showThumbnails",
    document.getElementById("showThumbs").checked);

  alert("Preferencias guardadas");
};

// ======================
// 🔹 LOGOUT
// ======================
window.logout = () => {
  localStorage.removeItem("token");
  location.href = "./../../extrafindorasections/LoginPage/login.html";
};

// ======================
// 🔹 INIT
// ======================
loadUser();