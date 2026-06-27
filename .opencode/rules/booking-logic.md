# Reglas del proyecto: Barber Booking MVP

Estas reglas se aplican a **cualquier sesión de opencode** que trabaje en este proyecto. Son leídas automáticamente al inicio.

## Invariantes del sistema

1. **PostgreSQL es la fuente de verdad** del calendario. Ninguna validación de solapamiento vive solo en Python.
2. **Toda reserva se inserta con SQL crudo** (`tstzrange(inicio, fin, '[)')`) para que el constraint `EXCLUDE USING GIST` valide la unicidad. Nunca construir el `Appointment(slot=...)` desde el ORM.
3. **Snapshots vs CRM**: `appointments.customer_*` es histórico; `clients` es el dato actual. Al actualizar un cliente, refresca `clients` pero NO las citas pasadas.
4. **Estados válidos**: `booked → completed|cancelled`. Prohibido `cancelled → booked`. Prohibido `completed → *`.
5. **Cancelación por cliente**: bloqueada si faltan < `CANCELLATION_WINDOW_HOURS` (24h por defecto).
6. **Notificaciones**: usar el campo `notification_status` con valores `pending|sent|skipped_no_email|failed`. NO usar `reminder_sent: bool`.

## Convenciones de código

- **Backend**: Python 3.10+, FastAPI, SQLModel, Pydantic v2. Sin `print()`, usar `logging`.
- **Frontend**: React 18, Vite, Tailwind. Mobile-first. Sin emojis decorativos en producción.
- **Timezones**: UTC en backend, conversión a local en cliente.
- **Errores HTTP**: 400 (regla de negocio), 404 (no encontrado), 409 (solapamiento), 500 (inesperado).
- **Logs**: stdout/stderr, no archivos. Formato: `INFO:logger.name:message`.
- **No commits** a git. El usuario decide cuándo commitear.

## Endpoints clave (referencia rápida)

| Método | Path | Quién |
|---|---|---|
| GET | `/services` | público |
| GET | `/available-slots?service_id&date` | público |
| POST | `/book` | público |
| GET | `/manage/{token_uuid}` | público (gestión cliente) |
| DELETE | `/manage/{token_uuid}` | público (cancelación cliente) |
| GET | `/admin/summary?date` | admin |
| GET | `/admin/clients` | admin |
| GET | `/admin/upcoming` | admin |
| PATCH | `/admin/appointments/{id}/status` | admin |
| POST | `/admin/appointments` | admin |
| GET | `/admin/dashboard` | admin |
| GET | `/admin/clients/{id}` | admin |
| PATCH | `/admin/clients/{id}` | admin |
| DELETE | `/admin/clients/{id}` | admin |
| POST | `/admin/login` | público (devuelve JWT) |

## Comandos de desarrollo

```bash
# Backend dev (venv vive fuera del proyecto, en HOME)
cd /home/nx-digital/barber-app/backend
/home/nx-digital/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# Migraciones
cd /home/nx-digital/barber-app/backend
/home/nx-digital/venv/bin/alembic upgrade head

# Frontend demo (sin Node), desde la raíz del proyecto
cd /home/nx-digital/barber-app
python3 -m http.server 5173

# Verificación rápida
curl http://localhost:8000/services
PGPASSWORD=postgres psql -U postgres -h localhost -d barberapp
```

## Deudas conocidas (no resolver en MVP)

- ❌ Envío real de emails (ahora solo loguea `[EMAIL] Reminder to...`).
- ❌ HTTPS / reverse proxy.
- ❌ Validación de formato de `customer_phone`.
- ❌ Frontend build de producción (sin Node en este host).
