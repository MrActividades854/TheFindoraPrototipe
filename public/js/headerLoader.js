// header-loader-inline.js - Versión sin fetch, HTML inline

import {resolvePath} from './config.js';
import {CONFIG} from './config.js';

class HeaderManager {
    constructor() {
        this.headerLoaded = false;
        this.assetsPath = this._calculateAssetsPath();
        console.log('🛠️ HeaderManager inicializado. Ruta de assets:', this.assetsPath);
    }

    _calculateAssetsPath() {
        const path = window.location.pathname;
        const depth = path.split('/').filter(s => s).length;
        
        if (depth === 0 || depth === 1) return './src';
        if (depth === 2) return '../src';
        if (depth === 3) return '../../src';
        
        return '../'.repeat(depth - 1) + 'src';
    }

    // ✅ HTML del header directamente en el código
    getHeaderHTML() {
        return `
<header>
    <style>
        header {
            background-color: rgb(49, 49, 174);
            width: 100%;
        }

        header nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
        }

        header nav > div:first-child {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        nav a {
            text-decoration: none;
            color: white;
            font-weight: bold;
            font-size: 20px;
            font-family: Arial, Helvetica, sans-serif;
            padding: 10px;
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .hoverable:hover {
            background-color: aqua;
        }

        nav img {
            width: 40px;
            height: 40px;
        }

        .nav-right {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 20px;
            height: 60px;
        }

        .bell {
            width: 60px;
            height: 60px;
            border-radius: 50%;
        }

        .perfil {
            width: 50px;
            height: 50px;
            border-radius: 10px;
        }

        .logo {
            width: 60px;
            height: 60px;
        }

        .profile-options {
            height: 60px;
            background-color: rgb(49, 49, 113);
            display: flex;
            align-items: center;
            gap: 15px;
            border-radius: 20px;
            padding: 5px 15px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .profile-options:hover {
            background-color: rgb(60, 60, 140);
        }

        #usuario-name {
            color: white;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 18px;
            display: flex;
            align-items: center;
        }

        .profile-dropdown {
            position: relative;
            display: inline-block;
        }

        .dropdown-menu {
            position: absolute;
            top: 70px;
            right: 0;
            background-color: rgb(49, 49, 113);
            border-radius: 10px;
            min-width: 150px;
            display: none;
            flex-direction: column;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            animation: dropdown 0.2s ease-out;
            z-index: 9999;
        }

        .dropdown-menu a {
            padding: 12px 15px;
            color: white;
            text-decoration: none;
            font-size: 16px;
            font-family: Arial, Helvetica, sans-serif;
        }

        .dropdown-menu a:hover {
            background-color: rgb(60, 60, 180);
        }

        @keyframes dropdown {
            from {
                opacity: 0;
                transform: translateY(-8px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .notification-badge {
            position: absolute;
            top: 8px;
            right: 8px;
            background: #ff3b30;
            color: white;
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: bold;
            min-width: 18px;
            text-align: center;
        }

        .notification-link {
            position: relative;
        }
    </style>

    <nav>
        <div>
            <img data-img="logo" class="logo" alt="Logo">

            <a class="hoverable" data-page="mainPage">Inicio</a>
            <a class="hoverable" data-page="camera">Cámara</a>
            <a class="hoverable" data-page="profiles">Perfiles</a>
            <a class="hoverable" data-page="usuarios">Usuarios</a>
        </div>

        <div class="nav-right">        
            <a data-page="notifications" class="hoverable notification-link">
                <img data-img="bell" class="bell" alt="Notificaciones">
            </a>

            <div class="profile-dropdown">
                <div class="profile-options">
                    <img data-img="profile" class="perfil" alt="Perfil">
                    <span id="usuario-name">Admin</span>
                </div>

                <div class="dropdown-menu">
                    <a data-page="settings">⚙️ Settings</a>
                    <a data-page="logout">🔓 Cerrar sesión</a>
                </div>
            </div>
        </div>
    </nav>
</header>
        `;
    }

