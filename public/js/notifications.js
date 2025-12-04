export default class NotificationManager {
    constructor(apiUrl = '/api/notifications') {
        this.apiUrl = apiUrl;
        this.container = document.getElementById('notificationContainer');

        // Si no existe el contenedor en el DOM, créalo y añade estilos básicos
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notificationContainer';
            Object.assign(this.container.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 9999,
                pointerEvents: 'none'
            });
            document.body.appendChild(this.container);
        }
    }

    async show(message, type = 'success', duration = 2500) {
        // Guardar en servidor (intento, no bloquee UI si falla)
        try {
            await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    type,
                    timestamp: new Date()
                })
            });
        } catch (e) {
            console.warn('Error guardando notificación en servidor:', e);
        }

        // También guardar localmente
        const list = JSON.parse(localStorage.getItem('findora_notifications') || '[]');
        list.push({ message, type, time: Date.now() });
        localStorage.setItem('findora_notifications', JSON.stringify(list));

        // Mostrar UI: crear elemento con estilos por defecto
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;

        // estilos inline para asegurar visibilidad
        const bgMap = {
            success: '#2ecc71',
            info: '#3498db',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        Object.assign(notif.style, {
            background: bgMap[type] || '#333',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '14px',
            pointerEvents: 'auto',
            opacity: '0',
            transition: 'opacity 180ms ease'
        });

        this.container.appendChild(notif);

        // forzar reflow y animar entrada
        requestAnimationFrame(() => { notif.style.opacity = '1'; });

        // eliminar después de duration
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 200);
        }, duration);
    }
}
