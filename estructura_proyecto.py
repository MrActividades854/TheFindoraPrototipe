import os

IGNORAR_CARPETAS = {"node_modules", ".git", "__pycache__"}

def generar_estructura(ruta, prefijo=""):
    estructura = ""
    elementos = sorted(
        e for e in os.listdir(ruta)
        if e not in IGNORAR_CARPETAS
    )

    for i, elemento in enumerate(elementos):
        ruta_completa = os.path.join(ruta, elemento)
        conector = "└── " if i == len(elementos) - 1 else "├── "
        estructura += f"{prefijo}{conector}{elemento}\n"

        if os.path.isdir(ruta_completa):
            nuevo_prefijo = prefijo + ("    " if i == len(elementos) - 1 else "│   ")
            estructura += generar_estructura(ruta_completa, nuevo_prefijo)

    return estructura

if __name__ == "__main__":
    ruta_proyecto = os.getcwd()
    nombre_proyecto = os.path.basename(ruta_proyecto)

    resultado = f"{nombre_proyecto}/\n"
    resultado += generar_estructura(ruta_proyecto)

    print(resultado)

    with open("estructura_proyecto.txt", "w", encoding="utf-8") as archivo:
        archivo.write(resultado)
