export default class NotificationManager {
    constructor(apiUrl = '/api/notifications') {
        this.apiUrl = apiUrl;
        this.container = document.getElementById('notificationContainer');
    }

    async show(message, type = 'success', duration = 2500) {
        // Guardar en servidor
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

        // Mostrar UI
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        this.container?.appendChild(notif);

        setTimeout(() => notif.remove(), duration);
    }
}