    loadHeader() {
        if (this.headerLoaded) {
            console.log('⚠️ Header ya fue cargado previamente');
            return;
        }

        console.log('🚀 Cargando header (versión inline)...');

        try {
            // Obtener HTML
            const html = this.getHeaderHTML();
            console.log('📄 HTML del header obtenido');

            // Parsear
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const header = tempDiv.querySelector('header');
            
            if (!header) {
                throw new Error('No se encontró elemento <header>');
            }

            console.log('🔍 Header parseado correctamente');

            // Remover loading
            const loading = document.querySelector('.header-loading');
            if (loading) {
                console.log('🗑️ Removiendo placeholder');
                loading.remove();
            }

            // Insertar en DOM
            document.body.insertBefore(header, document.body.firstChild);
            console.log('✅ Header insertado en el DOM');

            this.headerLoaded = true;

            // Inicializar funcionalidad
            this._initializeHeader();

            console.log('🎉 Header completamente cargado e inicializado');

        } catch (error) {
            console.error('❌ Error cargando header:', error);
            this._showFallbackHeader();
        }
    }

    _initializeHeader() {
        console.log('⚙️ Inicializando funcionalidad...');
        
        this._loadImages();
        this._setupNavigation();
        this._setupProfileDropdown();
        this._loadUserName();
        this._markActivePage();
        this._setupNotificationBadge();
        
        console.log('✅ Funcionalidad inicializada');
    }

    _loadImages() {
        const images = {
            logo: CONFIG.ROOT_PATH + 'src/Logo.png',
            bell:  CONFIG.ROOT_PATH + 'src/Bell.png',
            profile: `${this.assetsPath}/profile.png`
        };

        document.querySelectorAll('[data-img]').forEach(img => {
            const key = img.dataset.img
            if (images[key]) {
                img.src = images[key];
                img.onerror = () => {
                    console.warn(`⚠️ Imagen no encontrada: ${images[key]}`);
                    img.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' font-size='20' text-anchor='middle' dy='.3em'%3E?%3C/text%3E%3C/svg%3E`;
                };
            }
        });
    }

