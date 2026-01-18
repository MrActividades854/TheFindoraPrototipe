# Findora - Sitio Web de identificación Facial

Aplicación web diseñada para identificar las caras de los miembros de una institución educativa y asi mejorar la seguridad.

## Descripción

Esta aplicación permite a los usuarios registrarse, visualizar las cámaras y recibir feedback del software de identificación facial, ver las notificaciones creadas por el anterior, añadir, modificar y eliminar perfiles designados para que sean identificados por el software

## Características

- Registro e inicio de sesión
- Visualización de Cámaras
- Visualización de Notificaciones
- Gestión de Perfiles
- Panel básico de ajustes

## Tecnologías Utilizadas
### Frontend:
- HTML
- CSS
- Javascript
- Face API.js (detección facial)
  - CDN: https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js


### Backend:
- Node.js

### Base de Datos: 
- Supabase (PostgreSQL + Auth)

### Infraestructura y despliegue
- Render.com (deploy del backend)
- Railway (servicios y configuración del proyecto)

## Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/MrActividades854/TheFindoraPrototipe.git

2. Instala las dependencias:
    npm install

3. Ejecuta el Proyecto:
    node server.js

## Uso

Una vez iniciado el proyecto, habra cualquier archivo HTML ubicado en /public/findorasections/