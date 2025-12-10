document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll("[include-html]");

    elements.forEach(async (el) => {
        const file = el.getAttribute("include-html");

        try {
            const resp = await fetch(file);

            if (!resp.ok) {
                el.innerHTML = "No se pudo cargar el componente.";
                return;
            }

            el.innerHTML = await resp.text();
        } catch (error) {
            el.innerHTML = "Error cargando el archivo.";
        }
    });
});
document.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll("[include-html]");

    elements.forEach(async (el) => {
        const file = el.getAttribute("include-html");

        try {
            const resp = await fetch(file);

            if (!resp.ok) {
                el.innerHTML = "No se pudo cargar el componente.";
                return;
            }

            el.innerHTML = await resp.text();

            // Muy importante: solo inicializar dropdown cuando ya se cargó el header
            initializeProfileDropdown();

        } catch (error) {
            el.innerHTML = "Error cargando el archivo.";
        }
    });
});

function initializeProfileDropdown() {
    const profile = document.querySelector(".profile-options");
    const menu = document.querySelector(".dropdown-menu");

    if (!profile || !menu) {
        console.warn("profile-options o dropdown-menu no encontrados aún");
        return;
    }

    // toggle
    profile.addEventListener("click", () => {
        menu.style.display = menu.style.display === "flex" ? "none" : "flex";
    });

    // cerrar al hacer clic afuera
    document.addEventListener("click", (e) => {
        const isInside = profile.contains(e.target) || menu.contains(e.target);
        if (!isInside) menu.style.display = "none";
    });
}
