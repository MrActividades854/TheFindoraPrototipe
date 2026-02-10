
// Variables globales
let allNotifications = [];
let currentFilter = 'all';
let dropdownOpen = false;

// Función para abrir/cerrar el menú
function toggleDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    dropdown.classList.toggle('show');
    dropdownOpen = !dropdownOpen;
    
    // Cambiar ícono de flecha
    const toggleBtn = document.querySelector('.dropdown-toggle');
    if (dropdownOpen) {
        toggleBtn.innerHTML = 'Filtrar por fecha ▲';
    } else {
        toggleBtn.innerHTML = 'Todas ▼';
    }
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('filterDropdown');
    const toggleBtn = document.querySelector('.dropdown-toggle');
    
    if (!dropdown.contains(event.target) && !toggleBtn.contains(event.target)) {
        dropdown.classList.remove('show');
        dropdownOpen = false;
        toggleBtn.innerHTML = `${getFilterName(currentFilter)} ▼`;
    }
});

async function clearHistory() {
  if (!confirm('¿Estás seguro de borrar todo el historial de notificaciones?')) {
    return;
  }

  try {
    await fetch(
      'https://thefindoraprototipe.onrender.com/api/notifications/clearall',
      { method: 'DELETE' }
    );

    // limpiar frontend
    localStorage.removeItem('findora_notifications');
    allNotifications = [];
    loadNotifications();

    console.log('🧹 Historial borrado en frontend y backend');
  } catch (err) {
    console.error('Error borrando notificaciones:', err);
    alert('No se pudo borrar el historial en el servidor');
  }
}


function loadNotifications() {
    const list = JSON.parse(localStorage.getItem("findora_notifications") || "[]");
    allNotifications = list;
    applyFilter(currentFilter);
}

function applyFilter(filterType) {
    const container = document.getElementById("logList");
    if (!container) return;
    
    currentFilter = filterType;
    
    // Actualizar título del botón
    updateFilterButtonText(filterType);
    
    // Cerrar el menú después de seleccionar
    const dropdown = document.getElementById('filterDropdown');
    dropdown.classList.remove('show');
    dropdownOpen = false;
    
    // Actualizar botón principal
    const toggleBtn = document.querySelector('.dropdown-toggle');
    toggleBtn.innerHTML = `${getFilterName(filterType)} ▼`;
    
    // Actualizar elementos activos en el menú
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.dropdown-item[onclick="filterNotifications('${filterType}')"]`);
    if (activeItem) activeItem.classList.add('active');
    
    // Filtrar notificaciones
    let filteredList = allNotifications;
    
    if (filterType !== 'all') {
        filteredList = filterByDate(allNotifications, filterType);
    }
    
    // Mostrar resultados
    container.innerHTML = "";
    
    if (filteredList.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-message";
        emptyMsg.innerHTML = getEmptyMessage(filterType);
        container.appendChild(emptyMsg);
        return;
    }
    
    // Mostrar en orden inverso (más reciente primero)
    filteredList.reverse().forEach(n => {
        const li = document.createElement("li");
        li.className = n.type === "warning" ? "warning" : "success";
        li.innerHTML = `
            <div class="message">${n.message}</div>
            <div class="time">${new Date(n.time).toLocaleString()}</div>
        `;
        container.appendChild(li);
    });
}

function filterNotifications(filterType) {
    if (filterType === 'custom') {
        showCustomDatePicker();
        return;
    }
    applyFilter(filterType);
}

// Función para actualizar el texto del botón
function updateFilterButtonText(filterType) {
    const toggleBtn = document.querySelector('.dropdown-toggle');
    const filterNames = {
        'all': 'Todas',
        'today': 'Hoy',
        'yesterday': 'Ayer', 
        'week': 'Esta semana',
        'month': 'Este mes',
        'custom': 'Personalizado'
    };
    
    toggleBtn.innerHTML = `${filterNames[filterType]} ▼`;
}

// Obtener nombre del filtro
function getFilterName(filterType) {
    const filterNames = {
        'all': 'Todas',
        'today': 'Hoy',
        'yesterday': 'Ayer',
        'week': 'Esta semana',
        'month': 'Este mes'
    };
    return filterNames[filterType] || 'Filtrar';
}

// Función para filtrar por fecha
function filterByDate(notifications, filterType) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return notifications.filter(n => {
        const notificationDate = new Date(n.time);
        const notificationDay = new Date(notificationDate.getFullYear(), notificationDate.getMonth(), notificationDate.getDate());
        
        switch(filterType) {
            case 'today':
                return notificationDay.getTime() === today.getTime();
            case 'yesterday':
                return notificationDay.getTime() === yesterday.getTime();
            case 'week':
                return notificationDate >= startOfWeek;
            case 'month':
                return notificationDate >= startOfMonth;
            default:
                return true;
        }
    });
}

// Mensaje cuando no hay notificaciones
function getEmptyMessage(filterType) {
    const messages = {
        'all': '📭 No hay notificaciones en el historial',
        'today': '☀️ No hay notificaciones hoy',
        'yesterday': '📅 No hay notificaciones ayer',
        'week': '📆 No hay notificaciones esta semana',
        'month': '🗓️ No hay notificaciones este mes'
    };
    return messages[filterType] || '📭 No hay notificaciones';
}

// Función para selector de fechas personalizado (opcional)
function showCustomDatePicker() {
    // Puedes implementar un calendario aquí
    const startDate = prompt("Fecha de inicio (YYYY-MM-DD):", "2024-01-01");
    const endDate = prompt("Fecha de fin (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const filtered = allNotifications.filter(n => {
            const date = new Date(n.time);
            return date >= start && date <= end;
        });
        
        applyCustomFilter(filtered, `${startDate} al ${endDate}`);
    }
}

function applyCustomFilter(filteredList, dateRange) {
    const container = document.getElementById("logList");
    if (!container) return;
    
    // Actualizar botón
    const toggleBtn = document.querySelector('.dropdown-toggle');
    toggleBtn.innerHTML = `🔍 ${dateRange} ▼`;
    
    // Mostrar resultados
    container.innerHTML = "";
    
    if (filteredList.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-message";
        emptyMsg.textContent = `📭 No hay notificaciones entre ${dateRange}`;
        container.appendChild(emptyMsg);
        return;
    }
    
    // Mostrar en orden inverso
    filteredList.reverse().forEach(n => {
        const li = document.createElement("li");
        li.className = n.type === "warning" ? "warning" : "success";
        li.innerHTML = `
            <div class="message">${n.message}</div>
            <div class="time">${new Date(n.time).toLocaleString()}</div>
        `;
        container.appendChild(li);
    });
}

// Cargar al inicio
window.onload = function() {
    loadNotifications();
    
    // Escuchar cambios en localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'findora_notifications') {
            loadNotifications();
        }
    });
};