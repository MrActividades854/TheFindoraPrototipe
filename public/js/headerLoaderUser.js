// header-loader-dashboard.js

import { CONFIG } from './config.js';

class HeaderManagerDashboard {
    constructor() {
        this.headerLoaded = false;
        this.assetsPath = this._calculateAssetsPath();
    }

    _calculateAssetsPath() {
        const path = window.location.pathname;
        const depth = path.split('/').filter(s => s).length;

        if (depth <= 1) return './src';
        if (depth === 2) return '../src';
        if (depth === 3) return '../../src';

        return '../'.repeat(depth - 1) + 'src';
    }

    getHeaderHTML() {
        return `
<header>
    <style>
header{
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    width:100%;
}

/* NAV */

header nav{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px 25px;
}

/* LEFT SIDE */

header nav > div:first-child{
    display:flex;
    align-items:center;
    gap:20px;
}

/* LINKS */

nav a{
    text-decoration:none;
    color:var(--text);
    font-weight:500;
    font-size:16px;
    padding:8px 12px;
    border-radius:8px;
    cursor:pointer;
    transition:background .15s;
}

.hoverable:hover{
    background:var(--card);
}

/* LOGO */

.logo{
    width:42px;
    height:42px;
}

/* RIGHT SIDE */

.nav-right{
    display:flex;
    align-items:center;
    gap:15px;
}

/* BELL */

.bell{
    width:38px;
    height:38px;
}

/* PROFILE */

.perfil{
    width:36px;
    height:36px;
    border-radius:8px;
}

.profile-options{
    display:flex;
    align-items:center;
    gap:10px;
    padding:6px 12px;
    border-radius:10px;
    cursor:pointer;
    transition:.15s;
}

.profile-options:hover{
    background:var(--card);
}

#usuario-name{
    color:var(--text);
    font-size:15px;
}

/* DROPDOWN */

.profile-dropdown{
    position:relative;
}

.dropdown-menu{
    position:absolute;
    top:55px;
    right:0;

    background:var(--card);

    border:1px solid var(--border);

    border-radius:10px;

    min-width:150px;

    display:none;
    flex-direction:column;

    box-shadow:0 10px 25px rgba(0,0,0,.4);

    overflow:hidden;

    z-index:999;
}

.dropdown-menu a{
    padding:10px 14px;
    font-size:14px;
}

.dropdown-menu a:hover{
    background:var(--surface);
}

/* BADGE */

.notification-link{
    position:relative;
    display:inline-flex;
    align-items:center;
    justify-content:center;
}

.notification-badge{
    position:absolute;
    top:-4px;
    right:-4px;

    background:#ff3b30;
    color:white;

    border-radius:50%;
    min-width:18px;
    height:18px;

    display:flex;
    align-items:center;
    justify-content:center;

    font-size:10px;
    font-weight:bold;
}
}
    </style>
<nav>
    <div>
        <img data-img="logo" class="logo">

        <a data-page="dashboard">Inicio</a>
        <a data-page="profiles">Clase</a>
        <a data-page="calendar">Calendario</a>
    </div>

    <div class="nav-right">
        <a data-page="notifications" class="notification-link">
            <img data-img="bell" class="bell">
        </a>

        <div class="profile-dropdown">
            <div class="profile-options">
                <img data-img="profile" class="perfil">
                <span id="usuario-name">Usuario</span>
            </div>

            <div class="dropdown-menu">
                <a data-page="settings">⚙️ Settings</a>
                <a data-page="logout">Cerrar sesión</a>
            </div>
        </div>
    </div>
</nav>
</header>
        `;
    }

    loadHeader() {
        if (this.headerLoaded) return;

        const temp = document.createElement('div');
        temp.innerHTML = this.getHeaderHTML();

        const header = temp.querySelector('header');
        document.body.prepend(header);

        this.headerLoaded = true;

        this._init();
    }

    _init() {
        this._loadImages();
        this._setupNav();
        this._setupDropdown();
        this._loadUser();
        this._badge();
    }

    _loadImages() {
        const images = {
            logo: CONFIG.ROOT_PATH + 'src/Logo.png',
            bell: CONFIG.ROOT_PATH + 'src/Bell.png',
            profile: `${this.assetsPath}/profile.png`
        };

        document.querySelectorAll('[data-img]').forEach(img => {
            img.src = images[img.dataset.img];
        });
    }

    _setupNav() {
        const go = (path) => window.location.href = CONFIG.ROOT_PATH + path;

        const routes = {
            dashboard: 'basicfindorasections/dashboard/dashboard.html',
            profiles: 'basicfindorasections/Class/class.html',
            calendar: 'basicfindorasections/Calendar/calendar.html',
            notifications: 'basicfindorasections/Notifications/notifications.html',
            settings: 'basicfindorasections/settings/settings.html',
            logout: this._logout.bind(this)
        };

        document.querySelectorAll('[data-page]').forEach(el => {
            el.onclick = () => {
                const r = routes[el.dataset.page];
                if (typeof r === 'function') r();
                else go(r);
            };
        });
    }

    _setupDropdown() {
        const btn = document.querySelector('.profile-options');
        const menu = document.querySelector('.dropdown-menu');

        btn.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
        };

        document.onclick = () => menu.style.display = 'none';
    }

    async _loadUser() {
        const el = document.getElementById("usuario-name");
        const token = localStorage.getItem("token");

        if (!token) {
            el.textContent = "Invitado";
            return;
        }

        try {
            const res = await fetch(CONFIG.API_URL + "/me", {
                headers: { Authorization: "Bearer " + token }
            });

            const user = await res.json();
            el.textContent = user.name;

        } catch {
            el.textContent = "Error";
        }
    }

    _badge() {
        const bell = document.querySelector('.notification-link');

        const update = () => {
            const list = JSON.parse(localStorage.getItem('findora_notifications') || '[]');
            const unread = list.filter(n => !n.read).length;

            const old = bell.querySelector('.notification-badge');
            if (old) old.remove();

            if (unread > 0) {
                const b = document.createElement('span');
                b.className = 'notification-badge';
                b.textContent = unread;
                bell.appendChild(b);
            }
        };

        update();
        setInterval(update, 8000);
    }

    _logout() {
        localStorage.clear();
        window.location.href = CONFIG.ROOT_PATH + "extrafindorasections/login/login.html";
    }
}

const header = new HeaderManagerDashboard();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => header.loadHeader());
} else {
    header.loadHeader();
}

export default header;