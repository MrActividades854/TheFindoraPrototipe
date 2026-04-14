let notificationsCache = [];

let profilesCache = [];

async function loadProfiles() {
  const res = await fetch("https://thefindoraprototipe.onrender.com/api/profiles_full");
  const data = await res.json();

  if (res.ok) {
    profilesCache = data;
    console.log("✅ Perfiles cargados:", data.length);
  }
}

const MY_GRADE = "11B";

// ======================
// 🔹 CARGAR NOTIFICACIONES
// ======================
async function loadNotifications() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch("https://thefindoraprototipe.onrender.com/api/notifications", {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (res.ok) {
      notificationsCache = data;
      console.log("✅ Notificaciones cargadas:", data.length);
    } else {
      console.warn("⚠️ Error:", data);
    }

  } catch (err) {
    console.error("❌ Error:", err);
  }
}

// ======================
// 🔹 ESTADO DEL CALENDARIO
// ======================
let currentDate = new Date();
let month = currentDate.getMonth();
let year = currentDate.getFullYear();

// ======================
// 🔹 CONTROLES (crear arriba)
// ======================
const calendar = document.getElementById("calendar");

const controls = document.createElement("div");
controls.style.display = "flex";
controls.style.gap = "10px";
controls.style.marginBottom = "10px";

controls.innerHTML = `
<button id="prev">◀</button>
<select id="monthSelect"></select>
<input type="number" id="yearInput" style="width:80px">
<button id="next">▶</button>
`;

calendar.parentElement.insertBefore(controls, calendar);

// ======================
// 🔹 MESES
// ======================
const months = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

const monthSelect = document.getElementById("monthSelect");
const yearInput = document.getElementById("yearInput");

// llenar meses
months.forEach((m, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = m;
  monthSelect.appendChild(opt);
});

// ======================
// 🔹 SINCRONIZAR CONTROLES
// ======================
function syncControls() {
  monthSelect.value = month;
  yearInput.value = year;
}

// ======================
// 🔹 CALENDARIO
// ======================
function renderCalendar() {
  calendar.innerHTML = "";

  const today = new Date();

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 1; i <= daysInMonth; i++) {
    const day = document.createElement("div");
    day.className = "day";
    day.textContent = i;

    // hoy
    if (
      i === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) {
      day.classList.add("today");
    }

    // CLICK
    day.onclick = () => showPeople(i);

    calendar.appendChild(day);
  }
}

// ======================
// 🔹 FILTRAR PERSONAS
// ======================
function getPeopleByDate(day) {
  return notificationsCache
    .filter(n => {
      if (!n.created_at) return false;

      const d = new Date(n.created_at);

      return (
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      );
    })
    .map(n => (n.message || "").split(" detectado")[0]);
}

// ======================
// 🔹 MOSTRAR PERSONAS
// ======================
function showPeople(day) {
  const list = document.getElementById("peopleList");
  const title = document.getElementById("selectedDate");

  title.textContent = `${day} de ${months[month]} ${year}`;
  list.innerHTML = "";

  const people = getPeopleByDate(day);

  if (people.length === 0) {
    list.innerHTML = "<p>No hay registros</p>";
    return;
  }

  const unique = [...new Set(people)];

  unique.forEach(name => {
    const div = document.createElement("div");
    div.className = "person";

    const img = document.createElement("img");
    img.src = "./../../src/profile.png";

    const span = document.createElement("span");
    span.textContent = name;

    div.appendChild(img);
    div.appendChild(span);

    list.appendChild(div);
  });
}

// ======================
// 🔹 EVENTOS
// ======================
document.getElementById("prev").onclick = () => {
  month--;
  if (month < 0) {
    month = 11;
    year--;
  }
  syncControls();
  renderCalendar();
};

document.getElementById("next").onclick = () => {
  month++;
  if (month > 11) {
    month = 0;
    year++;
  }
  syncControls();
  renderCalendar();
};

monthSelect.onchange = () => {
  month = parseInt(monthSelect.value);
  renderCalendar();
};

yearInput.onchange = () => {
  year = parseInt(yearInput.value);
  renderCalendar();
};

// ======================
// 🔹 INIT
// ======================
(async () => {
  await loadNotifications();
  syncControls();
  renderCalendar();
})();