# PROJECT_STATUS.md — Barber Booking MVP

> Estado actual del proyecto. Ultima actualizacion: 2026-06-27

---

## Resumen general

MVP funcional de reservas para barberia single-barber ("Codigo de Caballeros Salon").
Stack: FastAPI + PostgreSQL + React 18 CDN + Tailwind.
Desplegado en Hostinger VPS (148.230.108.27). Accesible via HTTPS (codigodecaballeros.site).

---

## Plan de mejora por fases

Ejecutando 8 fases priorizadas. Progreso:

| Fase | Prioridad | Descripción | Estado |
|---|---|---|---|---|
| 1 | P0-2 | Eliminar fallback inseguro de API key → solo JWT | ✅ Completada |
| 2 | P0-4 | Reset de datos demo | ✅ Completada |
| 3 | P0-1 + P1-2 | Agenda Día usable (citas clicables + jerarquía visual) | ✅ Completada |
| 4 | P0-3 | Navegación de fecha unificada + botón "Hoy" | ✅ Completada |
| 5 | P1-1 | Jerarquía de marca en header | ✅ Completada |
| 6 | P1-4 | Contexto claro en navegación móvil | ✅ Completada |
| 7 | P1-3 | Fuente de verdad única de ingresos | ✅ Completada |
| 8 | P2-1 | Pulido de login/splash | ✅ Completada |

### Fase 1 completada (2026-06-26) — P0-2: Eliminar fallback API key

**Qué cambió:** El sistema de auth ahora solo acepta JWT via `Authorization: Bearer`. Se eliminó por completo el fallback a `X-API-Key` estática.

**Archivos tocados (14):**
- Backend: `auth.py` (verify_admin simplificado), `config.py` (ADMIN_API_KEY eliminado)
- Config: `.env`, `.env.example`, `docker-compose.yml`, `deploy.sh`
- Scripts: `seed-test-data.sh`, `import-booksy-clients.py` (migrados a JWT)
- Tests: `test_production_e2e.py`, `test_state_machine.py` (migrados a JWT)
- Proxy: `local_preview_proxy.py` (limpiado header X-API-Key)
- Docs: `AGENTS.md`, `PROJECT_STATUS.md`, `README.md`

**Riesgo:** Los scripts y tests que corran contra un backend sin este cambio (ej: producción desplegada) fallarán hasta que se actualice el backend. Ver `README.md` sección "Migración" para instrucciones.

### Fase 2 completada (2026-06-26) — P0-4: Reset de datos demo

**Qué cambió:** Se añadió un sistema completo de marcado y reseteo de datos demo, con 4 capas de seguridad.

**Arquitectura:**
1. Migración `0006_is_demo.py` añade columna `is_demo BOOLEAN DEFAULT FALSE` a `appointments` y `clients`
2. `create_appointment()` acepta parámetro `is_demo` y lo persiste. Auto-marca el cliente como demo.
3. `AdminBookingCreate` acepta campo opcional `is_demo`
4. `seed-test-data.sh` envía `is_demo: true` en todas las reservas
5. `POST /admin/reset-demo` con 4 guards: JWT + `{"confirm": true}` + APP_ENV + `RESET_DEMO_ALLOWED`
6. Botón en admin.html (Settings) con modal de confirmación

**Archivos tocados (12):**
- Migración: `backend/migrations/versions/0006_is_demo.py` **(nuevo)**
- Backend: `models.py`, `schemas.py`, `config.py`, `logic.py`, `admin.py`
- Frontend: `admin.js`, `i18n.js`
- Scripts: `seed-test-data.sh`
- Docs: `PROJECT_STATUS.md`

**Guards de seguridad:**
| Capa | Mecanismo |
|---|---|
| Auth | JWT admin via router global |
| Confirmación | Body `{"confirm": true}` |
| Entorno | Denegado en production salvo `RESET_DEMO_ALLOWED=true` |
| Orphan FK | `UPDATE appointments SET client_id = NULL` para citas demo residuales |

### Fase 3 completada (2026-06-26) — P0-1 + P1-2: Agenda Día usable

