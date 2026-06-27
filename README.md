# 🪒 Barber Booking App — MVP

**Sistema de reservas online para barbería single-barber.**  
Mobile-first, bilingüe (ES/EN), con panel administrador completo.  
Construido como base replicable para nuevas barberías.

🌐 **Producción:** [https://codigodecaballeros.site](https://codigodecaballeros.site)  
👤 **Admin:** `/admin.html` (login: `admin` / `CONTRASENA_REEMPLAZADA_ROTACION_20260627`)  
📖 **API Docs:** `/docs`

---

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Stack técnico](#2-stack-técnico)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [Desarrollo local](#4-desarrollo-local)
5. [Despliegue en VPS](#5-despliegue-en-vps)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Arquitectura](#7-arquitectura)
8. [Estado de funcionalidades](#8-estado-de-funcionalidades)
9. [Máquina de estados de citas](#9-máquina-de-estados-de-citas)
10. [Cambios recientes](#10-cambios-recientes)
11. [Endpoints críticos](#11-endpoints-críticos)
12. [Riesgos y deuda técnica](#12-riesgos-y-deuda-técnica)
13. [Dirección futura: base replicable](#13-dirección-futura-base-replicable)
14. [Troubleshooting](#14-troubleshooting)
15. [Admin vs Demo público](#15-admin-vs-demo-público)

---

## 1. Objetivo y alcance

### Propósito

Sistema de reservas para barberías single-barber ("Código de Caballeros Salon").
Permite a clientes reservar online y al barbero gestionar su agenda.

### Alcance actual

- ✅ Reserva pública en 3 pasos (servicio → fecha/hora → datos)
- ✅ Panel admin con agenda, CRM, dashboard, notificaciones
- ✅ Email transaccional bilingüe (confirmación, cancelación, recordatorio)
- ✅ i18n ES/EN completo
- ✅ Autenticación JWT + API Key legacy
- ✅ Máquina de estados de citas validada
- ✅ Coloreado de citas por tipo de servicio
- ✅ Rate limiting en reservas
- ✅ PWA instalable
- ✅ Desplegado en Hostinger VPS con Docker + nginx + HTTPS

### Fuera de alcance (MVP)

- ❌ Multi-tenant / multi-barbería
- ❌ Pasarela de pago
- ❌ Registro de usuarios (clientes anónimos)
- ❌ App móvil nativa

---

## 2. Stack técnico

| Capa                 | Tecnología                                         | Versión     |
| -------------------- | -------------------------------------------------- | ----------- |
| **Backend**          | FastAPI + SQLModel + Pydantic v2                   | Python 3.11 |
| **Base de datos**    | PostgreSQL 15 + `tstzrange` + `EXCLUDE USING GIST` | 15          |
| **Frontend admin**   | React 18 (CDN ESM, sin JSX) + Tailwind CSS (CDN)   | —           |
| **Frontend público** | React 18 (CDN ESM) + Tailwind CSS (CDN)            | —           |
| **Auth**             | JWT (HS256, 24h expiry) + API Key legacy           | —           |
| **Rate limiting**    | SlowAPI (en memoria local)                         | —           |
| **Scheduler**        | APScheduler (auto-complete, reminders, recall)     | —           |
| **Email**            | SMTP (Gmail) con fallback a solo logs              | —           |
| **Infra**            | Docker Compose · nginx · Let's Encrypt             | —           |
| **Host**             | Hostinger VPS · Ubuntu 24.04 · 2GB RAM             | —           |
| **Migraciones**      | Alembic                                            | —           |

---

## 3. Estructura del proyecto

```
/home/nx-digital/barber-app/
├── admin.html              # Panel admin (HTML, type="module")
├── admin.js                # Panel admin (React 18 ESM, ~4250 líneas)
├── demo.html               # Página pública de reservas
├── demo.js                 # Lógica pública (React 18 ESM)
├── i18n.js                 # Diccionario ES/EN compartido
├── setup.html              # Guía de instalación offline
│
├── backend/
│   ├── app/
│   │   ├── main.py              # App FastAPI, middleware, routers
│   │   ├── schemas.py           # Pydantic models (ServiceOut, BookingOut, etc.)
│   │   ├── api/
│   │   │   ├── public.py        # Endpoints públicos (/book, /manage, /services, /available-slots)
│   │   │   ├── admin.py         # Endpoints admin (/summary, /clients, /agenda, etc.)
│   │   │   └── auth.py          # POST /admin/login (JWT)
│   │   ├── core/
│   │   │   ├── config.py        # Settings (DB, horario, SMTP, rate limit, JWT)
│   │   │   ├── logic.py         # Lógica de negocio (slots, create_appointment)
│   │   │   ├── auth.py          # Verify admin dependency (JWT + API Key)
│   │   │   ├── state_machine.py # Matriz de transiciones de estados
│   │   │   ├── email.py         # Email transaccional bilingüe
│   │   │   ├── lang.py          # Parser Accept-Language
│   │   │   └── limiter.py       # Rate limiter (SlowAPI)
│   │   ├── db/
│   │   │   ├── database.py      # Engine + session
│   │   │   └── models.py        # SQLModel: Service, Appointment, Client, Holiday, etc.
│   │   └── scheduler/
│   │       └── tasks.py         # APScheduler: auto-complete, reminders, recall
│   ├── migrations/
│   │   └── versions/
│   │       ├── 0001_initial.py
│   │       ├── 0002_client_notes.py
│   │       ├── 0003_holidays_seasons_blocks.py
│   │       └── 0004_service_color.py
│   ├── Dockerfile
│   ├── entrypoint.sh            # Migrations + uvicorn start
│   └── requirements.txt
│
├── nginx/
│   ├── Dockerfile               # Construye imagen con static files
│   └── nginx.conf               # Reverse proxy + HTTPS + security headers
│
├── frontend/                    # Vite (no usado en producción — los estáticos son raíz)
├── docker-compose.yml           # 3 servicios: db, backend, nginx
├── static.Dockerfile            # Alternativa solo-static
├── deploy.sh                    # Script de despliegue automatizado
├── .env.example                 # Template de variables de entorno
│
├── tests/
│   ├── test_state_machine.py    # 10 tests de transiciones de estado
│   └── test_production_e2e.py   # Suite E2E completa
│
├── scripts/
│   └── seed-test-data.sh        # Datos de prueba
│
├── logo-192.png, logo-512.png, favicon.ico, manifest.json  # PWA assets
└── AGENTS.md, PROJECT_STATUS.md # Documentación de desarrollo
```

### Nota sobre frontend/

El directorio `frontend/` contiene un setup Vite + React con JSX que NO se usa en producción.  
Los archivos servidos reales son `admin.html`, `admin.js`, `demo.html`, `demo.js`, `i18n.js` en la raíz,
que usan React 18 vía CDN (`esm.sh`) con `createElement` plano (sin JSX, sin build step).

---

## 4. Desarrollo local

### Requisitos

- Python 3.10+
- PostgreSQL 15 local
- Node.js (solo para validar sintaxis JS, no para build)

### Backend

```bash
# 1. Activar venv (vive fuera del proyecto)
source /home/nx-digital/venv/bin/activate
# o: /home/nx-digital/venv/bin/python ...

# 2. Variables de entorno (opcional, hay defaults)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/barberapp

# 3. Migraciones
cd /home/nx-digital/barber-app/backend
/home/nx-digital/venv/bin/alembic upgrade head

# 4. Arrancar backend
/home/nx-digital/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (estático)

```bash
# Servir archivos estáticos desde la raíz del proyecto
cd /home/nx-digital/barber-app
python3 -m http.server 5173
# → http://localhost:5173/admin.html
# → http://localhost:5173/demo.html
```

El frontend asume que el backend está en `localhost:8000` (configurable vía `API` variable en admin.js línea 4).

### Tests

```bash
# Backend debe estar corriendo en :8000
cd /home/nx-digital/barber-app
/home/nx-digital/venv/bin/python -m pytest tests/ -v
```

### Seed data

```bash
bash scripts/seed-test-data.sh
```

---

## 5. Despliegue a producción (guía práctica)

Esta sección documenta el flujo real para desplegar en producción desde cero y para actualizar.
Incluye los comandos exactos que funcionan contra el VPS usado actualmente (`/opt/barber-booking`).

### Requisitos en el servidor

- Usuario con acceso SSH (preferible `root` o usuario con `sudo`).
- `docker` y `docker compose` instalados (o `docker compose` plugin).
- Puerto 80/443 abiertos y DNS apuntando al servidor para el dominio de producción.
- Certificados TLS en `/etc/letsencrypt/live/<DOMAIN>/` si se usa HTTPS (opcional: `certbot`).
- Un archivo `.env` en el directorio de despliegue con las variables de entorno (no subir secretos en texto plano en repos públicos).

### Accesos necesarios para despliegue

- Acceso SSH al VPS donde reside `/opt/barber-booking`.
- Permisos para ejecutar `docker compose` y leer `/etc/letsencrypt` (si aplica).
- Acceso al repositorio Git o a los artefactos que se deben desplegar (si se usa `git pull`).

> Nota: No incluyas secretos en el control de versiones. Mantén `.env` en el servidor y excluido del repo.

### Métodos de despliegue (elige uno)

1. Git (recomendado si el servidor contiene el repositorio):

```bash
# Conectar
ssh usuario@servidor
cd /opt/barber-booking
# Obtener última versión
git pull origin main
```

2. Rsync / SCP (cuando no hay `.git` en servidor o prefieres copiar artefactos):

```bash
# Desde tu máquina local (donde trabajas):
# Asegúrate de excluir .env y archivos innecesarios
rsync -avz --delete --exclude='.git' --exclude='.env' ./ root@<SERVIDOR>:/opt/barber-booking/
```

3. Script `deploy.sh` (automatiza tareas):

- `deploy.sh` está incluido pero **requiere editar la variable `REPO`** (por defecto `https://github.com/YOUR_USER/barber-booking.git`) en su cabecera antes de ejecutarlo. Si prefieres, usa los pasos manuales descritos abajo.
- ⚠️ **No ejecutes `deploy.sh` sin antes editar la variable `REPO`** con la URL real de tu repositorio. El script fallará al clonar/actualizar si `REPO` apunta a `YOUR_USER/barber-booking.git`. Revisa también usuario SSH, dominio y credenciales antes de ejecutar.

### Pasos exactos para actualizar y levantar (comandos listos para copiar)

```bash
# 1. Conéctate al servidor
ssh root@<SERVIDOR>

# 2. Ve al directorio del proyecto
cd /opt/barber-booking

# 3A. Si el servidor es git: traer cambios
git pull origin main

# 3B. Si sincronizaste con rsync desde local, omite el git pull

# 4. (Opcional) Revisar/editar .env en el servidor antes de levantar
ls -la .env && sed -n '1,120p' .env

# 5. Reconstruir las imágenes que contienen archivos estáticos y el backend
docker compose build backend nginx

# 6. Levantar (recrea servicios si cambian)
docker compose up -d

# 7. Comprobar estado
docker compose ps

# 8. Ver logs recientes para validar
docker compose logs --tail=200

# 9. (Si hay migraciones) Ejecutar migraciones dentro del contenedor backend
docker compose exec backend alembic upgrade head
```

### Notas sobre archivos estáticos y `nginx`

- Los ficheros estáticos (`admin.html`, `admin.js`, `demo.html`, `demo.js`, `i18n.js`) se copian en la imagen `nginx` en tiempo de build (`nginx/Dockerfile`).
- Por lo tanto, si modificas `admin.js` o `admin.html` debes reconstruir la imagen `nginx` (paso `docker compose build nginx`) y luego `docker compose up -d`.

### Validación post-despliegue (comandos)

```bash
# Cabecera HTTP y estado
curl -Ik https://<TU_DOMINIO>

# Comprobar que admin.html carga (busca el título)
curl -sk https://<TU_DOMINIO>/admin.html | grep -o 'Código de Caballeros' || true

# Probar endpoint público servicios
curl -sk https://<TU_DOMINIO>/services | head -n 20

# Ver logs de nginx y backend por errores
docker compose logs --tail=200 nginx
docker compose logs --tail=200 backend
```

### Troubleshooting básico y rollback

- Si `nginx` devuelve `502 Bad Gateway`: espere 10-30s y comprueba logs del backend (`docker compose logs backend`) para ver si el backend está arrancando o fallando por conexión a BD.
- Si la base de datos está en `CrashLoop` o no es `healthy`, verifica `docker compose ps` y los logs del contenedor `db`.
- Para volver a la versión anterior (rollback seguro): si el servidor usa Git, haz:

```bash
cd /opt/barber-booking
# Volver al commit anterior conocido estable (sustituye <OLD_COMMIT>)
git fetch --all
git checkout <OLD_COMMIT>
docker compose build backend nginx
docker compose up -d
```

- Si NO hay Git en servidor: restaura desde la copia de seguridad local que hayas guardado antes del rsync, o re-sincroniza la versión estable conocida con `rsync`.

### Qué revisar antes de desplegar (checklist rápido)

- ¿`.env` en el servidor contiene `DATABASE_URL` correcto y `JWT_SECRET` configurado? (No incluyas valores en logs ni en Git).
- ¿Postgres (`db`) está `healthy`? (`docker compose ps`)
- ¿Los puertos 80/443 están en uso por nginx y el dominio apunta al servidor?)
- ¿Certificados TLS están instalados si usas HTTPS? (`/etc/letsencrypt/live/<DOMAIN>/`)

### Archivos relevantes (rutas)

- `docker-compose.yml` — orquesta `db`, `backend`, `nginx` (ruta: `/opt/barber-booking/docker-compose.yml`)
- `deploy.sh` — script auxiliar en la raíz del repo (editar `REPO=` si quieres que clone desde Git)
- `nginx/nginx.conf` — configuración del proxy y TLS
- `nginx/Dockerfile` — empaqueta archivos estáticos en la imagen nginx
- `.env` — variables de entorno del backend (NO versionar)

---

---

## 6. Variables de entorno

Ver `.env.example` para template completo.

| Variable                    | Obligatoria | Default                                                  | Descripción                         |
| --------------------------- | ----------- | -------------------------------------------------------- | ----------------------------------- |
| `DB_PASSWORD`               | Sí          | `postgres`                                               | Contraseña PostgreSQL               |
| `DATABASE_URL`              | Sí          | `postgresql://postgres:${DB_PASSWORD}@db:5432/barberapp` | URL completa (Docker usa host `db`) |
| `APP_ENV`                   | No          | `development`                                            | `production` o `development`        |
| `FRONTEND_URL`              | Sí          | `http://localhost:5173`                                  | URL del frontend (para emails)      |
| `ADMIN_USERNAME`            | Sí          | `admin`                                                  | Usuario login admin                 |
| `ADMIN_PASSWORD`            | Sí          | `CONTRASENA_REEMPLAZADA_ROTACION_20260627`                                       | Contraseña login admin              |
| `JWT_SECRET`                | Sí          | `change-me-in-production`                                | Secreto para firmar JWT             |
| `JWT_ALGORITHM`             | No          | `HS256`                                                  | Algoritmo JWT                       |
| `JWT_EXPIRY_HOURS`          | No          | `24`                                                     | Duración del token                  |
| `ALLOWED_ORIGINS`           | Sí          | `http://localhost:5173,http://localhost:8000`            | CORS origins (coma-separado)        |
| `RATE_LIMIT_BOOK`           | No          | `5/minute`                                               | Rate limit en POST /book            |
| `SMTP_HOST`                 | No          | `""`                                                     | Servidor SMTP (vacío = solo logs)   |
| `SMTP_PORT`                 | No          | `587`                                                    | Puerto SMTP                         |
| `SMTP_USER`                 | No          | `""`                                                     | Usuario SMTP                        |
| `SMTP_PASS`                 | No          | `""`                                                     | Contraseña SMTP                     |
| `SMTP_FROM`                 | No          | `"Código de Caballeros Salon <...>"`                     | Remitente emails                    |
| `REMINDER_WINDOW_HOURS`     | No          | `4`                                                      | Horas antes para recordatorio       |
| `CANCELLATION_WINDOW_HOURS` | No          | `24`                                                     | Ventana mínima para cancelar        |
| `TIMEZONE`                  | No          | `Europe/Madrid`                                          | Zona horaria del negocio            |

### Para replicar en otra barbería

Las variables críticas a cambiar son:

- `FRONTEND_URL`, `ALLOWED_ORIGINS` → dominio nuevo
- `ADMIN_PASSWORD`, `JWT_SECRET` → credenciales nuevas
- `SMTP_*` → credenciales de la nueva barbería
- `SMTP_FROM` → nombre y email de la nueva barbería

---

## 7. Arquitectura

### 7.1 Backend (FastAPI)

```
FastAPI app (main.py)
├── /auth        → POST /admin/login (JWT)
├── /public      → servicios, slots, book, manage (sin auth)
│   ├── GET  /services               → catálogo de servicios
│   ├── GET  /available-slots        → slots libres
│   ├── POST /book                   → crear reserva (rate limited)
│   ├── GET  /manage/{token}         → obtener cita por token
│   └── DELETE /manage/{token}       → cancelar cita (cliente)
└── /admin (dependencies=[verify_admin])
    ├── GET    /admin/summary         → citas del día
    ├── GET    /admin/agenda/weekly   → semana completa
    ├── GET    /admin/agenda/monthly  → mes (agregado)
    ├── GET    /admin/upcoming        → próximas citas
    ├── GET    /admin/clients         → CRM
    ├── GET    /admin/clients/{id}    → detalle cliente + visitas
    ├── GET    /admin/clients/export  → CSV
    ├── POST   /admin/clients/import  → CSV (Booksy)
    ├── PATCH  /admin/clients/{id}    → notas
    ├── DELETE /admin/clients/{id}    → eliminar cliente
    ├── GET    /admin/dashboard       → KPIs
    ├── GET    /admin/notifications   → notificaciones recientes
    ├── DELETE /admin/notifications/{id} → descartar
    ├── PATCH  /admin/appointments/{id}/status → cambiar estado
    ├── POST   /admin/appointments    → crear cita manual
    └── POST   /admin/login           → JWT (exento de verify_admin)
```

### 7.2 Frontend (React 18 CDN)

```
admin.html / admin.js:
├── LoginScreen        → JWT login
├── AdminPanel         → Layout principal
│   ├── Dashboard      → KPIs + revenue chart
│   ├── Agenda          → DayView / WeekView / MonthView
│   │   ├── AppointmentCard   → Cita individual (con color de servicio)
│   │   └── StatusPill        → Badge de estado (booked/completed/cancelled)
│   ├── Clients         → CRM con historial
│   ├── Holidays        → Gestión de festivos
│   ├── Settings        → Configuración
│   └── Notifications   → Campanita con polling 15s + toast

demo.html / demo.js:
├── ServiceSelector    → Paso 1: elegir servicio
├── DateTimeSelector   → Paso 2: elegir fecha y hora
├── BookingForm        → Paso 3: datos personales
├── Confirmation       → Resumen + enlace calendario
└── ManageBooking      → Cancelación desde email
```

### 7.3 Base de datos (PostgreSQL)

**Tablas principales:**

| Tabla              | Propósito  | Columnas clave                                                                                                                                |
| ------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `services`         | Catálogo   | `id, name, price, duration_minutes, active, hex_color`                                                                                        |
| `appointments`     | Reservas   | `id, service_id, client_id, slot (tstzrange), status, customer_*, token_uuid, notification_status, review_requested, recall_sent, created_at` |
| `clients`          | CRM        | `id, name, phone (unique), email, notes, first_visit, last_visit, visit_count, total_spent`                                                   |
| `holidays`         | Festivos   | `id, date, name`                                                                                                                              |
| `business_seasons` | Temporadas | `id, name, start_date, end_date`                                                                                                              |
| `time_blocks`      | Bloques    | `id, season_id, day_of_week, start_time, end_time, is_active`                                                                                 |

**Constraints críticos:**

```sql
-- Evita solapamiento de citas (usa slot booked, ignora cancelled)
EXCLUDE USING GIST (slot WITH &&) WHERE (status != 'cancelled')

-- Status válidos
CHECK (status IN ('booked', 'cancelled', 'completed'))
```

---

## 8. Estado de funcionalidades

### Público (demo.html)

| Funcionalidad                      | Estado | Notas                                |
| ---------------------------------- | ------ | ------------------------------------ |
| Catálogo de servicios desde BD     | ✅     |                                      |
| Selector fecha/hora (slots reales) | ✅     | Respeta horario, festivos, ocupación |
| Formulario de reserva              | ✅     | Nombre, teléfono, email              |
| Botón "Soy nuevo / Ya conozco"     | ✅     | Marca primera visita                 |
| Confirmación con resumen           | ✅     |                                      |
| Enlace calendario (.ics)           | ✅     |                                      |
| Cancelación desde email            | ✅     | Con ventana de 24h                   |
| Bilingüe ES/EN                     | ✅     | Con selector en header               |
| i18n por localStorage + navigator  | ✅     | Fallback a ES                        |
| Mobile-first                       | ✅     | Responsive con Tailwind              |
| Detección de cliente existente     | ✅     | Por teléfono                         |

### Admin (admin.html)

| Funcionalidad                         | Estado | Notas                                       |
| ------------------------------------- | ------ | ------------------------------------------- |
| Login JWT (usuario/contraseña)        | ✅     | 24h expiry                                  |
| Dashboard con KPIs                    | ✅     | Ingresos, ticket medio, completadas, nuevas |
| Revenue chart (barras CSS)            | ✅     | Últimos 7 días                              |
| Agenda vista día                      | ✅     | Citas clicables, jerarquía visual mejorada  |
| Agenda vista semana                   | ✅     | Con color de servicio                       |
| Agenda vista mes                      | ✅     | Vista agregada                              |
| Botón "Hoy"                           | ✅     |                                             |
| CRM con historial de visitas          | ✅     |                                             |
| Badge "Nuevo" en citas y clientes     | ✅     | `is_first_booking` funcional en /summary    |
| Indicador "X días sin visita"         | ✅     | Desde 25+ días, ámbar                       |
| Editar notas de cliente               | ✅     |                                             |
| WhatsApp button                       | ✅     | Enlace directo al teléfono                  |
| Notificaciones polling 15s            | ✅     |                                             |
| Toast visual al llegar reserva        | ✅     | Auto-desvanece 6s                           |
| Sonido notificación on/off            | ✅     |                                             |
| Auto-refresh agenda al detectar nueva | ✅     |                                             |
| Modal crear reserva manual            | ✅     |                                             |
| FAB botón flotante crear reserva      | ✅     |                                             |
| Cancelar reserva desde agenda         | ✅     | Con confirmación                            |
| Completar reserva desde agenda        | ✅     |                                             |
| Modal detalle cita/cliente           | ✅     | Datos del cliente + stats + acciones        |
| Estado terminal validado              | ✅     | completed/cancelled no cambian              |
| Ocultación canceladas reemplazadas   | ✅     | Canceladas cuyo slot solapa con activa se ocultan en DayView (regla de ocupación real) |
| Festivos CRUD                         | ✅     |                                             |
| Settings                              | ✅     |                                             |
| Importar clientes desde Booksy CSV    | ✅     |                                             |
| Exportar clientes a CSV               | ✅     |                                             |
| Eliminar cliente con confirmación     | ✅     | Historial se conserva                       |
| Color de servicio en citas            | ✅     | Day + Week view                             |
| PWA instalable                        | ✅     | manifest.json + standalone                  |

### Backend

| Funcionalidad                   | Estado | Notas                          |
| ------------------------------- | ------ | ------------------------------ |
| Rate limiting POST /book        | ✅     | 5/minuto por IP, configurable  |
| Auto-completado citas pasadas   | ✅     | Cada 15 min                    |
| Recordatorio email 4h antes     | ✅     |                                |
| Recall automático 6h            | ✅     | Clientes sin visita 28-30 días |
| Deduplicación por teléfono      | ✅     |                                |
| EXCLUDE CONSTRAINT solapamiento | ✅     |                                |
| Emails bilingües                | ✅     | ES/EN según cliente            |
| JWT + API Key legacy            | ✅     | Fallback para compatibilidad   |
| CORS configurable               | ✅     |                                |
| Scheduler integrado             | ✅     | APScheduler en mismo proceso   |
| Logs a stdout                   | ✅     |                                |

---

## 9. Máquina de estados de citas

### Estados válidos

```
booked ──→ completed   (admin PATCH o auto-complete)
booked ──→ cancelled   (admin PATCH o DELETE /manage/{token})
```

### Matriz de transiciones

| Actual → Nuevo          | Permitido | HTTP | Mensaje de error                  |
| ----------------------- | --------- | ---- | --------------------------------- |
| `booked → completed`    | ✅ Sí     | 200  | —                                 |
| `booked → cancelled`    | ✅ Sí     | 200  | —                                 |
| `booked → booked`       | ❌ No     | 400  | "Appointment is already booked."  |
| `completed → booked`    | ❌ No     | 400  | "Status 'completed' is terminal." |
| `completed → cancelled` | ❌ No     | 400  | "Status 'completed' is terminal." |
| `cancelled → booked`    | ❌ No     | 400  | "Status 'cancelled' is terminal." |
| `cancelled → completed` | ❌ No     | 400  | "Status 'cancelled' is terminal." |

Código en `backend/app/core/state_machine.py`:

```python
ALLOWED_TRANSITIONS = {
    "booked":     {"completed", "cancelled"},
    "completed": set(),  # Terminal
    "cancelled": set(),  # Terminal
}
```

### Reglas de negocio adicionales

- **Cancelación cliente**: requiere mínimo `CANCELLATION_WINDOW_HOURS` (24h) antes de la cita.
- **Auto-complete**: el scheduler cambia `booked → completed` cuando `upper(slot) < now` (cada 15 min).
- **Solapamiento**: el constraint `EXCLUDE USING GIST` en BD permite reusar slots de citas `cancelled`.
- **Notificaciones**: campo `notification_status` con valores `pending|sent|skipped_no_email|failed`.
- **Ocupación real del calendario (DayView)**: una cita cancelada se oculta de la grilla principal si su slot solapa (total o parcialmente) con otra cita cuyo estado está en `OCCUPIED_STATUSES` (`booked`, `completed`). La grilla refleja ocupación operativa, no historial de cancelaciones. Las canceladas sin reemplazo siguen visibles.

---

## 10. Cambios recientes

### 2026-06-26 — Fase 3: Agenda Día usable (citas clicables + jerarquía visual + modal detalle)

- **Objetivo**: La agenda diaria ahora es operable de verdad: las citas son clicables (abren modal de detalle), la jerarquía visual separa claramente hora/estado/cliente/servicio/precio, y el badge NUEVO funciona correctamente.
- **Backend** (`admin.py`):
  - Añadido `is_first_booking` al endpoint `/admin/summary` vía subconsulta SQL. El badge NUEVO ahora se muestra cuando el cliente no tiene otras citas no canceladas.
  - Nueva constante `SUMMARY_COLS` extiende `NOTIF_COLS` con subconsulta. `_appointment_row` actualizada con campo en posición 13 (fallback `False` para otros endpoints).
- **Frontend** (`admin.js`):
  - **Card mejorada**: Layout normal muestra 3 filas con jerarquía clara: (1) `hora–hora` + StatusPill visible + botones acción, (2) nombre + badge NUEVO, (3) servicio · precio. Layout compacto: `hora–hora` + nombre + dot de estado coloreado.
  - **Status explícito**: El estado ya no se infiere por opacidad — todas las cards muestran StatusPill (normal) o dot coloreado (compacto).
  - **Citas clicables**: onClick en toda la card abre `AppointmentDetailModal`. Botones inline (completar/cancelar) mantienen `e.stopPropagation()` y no abren el modal.
  - **DetailModal**: Nuevo componente con datos del cliente (nombre, teléfono, email), servicio, tramo horario completo, precio, estado, y stats del cliente (visitas, gasto, antigüedad, última visita) vía fetch lazy a `/admin/clients/{id}`. Degradación graceful si no hay `client_id` o falla la consulta. Botones completar/cancelar con cierre automático.
- **Archivos**: `backend/app/api/admin.py`, `admin.js`
- **Validación**: Badge NUEVO funcional cuando corresponde, end_time visible, estado explícito, modal tolera cliente faltante, botones acción no abren modal.

### 2026-06-23 — Bugfix: página admin en blanco por `getBlocks` duplicado

- **Síntoma**: `admin.html` no renderizaba nada (pantalla en blanco), ni siquiera el login.
- **Causa raíz**: Dos declaraciones `async function getBlocks(...)` en `admin.js` (líneas 51 y 237). En ES Modules (`type="module"`), las declaraciones duplicadas de función lanzan `SyntaxError: Identifier 'getBlocks' has already been declared`, lo que impedía cargar todo el módulo.
- **Solución**: Renombrado el segundo `getBlocks` a `getAdminBlocks` (Settings API), actualizada la referencia en `BlocksView`.
- **Verificación**: `node --input-type=module --check admin.js` ✅
- **Despliegue**: Copia directa al contenedor nginx vía `docker cp` + `nginx -s reload` (sin rebuild de imagen).
- **Archivos**: `admin.js`

### 2026-06-21 — Rediseño visual de la vista diaria (Booksy-inspired) + segunda pasada de polish

- **Motivo**: La vista diaria del panel admin tenía excesivas capas visuales (bordes múltiples, gradientes, sombras, radios grandes), baja jerarquía de cabecera y densidad visual ruidosa.
- **Frontend (primera pasada)**:
  - **ViewToggle**: Migrado de `rounded-full` a `rounded-lg` con píldora activa más limpia (`ring-1 ring-stone-200/80`), sin `shadow-inner`.
  - **Cabecera de agenda**: Separada en dos filas responsive (arriba: navegación fecha + HOY; abajo: ViewToggle). En desktop se unifica en una fila. Fecha más grande y con `text-stone-900`.
  - **KPIs**: Tarjetas migradas de fondo de color a `bg-white` con borde sutil `border-stone-200/50 shadow-sm`.
  - **DayView timeline**: Time column más estrecha (48px vs 56px), tipografía más ligera (`font-medium` vs `font-semibold`). Altura comfortable a 90px/hora (vs 86px).
  - **Appointment cards**: `rounded-lg` (vs `rounded-[18px]`), borde izquierdo 3px (vs 4px), sin bordes extra, sombra sutil. Fondo sólido (vs gradiente). Más padding vertical.
  - **StatusPill**: Sin borde, más pequeño (`rounded-md`, `text-[9px]`). `STATUS_CLS` sin borders.
  - **Botones acción**: Convertidos a iconos cuadrados `w-7 h-7`.
  - **Línea hora actual**: Refinada (dot 8px, línea 1.5px).
  - **Empty state**: Icono decorativo + más padding.
  - **Scroll**: `no-scrollbar`, `max-height: calc(100vh - 180px)`.
- **Frontend (segunda pasada — polish fino)**:
  - **Espaciado vertical**: Citas desplazadas +1px top y -2px height para crear 2px de aire entre citas consecutivas (sin solapamiento visual).
  - **Márgenes laterales**: Aumentados de 10px a 12px (más aire a los lados del timeline).
  - **Color de servicio más integrado**: Borde izquierdo reducido a 25% opacidad (vs 40%) y fondo a 3% (vs 5%). Menos "parche", más acento sutil.
  - **Jerarquía tipográfica**: Hora en `font-medium text-stone-500` (vs `font-semibold text-stone-600`), servicio en `text-[10px] text-stone-400/80` (vs `text-[11px] text-stone-400`). La hora ya no compite con el nombre.
  - **Padding de citas**: Normal a `px-3 py-2.5 gap-1.5` (vs `px-4 py-2.5 gap-1`) — menos horizontal, más gap entre filas.
  - **Compact layout**: `px-2.5 gap-1.5` (vs `px-3 gap-2`).
  - **Badge "NUEVO"**: Reducido a `text-[7px]` con fondo semitransparente `bg-emerald-50/80`.
  - **Botones acción**: Reducidos a `w-6 h-6 rounded-md` (vs `w-7 h-7 rounded-lg`), sin `shadow-sm`. Más discretos.
  - **Cabecera compactada**: Gaps reducidos (`gap-2`→`gap-1.5`, `mb-4`→`mb-3`). ViewToggle en `py-1.5 px-3 text-[11px]`. Fecha con `px-1`. HOY con `px-2.5 py-1`.
  - **KPIs como texto plano**: Eliminadas tarjetas con sombra y border. Ahora son simples label+value en `flex row` con `text-[9px] uppercase text-stone-400` + `text-sm font-bold text-stone-800`. Ocupan ~30px de altura vs ~80px antes.
  - **Mobile max-height**: Ajustado a `calc(100vh - 150px)` para mejor aprovechamiento en móvil con bottom nav.
- **Limpieza**:
  - Eliminado `nginx/admin.js` (copia stale/obsoleta del `admin.js` raíz, no usada por la imagen Docker).
  - `deploy.sh`: Marcado REPO con advertencia más visible (requiere edición manual antes de ejecutar).
- **HTML**: Añadidos estilos globales: `appt-enter` animation, `timeline-grid` smooth scroll, `* { -webkit-tap-highlight-color: transparent }`.
- **Archivos**: `admin.js`, `admin.html`, `nginx/admin.js` (eliminado), `deploy.sh` (advertencia).
- **Nota**: La funcionalidad existente no se ha modificado. Solo cambios visuales en el contenedor de agenda y componentes de la vista diaria.

### 2026-06-21 — Regla de ocupación real (canceladas reemplazadas ocultas en DayView)

- **Motivo**: La vista diaria mostraba citas canceladas cuyo slot había sido re-ocupado por otra cita activa, causando solapamiento visual y "texto fantasma" en la grilla. El problema no era de layout sino de lógica de negocio.
- **Frontend**: Nuevo filtro `visibleAppointments` en `DayView` que oculta citas canceladas cuyo rango horario solapa (parcial o totalmente) con otra cita en estado `OCCUPIED_STATUSES` (`booked`, `completed`). Array `OCCUPIED_STATUSES` definido como constante explícita para facilitar futuras extensiones.
- **Estructural**: Se corrigieron además 3 causas raíz de solapamiento visual: (1) falta `overflow-hidden` en tarjetas absolutas, (2) `h-full` + `py-2.5` sin `box-border`, (3) umbral compacto subido de 56px a 68px. Mini calendario también recibe `overflow-hidden` y mejor contraste en pasadas.
- **Regla documentada**: Ver "Reglas de negocio adicionales" → Ocupación real del calendario.
- **Archivos**: `admin.js`, `README.md`

### 2026-06-19 — Coloreado de citas por servicio

- **Motivo**: Distinguir visualmente tipos de servicio en la agenda.
- **Backend**: Nuevo campo `hex_color` en `services` (migración 0004). Colores default: Corte `#F59E0B`, Barba `#10B981`, Corte+Barba `#8B5CF6`, otros `#78716C`.
- **Frontend**: Day view con barra lateral 4px + fondo 6% opacidad. Week view con fondo pastel 12%.
- **Validación**: `hex_color` acepta solo formato `#RRGGBB` vía Pydantic validator.
- **Archivos**: `models.py`, `schemas.py`, `admin.py`, `logic.py`, `admin.js`

### 2026-06-19 — Máquina de estados (bugfix)

- **Motivo**: Se podía cambiar `completed → booked` y `completed → cancelled` por PATCH admin.
- **Solución**: Se creó `state_machine.py` con matriz explícita de transiciones. `completed` y `cancelled` son terminales.
- **Tests**: 10 tests nuevos en `test_state_machine.py`.
- **Archivos**: `state_machine.py` (nuevo), `admin.py`, `test_state_machine.py` (nuevo).

---

## 11. Endpoints críticos

### Flujo de reserva pública

```
Cliente                    Backend
  │                          │
  │  GET /services           │  → Lista servicios con precios y colores
  │◄─────────────────────────│
  │  GET /available-slots    │  → Slots libres para service_id + date
  │◄─────────────────────────│
  │  POST /book              │  → Crea cita (rate limited 5/min)
  │◄─────────────────────────│  → Email confirmación bilingüe
  │                          │
  │  DELETE /manage/{token}  │  → Cancelación (ventana 24h)
  │◄─────────────────────────│  → Email cancelación bilingüe
```

### Flujo admin

```
Barbero                    Backend
  │                          │
  │  POST /admin/login       │  → JWT token (24h)
  │◄─────────────────────────│
  │  GET /admin/summary      │  → Citas del día (con service_color)
  │◄─────────────────────────│
  │  GET /admin/agenda/weekly│  → Semana completa
  │◄─────────────────────────│
  │  PATCH /appointments/status│→ booked→completed o booked→cancelled
  │◄─────────────────────────│  → Validado por state machine
  │                          │
  │  GET /admin/notifications│  → Polling 15s (nuevas reservas)
  │◄─────────────────────────│
```

---

## 12. Riesgos y deuda técnica

### Riesgos activos

| Riesgo                            | Impacto                                    | Mitigación                                         |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Rate limit en memoria (SlowAPI)   | No escala a >1 instancia backend           | Migrar a Redis si hay múltiples réplicas           |
| Auth JWT básico (usuario único)   | Sin roles ni recuperación                  | Suficiente para MVP single-barber                  |
| SMTP sin configurar = no emails   | Clientes no reciben confirmación           | Configurar SMTP antes de producción real           |
| Frontend sin build tool           | Sin minificación, tree-shaking, sourcemaps | Archivos estáticos servidos por nginx, funciona OK |
| JWT_SECRET hardcodeado en .env    | Riesgo si .env se filtra                   | Cambiar por secreto fuerte en producción           |
| Sin tests E2E automatizados en CI | Regresiones no detectadas                  | Tests existen pero se ejecutan manual              |

### Deuda técnica

| Ítem                                   | Prioridad | Estimado | Notas                             |
| -------------------------------------- | --------- | -------- | --------------------------------- |
| Rate limiting: memoria → Redis         | 🟡 Media  | 1 día    | Necesario si se escala horizontal |
| Migrar auth a JWT + refresh token      | 🟡 Media  | 2 días   | Mejora UX, no urgente             |
| HTTPS ya configurado                   | ✅ Listo  | —        | Let's Encrypt operativo           |
| Minificar JS/CSS                       | 🟢 Baja   | 1 hora   | Beneficio cosmético               |
| `version: '3.8'` obsoleto en compose   | 🟢 Baja   | 1 min    | Advertencia cosmética             |
| Validar formato `customer_phone`       | 🟡 Media  | 30 min   | Hoy se acepta cualquier string    |
| Servicio `hex_color` editable desde UI | 🟢 Baja   | 2 horas  | Hoy solo vía BD directa           |

---

## 13. Dirección futura: base replicable

Este proyecto está diseñado como **base reusable** para implementar reservas en nuevas barberías.

### Para replicar en otra barbería

```bash
# 1. Clonar
git clone <repo> /opt/nueva-barberia
cd /opt/nueva-barberia

# 2. Cambiar identidad visual
#   - Reemplazar logo-*.png, favicon.ico
#   - Editar i18n.js: cambiar "Código de Caballeros Salon" por nuevo nombre
#   - Editar admin.html/demo.html: meta tags, title
#   - Editar backend/app/core/config.py: SMTP_FROM

# 3. Configurar horario
#   - Editar backend/app/core/config.py: BUSINESS_HOURS

# 4. Configurar servicios y precios
#   - Seed DB con nuevos servicios

# 5. Desplegar
cp .env.example .env
# Editar .env
docker compose up --build -d
```

### Visión SaaS / multi-tenant

Para convertir en SaaS multi-tenant:

| Capa           | Cambio necesario                                                   |
| -------------- | ------------------------------------------------------------------ |
| **DB**         | Añadir `tenant_id` a todas las tablas                              |
| **Backend**    | Middleware que detecte tenant por subdominio o header              |
| **Frontend**   | Templatizar HTML/JS (nombre, logo, colores, horarios)              |
| **Despliegue** | Un contenedor por tenant o multi-tenant con aislamiento por schema |
| **Auth**       | Login por tenant con registro de barberías                         |
| **Precios**    | Tabla de planes (gratis/pro) con límites                           |

**Esfuerzo estimado:** 2-3 semanas para multi-tenant básico.

### Arquitectura target multi-tenant

```
app.codigodecaballeros.site  → tenant: codigodecaballeros
app.barberia2.site           → tenant: barberia2
                │
                ▼
          nginx (routing por subdominio)
                │
                ▼
          FastAPI (tenant middleware)
                │
                ├── PostgreSQL schema: codigodecaballeros
                └── PostgreSQL schema: barberia2
```

---

## 14. Troubleshooting

### Síntoma: Admin page blank / no renderiza

```
Causa más común: Error de sintaxis ESM en admin.js
```

En ES Modules (`type="module"`), las funciones duplicadas causan `SyntaxError` (no un overwrite silencioso como en scripts clásicos).

```bash
# Verificar sintaxis ESM local
node --input-type=module --check admin.js

# Verificar en servidor (remoto)
curl -sk https://codigodecaballeros.site/admin.js | node --check --input-type=module -

# Detectar funciones duplicadas
grep -n '^async function\|^function ' admin.js | sed 's/.*function //' | sed 's/(.*//' | sort | uniq -d
```

### Síntoma: Login falla (401)

```
Causas posibles:
- Backend caído → docker compose ps
- JWT_SECRET cambiado → verificar .env
- Credenciales incorrectas → verificar ADMIN_USERNAME/ADMIN_PASSWORD
```

### Síntoma: "This time slot is no longer available"

```
Causa: Solapamiento con otra cita (incluso recién creada).
El constraint EXCLUDE USING GIST en BD rechaza el INSERT.
Es normal y esperado — el frontend debería refrescar slots.
```

### Síntoma: "Cannot change status from 'X' to 'Y'"

```
Causa: La transición viola la máquina de estados.
Revisar matriz en backend/app/core/state_machine.py.
Estados terminales: completed, cancelled.
```

### Síntoma: Cambios en admin.js no se ven en producción

```
Causa: Los estáticos van dentro de la imagen nginx (build-time).
Solución:
  docker compose build nginx && docker compose up -d
```

### Síntoma: Migración falla

```bash
# Ver estado actual
docker compose exec backend alembic current

# Ver historial
docker compose exec backend alembic history

# Reintentar
docker compose exec backend alembic upgrade head
```

### Síntoma: Backend no arranca

```bash
# Ver logs
docker compose logs backend

# Causas comunes:
# - BD no accesible (esperar a que db esté healthy)
# - Puerto 8000 ocupado
# - Error de sintaxis en Python
```

### Comandos útiles

```bash
# Estado de contenedores
docker compose ps

# Logs en vivo
docker compose logs -f

# Shell en backend
docker compose exec backend sh

# Acceso a BD
docker compose exec db psql -U postgres barberapp

# Probar API
curl -sk https://codigodecaballeros.site/services
curl -sk https://codigodecaballeros.site/admin/summary?date=$(date +%Y-%m-%d) \
  -H "Authorization: Bearer $(curl -sk -X POST https://codigodecaballeros.site/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"CONTRASENA_REEMPLAZADA_ROTACION_20260627"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
```

---

## 15. Admin vs Demo público

### Qué afecta a cada uno

| Componente                          | Afecta a     | Notas                            |
| ----------------------------------- | ------------ | -------------------------------- |
| `admin.html` / `admin.js`           | Solo admin   | Panel del barbero                |
| `demo.html` / `demo.js`             | Solo público | Reserva de clientes              |
| `i18n.js`                           | Ambos        | Diccionario ES/EN compartido     |
| `backend/app/api/public.py`         | Solo público | Endpoints de reserva             |
| `backend/app/api/admin.py`          | Solo admin   | Endpoints de gestión             |
| `backend/app/api/auth.py`           | Solo admin   | JWT login                        |
| `backend/app/core/state_machine.py` | Ambos        | Reglas de estado compartidas     |
| `backend/app/core/email.py`         | Ambos        | Emails para ambos flujos         |
| `backend/app/core/logic.py`         | Ambos        | Lógica de negocio compartida     |
| `backend/app/scheduler/tasks.py`    | Ambos        | Auto-complete, reminders, recall |

### Reglas de visibilidad

- **Colores de servicio**: solo se ven en admin (day/week view). Demo público no los usa.
- **Nuevos campos de API** (ej: `service_color`, `hex_color`): se devuelven en endpoints públicos también, pero el frontend demo los ignora. Esto permite usarlos en el futuro sin cambios de API.
- **Estados de cita**: ambos entienden `booked`, `completed`, `cancelled`. El público solo permite `booked → cancelled` (con ventana 24h). El admin permite `booked → completed|cancelled`.
- **Notificaciones**: solo existen en el panel admin (campanita). El público no ve notificaciones.

---

## 16. Continuidad del proyecto

### Estado actual

- Despliegue verificado con `docker compose` y nginx.
- El panel admin `admin.html` carga correctamente y la agenda diaria muestra bloques bien espaciados.
- La agenda diaria incluye timeline horario, indicador de hora actual, colores de servicio y acciones de completar/cancelar.
- Vista responsive validada en navegador con layout móvil y escritorio.

### Validación visual rápida

- La vista diaria tiene un diseño limpio y premium (inspirado en Booksy): tarjetas de cita sin bordes redundantes, colores de servicio aplicados como acento sutil (borde izquierdo 3px + fondo 5% opacidad), buena jerarquía tipográfica y amplio espacio en blanco.
- Los colores de servicio son claros y el borde izquierdo de la cita ayuda a distinguir tipos de servicio sin saturación visual.
- El toggle de vista (`Día`, `Semana`, `Mes`) usa píldora limpia con sombra suave y es fácil de identificar.
- La cabecera del día es prominente, con navegación responsive que se apila en móvil y se unifica en desktop.
- El comportamiento móvil es bueno: scroll suave sin barras visibles (`no-scrollbar`), controles táctiles con `active:scale-90` para feedback físico.

### Próximos pasos recomendados

- Confirmar en dispositivo móvil real que el scroll táctil y los botones de acción son cómodos.
- Añadir pruebas visuales end-to-end para la agenda diaria en `tests/`.
- Si se hacen cambios en `admin.js`, rebuild de la imagen `nginx` es necesario para producción.
- Documentar cualquier cambio de colores de servicio en los datos de `services`.

### Migración: eliminación de X-API-Key (2026-06-26)

**Breaking change:** El backend ya no acepta `X-API-Key` como método de autenticación. Solo JWT via `Authorization: Bearer <token>` (obtenido de `POST /admin/login`).

Si estabas usando scripts con `curl -H "X-API-Key: admin123"`, debes migrarlos:

```bash
# ANTES (ya no funciona)
curl -H "X-API-Key: admin123" http://localhost:8000/admin/summary?date=2026-06-26

# AHORA (JWT)
JWT=$(curl -s -X POST http://localhost:8000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"CONTRASENA_REEMPLAZADA_ROTACION_20260627"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -H "Authorization: Bearer $JWT" \
  http://localhost:8000/admin/summary?date=2026-06-26
```

Archivos actualizados automáticamente: `seed-test-data.sh`, `import-booksy-clients.py`, `tests/test_production_e2e.py`, `tests/test_state_machine.py`.

### Nota para quien retome el proyecto

- `admin.js` es la pieza central del UI admin y contiene `DayView` (con rediseño Booksy-inspired), `WeekView` y `MonthView`.
- `backend/app/api/admin.py` expone los endpoints `/admin/summary`, `/admin/agenda/weekly` y `/admin/agenda/monthly` usados por la agenda.
- `nginx/Dockerfile` empaqueta los archivos estáticos; el contenedor `nginx` debe rebuildarse si se modifica `admin.js` o `admin.html`.
- ~~Existe un archivo `nginx/admin.js` que es una copia anterior y obsoleta~~ *(eliminado en 2026-06-21)*.

## Licencia

Uso interno · MVP desarrollado para **Código de Caballeros Salon**.  
Este proyecto es base reusable para nuevas implementaciones.
