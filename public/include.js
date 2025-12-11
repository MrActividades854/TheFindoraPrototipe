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

        } catch (error) {
            el.innerHTML = "Error cargando el archivo.";
        }
    });
});