**Qué cambió:** La agenda diaria ahora tiene citas clicables con modal de detalle, jerarquía visual clara (hora-fin, StatusPill, nombre, badge NUEVO, servicio+precio) y badge NUEVO funcional desde backend.

**Cambios:**

1. **Backend** — `is_first_booking` en `/admin/summary`:
   - Nueva constante `SUMMARY_COLS` con subconsulta SQL que calcula si la cita es la primera del cliente
   - `_appointment_row` actualizada con campo en posición 13 (fallback `False`)
   - Otros endpoints no se ven afectados (fallback silencioso)

2. **Frontend — Card visual**:
   - Layout normal: 3 filas con jerarquía: `(1) hora–hora + StatusPill + botones`, `(2) nombre + NUEVO`, `(3) servicio · precio`
   - Layout compacto: `hora–hora + nombre + dot estado + botón`
   - Estado explícito (StatusPill/dot coloreado), no solo opacidad
   - `end_time` visible en todos los modos

3. **Frontend — Card clickable**:
   - `onClick` en toda la card abre `AppointmentDetailModal`
   - Botones acción mantienen `e.stopPropagation()` → no abren modal

4. **Frontend — DetailModal**:
   - Muestra: nombre, teléfono, email, servicio, hora–hora, precio, estado (StatusPill)
   - Stats de cliente: visitas totales, gasto total, antigüedad, última visita
   - Fetch lazy a `/admin/clients/{id}` solo si hay `client_id`
   - Degradación graceful si cliente no existe o falla consulta
   - Botones completar/cancelar cierran modal automáticamente

**Archivos tocados (2):**
- Backend: `backend/app/api/admin.py`
- Frontend: `admin.js`

### Fase 4 completada (2026-06-26) — P0-3: Navegación de fecha unificada + botón "Hoy"

**Qué cambió:** Todo el estado de fecha en admin.js se unificó bajo una sola fuente de verdad (`date`), eliminando `monthStr` como estado independiente. Se derivó con `useMemo`. `goToday` siempre hace `setDate(todayISO())` sin importar la vista. Navegación mes estabiliza al día 1 antes de cambiar.

**Archivos tocados (1):**
- Frontend: `admin.js`

### Fase 5 completada (2026-06-26) — P1-1: Jerarquía de marca en header

**Qué cambió:** Se añadió badge **PROPIO** en headers de admin.js y demo.js, creando jerarquía visual: PROPIO (plataforma) → Código de Caballeros Salon (tenant) → contexto de navegación. En admin sobre fondo oscuro (`text-propio-400`), en demo sobre fondo claro (`text-propio-600 bg-propio-50`).

**Archivos tocados (2):**
- Frontend: `admin.js`, `demo.js`

### Fase 6 completada (2026-06-26) — P1-4: Contexto claro en navegación móvil

**Qué cambió:** La pestaña activa en la bottom nav ahora usa `bg-propio-50 rounded-xl` además del color de texto, mejorando la legibilidad en móvil. Un cambio de una línea en `TabButton`.

**Archivos tocados (1):**
- Frontend: `admin.js`

### Fase 7 completada (2026-06-26) — P1-3: Fuente de verdad única de ingresos

**Qué cambió:** Enmascaramiento de ingresos en el Panel/Dashboard con estado `showRevenue` + helper `maskRevenue`. Botón ojo (Eye/EyeOff de lucide-react) en cabecera del Dashboard. 16 llamadas a `maskRevenue()` cubriendo: cards summary/KPI, detalle revenue/avg_ticket, gráficos daily/weekly/monthly/historical. Solo frontend, sin persistencia.

**Archivos tocados (1):**
- Frontend: `admin.js`

### Fase 8 completada (2026-06-26) — P2-1: Pulido de login/splash

**Qué cambió:** Se pulió la experiencia de login y splash con mejoras de branding y UX:

1. **Splash screen** (admin.html + demo.html):
   - Nueva jerarquía visual: logo → "Código de Caballeros" → "Powered by PROPIO"
   - Fondo con gradiente sutil en vez de color plano
   - Animación de dots (3 bolitas) que indica carga activa
   - Transición fade-out más suave (0.5s)

