let allNotifications = [];
let profilesCache = [];
let myGrade = "";
let currentFilter = "all";

// ======================
// 🔹 OBTENER MI GRADO
// ======================
async function loadMyGrade() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(
      "https://thefindoraprototipe.onrender.com/api/me",
      {
        headers: {
          "Authorization": "Bearer " + token
        }
      }
    );

    const data = await res.json();

    if (res.ok) {
      myGrade = data.grade;
      console.log("Mi grado:", myGrade);
    }

  } catch (err) {
    console.error("Error obteniendo mi grado:", err);
  }
}

// ======================
// 🔹 PERFILES
// ======================
async function loadProfiles() {
  const res = await fetch("https://thefindoraprototipe.onrender.com/api/profiles_full");
  const data = await res.json();

  if (res.ok) {
    profilesCache = data;
    console.log("Perfiles:", profilesCache.length);
  }
}

// ======================
// 🔹 NOTIFICACIONES
// ======================
async function loadNotifications() {
  const token = localStorage.getItem("token");

  const res = await fetch(
    "https://thefindoraprototipe.onrender.com/api/notifications",
    {
      headers: {
        "Authorization": "Bearer " + token
      }
    }
  );

  const data = await res.json();

  if (res.ok) {
    allNotifications = data;
    console.log("Notificaciones:", data.length);
  }
}

// ======================
// 🔹 LIMPIAR NOMBRE
// ======================
function cleanName(text) {
  return text
    .toLowerCase()
    .replace(" detectado", "")
    .trim();
}

// ======================
// 🔹 FILTRAR POR GRADO
// ======================
function filterByGrade(notifications) {
  return notifications.filter(n => {

    const raw = n.message || "";
    const name = cleanName(raw);

    // eliminar desconocidos
    if (name.includes("desconocido")) return false;

    // buscar coincidencia flexible
    const profile = profilesCache.find(p => {
      const profileName = p.name.toLowerCase().trim();

      return (
        name.includes(profileName) ||
        profileName.includes(name)
      );
    });

    // si no hay perfil → descartar
    if (!profile) return false;

    // filtrar por grado
    return String(profile.grade).trim() === String(myGrade).trim();
  });
}

// ======================
// 🔹 FILTRO POR FECHA
// ======================
function filterByDate(list, type) {
  const now = new Date();

  return list.filter(n => {
    const d = new Date(n.created_at);

    if (type === "today") {
      return d.toDateString() === now.toDateString();
    }

    if (type === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }

    if (type === "month") {
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }

    return true;
  });
}

// ======================
// RENDER
// ======================
function render(list) {
  const container = document.getElementById("logList");
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = "<p>No hay notificaciones</p>";
    return;
  }

  list.reverse().forEach(n => {
    const li = document.createElement("li");
    li.className = n.type === "warning" ? "warning" : "success";

    li.innerHTML = `
      <div>${n.message}</div>
      <div>${new Date(n.created_at).toLocaleString()}</div>
    `;

    container.appendChild(li);
  });
}

// ======================
// FILTRO GENERAL
// ======================
function applyFilter(type) {
  currentFilter = type;

  let filtered = filterByGrade(allNotifications);

  if (type !== "all") {
    filtered = filterByDate(filtered, type);
  }

  render(filtered);
}

// ======================
// UI
// ======================
window.filterNotifications = applyFilter;

window.toggleDropdown = () => {
  document.getElementById("filterDropdown").classList.toggle("show");
};

window.clearHistory = async () => {
  if (!confirm("¿Borrar historial?")) return;

  await fetch(
    "https://thefindoraprototipe.onrender.com/api/notifications/clearall",
    { method: "DELETE" }
  );

  location.reload();
};

// ======================
// INIT
// ======================
(async () => {
  await loadMyGrade();      
  await loadProfiles();     
  await loadNotifications();

  applyFilter("all");
})();