    _setupNavigation() {
        const getNavPath = (relativePath) => {
            const currentPath = window.location.pathname;
            console.log('🧭 Calculando ruta para:', relativePath);
            console.log('📍 Desde:', currentPath);
            
            // Determinar en qué nivel estamos
            let depth = 0;
            
            if (currentPath.includes('/public/')) {
                // Modo Live Server con /public/ visible
                const afterPublic = currentPath.split('/public/')[1] || '';
                const segments = afterPublic.split('/').filter(s => s && !s.endsWith('.html'));
                depth = segments.length;
                console.log('📊 Profundidad (desde /public/):', depth, 'Segmentos:', segments);
            } else {
                // Modo producción o raíz directa
                const segments = currentPath.split('/').filter(s => s && !s.endsWith('.html'));
                depth = Math.max(0, segments.length - 1);
                console.log('📊 Profundidad (desde raíz):', depth, 'Segmentos:', segments);
            }
            
            // Construir ruta absoluta desde la raíz de /public/
            let finalPath;
            
            if (depth === 0) {
                // Estamos en /public/index.html
                finalPath = `./${relativePath}`;
            } else if (depth === 1) {
                // Estamos en /public/alguna-carpeta/
                finalPath = `../${relativePath}`;
            } else if (depth === 2) {
                // Estamos en /public/alguna-carpeta/subcarpeta/
                finalPath = `../../${relativePath}`;
            } else {
                // Nivel más profundo
                finalPath = '../'.repeat(depth) + relativePath;
            }
            
            console.log('➡️ Ruta final:', finalPath);
            return finalPath;
        };

        const routes = {
            mainPage: getNavPath('mainPage/Page.html'),
            camera: getNavPath('index/index.html'),
            profiles: getNavPath('profilesPage/profiles.html'),
            notifications: getNavPath('Notifications/notifications.html'),
            settings: getNavPath('settings/settings.html'),
            usuarios: getNavPath('UsersView/UsersPage.html'),
            logout: this._handleLogout.bind(this)
        };

        document.querySelectorAll('[data-page]').forEach(link => {
            const page = link.dataset.page;
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const route = routes[page];
                
                if (typeof route === 'function') {
                    route();
                } else if (route) {
                    console.log('🔗 Navegando a:', route);
                    window.location.href = route;
                } else {
                    console.warn('⚠️ Ruta no definida:', page);
                }
            });
        });

        console.log('🔗 Navegación configurada');
    }

    _setupProfileDropdown() {
        const profileBtn = document.querySelector('.profile-options');
        const dropdown = document.querySelector('.dropdown-menu');

        if (!profileBtn || !dropdown) {
            console.warn('⚠️ No se encontró dropdown');
            return;
        }

        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdown.style.display === 'flex';
            dropdown.style.display = isVisible ? 'none' : 'flex';
        });

        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });

        dropdown.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                dropdown.style.display = 'none';
            });
        });

        console.log('📋 Dropdown configurado');
    }

    _loadUserName() {
        const userName = localStorage.getItem('findora_user_name') || 'Admin';
        const userNameEl = document.getElementById('usuario-name');
        
        if (userNameEl) {
            userNameEl.textContent = userName;
        }
    }

    _markActivePage() {
        const currentPath = window.location.pathname;
        
        const pageMap = {
            'mainPage/Page.html': 'mainPage',
            'index.html': 'camera',
            'profiles.html': 'profiles',
            'notifications.html': 'notifications'
        };

        let activePage = null;
        for (const [path, page] of Object.entries(pageMap)) {
            if (currentPath.includes(path)) {
                activePage = page;
                break;
            }
        }

        if (activePage) {
            const activeLink = document.querySelector(`[data-page="${activePage}"]`);
            if (activeLink) {
                activeLink.style.backgroundColor = 'rgba(0, 255, 255, 0.3)';
                activeLink.style.borderBottom = '3px solid aqua';
            }
        }
    }

    _setupNotificationBadge() {
        const bellLink = document.querySelector('.notification-link');
        if (!bellLink) return;

        const updateBadge = () => {
            const notifications = JSON.parse(
                localStorage.getItem('findora_notifications') || '[]'
            );
            
            const unread = notifications.filter(n => !n.read).length;

            const oldBadge = bellLink.querySelector('.notification-badge');
            if (oldBadge) oldBadge.remove();

            if (unread > 0) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                badge.textContent = unread > 99 ? '99+' : unread;
                bellLink.appendChild(badge);
            }
        };

        updateBadge();
        setInterval(updateBadge, 10000);

        window.addEventListener('storage', (e) => {
            if (e.key === 'findora_notifications') {
                updateBadge();
            }
        });

        console.log('🔔 Notificaciones configuradas');
    }

    _handleLogout() {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            const keysToKeep = ['findora_settings'];
            Object.keys(localStorage).forEach(key => {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            });

            window.location.href = './index.html';
        }
    }

    _showFallbackHeader() {
        const fallback = document.createElement('header');
        fallback.style.cssText = `
            background: #3131ae;
            padding: 15px;
            color: white;
            font-family: Arial, sans-serif;
        `;
        fallback.innerHTML = `
            <nav style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 20px; font-weight: bold;">⚠️ Findora</span>
                <span style="font-size: 14px; opacity: 0.8;">Error cargando header</span>
            </nav>
        `;
        
        const loading = document.querySelector('.header-loading');
        if (loading) loading.remove();
        
        document.body.insertBefore(fallback, document.body.firstChild);
    }
}

// Auto-inicialización
console.log('📍 header-loader-inline.js cargado');

const headerManager = new HeaderManager();

function initHeader() {
    console.log('🎬 Ejecutando initHeader()');
    try {
        headerManager.loadHeader();
    } catch (error) {
        console.error('❌ Error crítico:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
} else {
    initHeader();
}

export default headerManager;