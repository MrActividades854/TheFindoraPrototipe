export default class NotificationManager {
    constructor() {
        this.bc = new BroadcastChannel("canal_notificaciones");

        this.container = document.getElementById("notificationContainer");
        if (!this.container) {
            this.container = document.createElement("div");
            this.container.id = "notificationContainer";
            document.body.appendChild(this.container);
        }

        // estilos
        this.container.style.position = "fixed";
        this.container.style.bottom = "20px";
        this.container.style.right = "20px";
        this.container.style.pointerEvents = "none";
        this.container.style.setProperty("z-index", "2147483647", "important");
    }

    saveNotification(message, type) {
        const notif = { message, type, time: new Date().toISOString() };
        const list = JSON.parse(localStorage.getItem("findora_notifications") || "[]");
        list.unshift(notif);
        localStorage.setItem("findora_notifications", JSON.stringify(list));
    }

    show(message, type = "warning") {
        this.saveNotification(message, type);

        const now = new Date();
        const timeString = now.toLocaleTimeString('es-CO', { hour12: false });

        const log = {
            id: Date.now() + Math.random(),
            message,
            type,
            time: timeString
        };

        this.bc.postMessage(log);

        const notif = document.createElement("div");
        notif.className = "notification";
        notif.style.marginTop = "8px";

        notif.innerHTML = `
            <div style="
              display:flex;
              flex-direction:column;
              gap:6px;
              background:${type === 'warning' ? '#ff4d4d' : '#4caf50'};
              color:white;
              padding:12px;
              border-radius:8px;
              box-shadow:0 6px 18px rgba(0,0,0,0.25);
              min-width:220px;
              position:relative;
              z-index:9999999;
            ">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:18px">${type === 'warning' ? '⚠️' : '✅'}</div>
                    <div style="flex:1">${message}</div>
                </div>
                <div style="text-align:right; font-size:12px; opacity:0.9;">🕒 ${timeString}</div>
            </div>
        `;

        this.container.appendChild(notif);
        notif.style.setProperty("z-index", "2147483647", "important");
        setTimeout(() => notif.remove(), type === 'warning' ? 5000 : 3000);
    }
}