2. **Login form** (admin.js):
   - Fondo con gradiente `from-ivory via-white to-propio-50/30` para calidez visual
   - Animación `fadeInUp` en la card del formulario al montar
   - Animación `shake` en el banner de error (con `key` único para re-trigger)
   - Botón de submit con `animate-pulse` durante carga
   - Enlace sutil "¿Problemas para acceder? Contacta con soporte" / "Having trouble? Contact support"
   - Sombra ligeramente más pronunciada en la card

3. **i18n.js**:
   - Nuevas claves `admin.login_help` (ES + EN)

**Archivos tocados (4):**
- Frontend: `admin.js`, `admin.html`, `demo.html`, `i18n.js`

---

| URL | Proposito | Acceso |
|---|---|---|
| `https://codigodecaballeros.site/` | Pagina publica de reservas | Clientes |
| `https://codigodecaballeros.site/admin.html` | Panel de administracion | Barbero (login configurado en .env) |
| `https://codigodecaballeros.site/docs` | Documentacion API OpenAPI | Tecnico |

---

## Funcionalidades implementadas

### Frontend publico (demo.html / demo.js)
- [x] Catalogo de servicios (desde BD)
- [x] Selector de fecha y hora (slots disponibles)
- [x] Formulario de reserva con nombre, telefono, email
- [x] **Boton "Soy nuevo / Ya conozco"** para que el cliente indique si es primera vez
- [x] Confirmacion con resumen y enlace para anadir a calendario
- [x] Enlace de gestion/cancelacion en email
- [x] Bilingue ES/EN con selector en header
- [x] Mobile-first, Tailwind CSS via CDN

### Panel admin (admin.html / admin.js)
- [x] **Login profesional** con usuario + contrasena + JWT (24h validez)
- [x] Agenda vista dia/semana/mes con navegacion
- [x] Boton "Hoy" para volver al dia actual
- [x] Lista de proximas citas
- [x] CRM de clientes con historial de visitas, estadisticas, edicion
- [x] **Badge "Nuevo"** en clientes con 0 visitas completadas
- [x] **Contador "Nuevos"** en cabecera de lista de clientes
- [x] **Indicador "X dias sin visita"** (visible desde 25+ dias, color ambar)
- [x] **Campana de notificaciones** con polling cada 15s
- [x] **Toast visual** al llegar nueva reserva (auto-desvanecer 6s)
- [x] Sonido de notificacion on/off
- [x] **Auto-refresh** de agenda/clientes al detectar nueva reserva
- [x] Modal de crear reserva con toggle "Sí es nuevo / Ya ha venido"
- [x] FAB (boton flotante) para crear reserva rapida
- [x] Notificaciones cargan ultimas 24h al abrir el panel

### Backend (FastAPI + PostgreSQL)
- [x] Endpoints publicos: /services, /available-slots, /book, /manage
- [x] Endpoints admin: /summary, /clients, /upcoming, /appointments, /agenda, /notifications, /stats
- [x] **Auth JWT** (Authorization: Bearer) — sin fallback a API key estatica
- [x] **POST /admin/login** con usuario/contrasena desde config
- [x] Sistema de **recall automatico** cada 6h (clientes sin visita 28-30 dias → email)
- [x] Recordatorios de cita cada 15min (ventana configurable REMINDER_WINDOW_HOURS)
- [x] Auto-completado de citas pasadas cada 15min
- [x] Toda reserva con SQL crudo + tstzrange + EXCLUDE CONSTRAINT (sin dobles reservas)
- [x] Deduplicacion de clientes por telefono (primario) y email (secundario)
- [x] Rate limiting en POST /book (5/minuto por IP, configurable)
- [x] CORS configurable via ALLOWED_ORIGINS
- [x] Soporte `is_first_time` en esquemas BookingCreate y AdminBookingCreate

### Infraestructura (Docker + Nginx)
- [x] Docker Compose con 3 servicios: db (PostgreSQL), backend, nginx
- [x] Nginx como reverse proxy + servidor estaticos
- [x] Solo puertos 80/443 expuestos (backend no accesible directamente)
- [x] .env con variables de entorno (DB, API keys, JWT, SMTP, etc.)
- [x] Script deploy.sh automatizado
- [x] HTTPS activo con Let's Encrypt (certificado válido hasta Sep 2026)

---

## Configuracion actual

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<REEMPLAZAR_EN_PRODUCCION>
JWT_SECRET=cambiar-en-produccion
RATE_LIMIT_BOOK=5/minute
```

---

## Pendientes para produccion

| Tarea | Prioridad | Estimado |
|---|---|---|
| Configurar SMTP real para envio de emails | 🟡 Media | 30 min |
| Cambiar JWT_SECRET por valor seguro | 🟡 Media | 1 min |
| Probar y ajustar con el barbero detalles de UX | 🟡 Media | — |
| Quitar `version: '3.8'` obsoleto de docker-compose.yml | 🟢 Baja | 1 min |

## Funcionalidades implementadas (adicionales)

### Notificaciones Push (Web Push + VAPID)

**Estado:** ✅ Implementado y desplegado

**Descripción:** El sistema envía notificaciones push reales al móvil del admin cuando entra una nueva reserva, tanto desde el flujo público (`POST /book`) como desde creación admin (`POST /admin/appointments`).

**Arquitectura:**
- Protocolo: Web Push estándar (Service Worker + VAPID)
- Sin Firebase, sin terceros
- Claves VAPID generadas por entorno, almacenadas en `.env`
- Suscripciones almacenadas en tabla `push_subscriptions` (PostgreSQL)
- Envío asíncrono via `BackgroundTasks` de FastAPI

**Flujo completo:**
1. Admin abre el panel → Service Worker (`sw.js`) se registra automáticamente
2. Admin va a Configuración → activa notificaciones (requiere clic explícito)
3. Navegador pide permiso → si acepta, genera `PushSubscription`
4. Frontend envía la suscripción a `POST /admin/push/register`
5. Cuando entra una reserva, `send_booking_push()` envía push a todas las subs activas
6. Service Worker recibe el push → muestra notificación nativa con nombre, servicio y hora
7. Al tocar la notificación → abre `admin.html`

**Endpoints nuevos:**
| Método | Path | Descripción |
|---|---|---|
| GET | `/admin/settings` | Ahora incluye `vapid_public_key` |
| POST | `/admin/push/register` | Registra suscripción Web Push (protegido con JWT) |
| DELETE | `/admin/push/unregister?endpoint=...` | Elimina suscripción (protegido con JWT) |

**Archivos tocados:**
- Backend: `push.py` (nuevo), `config.py`, `models.py`, `schemas.py`, `admin.py`, `public.py`, `requirements.txt`
- Migraciones: `0007_push_subscriptions.py` (nuevo)
- Frontend: `sw.js` (nuevo), `admin.html`, `admin.js`, `manifest.json`, `i18n.js`
- Infra: `.env`, `docker-compose.yml`, `nginx/nginx.conf`, `nginx/Dockerfile`

**Variables de entorno nuevas:**
```
VAPID_PUBLIC_KEY=<base64url>
VAPID_PRIVATE_KEY=<base64url>
VAPID_CLAIM_EMAIL=admin@codigodecaballeros.site
ADMIN_PANEL_URL=https://codigodecaballeros.site/admin.html
```

**Validación funcional:**
| Prueba | Resultado |
|---|---|
| Módulo push importa correctamente | ✅ |
| VAPID keys cargadas en container | ✅ |
| GET /admin/settings devuelve vapid_public_key | ✅ |
| POST /admin/push/register (con JWT) → HTTP 200, guarda en BD | ✅ |
| DELETE /admin/push/unregister (con JWT) → HTTP 200 | ✅ |
| sw.js servido por nginx (HTTP 200) | ✅ |
| manifest.json con scope "/" | ✅ |
| Notificación push: muestra nombre + servicio + hora | ✅ (via SW) |
| Degradación si navegador no soporta push | ✅ (Settings muestra mensaje) |

**Limitaciones confirmadas:**
| Plataforma | Requisito |
|---|---|
| **iPhone/iOS** | Requiere iOS 16.4+ y la web debe estar instalada como PWA (Compartir → Añadir a Pantalla de Inicio). Sin instalación, no se reciben push. |
| **Android** | Chrome soporta push directo sin PWA. Con PWA instalada, mejor experiencia. |
| **Desktop** | Chrome/Firefox/Edge/Safari 16.4+ soportan push. |

**Riesgos o pendientes:**
- Si el admin tiene varios dispositivos, todos reciben el push (cada uno registra su propia subscripción)
- Suscripciones caducadas se marcan como `expired` tras 5 fallos (limpieza automática)
- Claves VAPID no deben rotarse a menos que haya breach
- SMTP sigue en modo log-only (sin envío real de emails)

---

## Credenciales rotadas (2026-06-27) — P0 urgente

**Riesgo:** La contraseña admin `CONTRASENA_REEMPLAZADA_ROTACION_20260627` estaba hardcodeada en 13 archivos y commitada en el historial de git.

**Corrección en código (11 archivos):**
- `config.py`: `ADMIN_PASSWORD` sin default + `@model_validator` que falla si está vacía
- `docker-compose.yml`: `${ADMIN_PASSWORD:-pass}` → `${ADMIN_PASSWORD:?required}`
- Todos los tests y scripts: leen de `ADMIN_PASSWORD` env var
- Documentación: toda referencia a la contraseña real eliminada

**Rotación en producción (VPS Hostinger):**
- `ADMIN_PASSWORD` → generada nueva (openssl rand -base64 18)
- `JWT_SECRET` → generado nuevo (openssl rand -base64 32)
- `RESET_DEMO_ALLOWED` → false
- `ADMIN_API_KEY` → eliminado (dead code, Fase 1)
- Backup del .env anterior creado

**Verificación:**
| Prueba | Resultado |
|---|---|
| Login con nueva contraseña | ✅ 200 (JWT emitido) |
| Login con contraseña antigua | ✅ 401 (rechazado) |
| Admin endpoint con nuevo token | ✅ 200 (7 citas upcoming) |
| API pública | ✅ 200 (services, demo.html, admin.html) |
| Backend logs (sin errores) | ✅ migrations OK, Uvicorn running |

## Decisiones tomadas (no reabrir)

- **2026-06-09**: Brand "Codigo de Caballeros Salon" en toda la UI.
- **2026-06-09**: i18n ES/EN via archivo unico i18n.js, sin librerias externas.
- **2026-06-09**: Toda reserva con SQL crudo + EXCLUDE CONSTRAINT (no ORM para insercion).
- **2026-06-15**: Auth migrada de API key estatica a JWT + login profesional.
- **2026-06-15**: Notificaciones con polling + toast + auto-refresh de vistas activas.
- **2026-06-16**: Notificaciones cargan ultimas 24h en primera carga (no solo futuro).
- **2026-06-16**: Boton "Soy nuevo" tanto en formulario publico como en modal admin.
- **2026-06-27**: ADMIN_PASSWORD sin default en código — obligatorio via .env. Docker falla si falta.

---

## Deudas tecnicas conocidas

- Rate limit en memoria (slowapi): no escala a multiples instancias. Migrar a Redis si crece.
- ~~JWT_SECRET hardcodeado en .env para desarrollo.~~ ✅ Rotado en producción (2026-06-27).
- Auth admin basica (usuario fijo + JWT): suficiente para MVP. Migrar a registro/login si hay multiples admins.
- Frontend sin build tool: archivos estaticos servidos directamente con nginx. Funciona, pero no hay tree-shaking ni minificacion.
- Sin pruebas automatizadas E2E (aunque el proyecto tiene capacidad para pytest + Chrome headless).
- Email solo logueado (no se envia realmente hasta configurar SMTP).
- Docker compose advierte que `version` es obsoleto (cosmetico).

---

## Proximo paso

1. Hablar con el barbero para ajustar detalles de UX y operación diaria
2. Configurar SMTP real para envío de emails transaccionales
3. ~~Cambiar JWT_SECRET por un valor seguro~~ ✅ Rotado
4. Entrega formal del producto
5. **Limpieza de historial git** — El commit inicial (`33556fd`) contiene la contraseña antigua. Usar `git filter-repo` para eliminarla del historial completo.
