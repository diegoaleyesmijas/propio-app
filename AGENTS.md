# AGENTS.md — Barber Booking MVP

High-signal guidance for OpenCode agents working in this repo.
Every line exists because an agent would likely miss or waste time on it without help.

---

## Before anything: read the rules file

`.opencode/rules/booking-logic.md` is auto-loaded by `opencode.json` as instructions.
It contains **system invariants** (state machine, DB constraint, notification fields, cancellation window).
Read it before editing any backend or frontend code — it overrides assumptions.

---

## What makes this repo unusual

- **Real frontend is 5 static files at the project root:** `demo.html`, `demo.js`, `admin.html`, `admin.js`, `i18n.js`. These are served directly by nginx in production. No build step, no bundler.
- **The `frontend/` directory exists with a Vite + React + JSX setup but is NOT used in production.** Editing it does nothing for the running app.
- **Python venv is at `/home/nx-digital/venv/`** (outside the project). All Python commands must use absolute path ` /home/nx-digital/venv/bin/<tool>` or activate it first.
- **Auth is JWT-only.** API Key fallback was removed (`auth.py` has only JWT). `POST /admin/login` → JWT → `Authorization: Bearer <token>`.
- **Reservations use raw SQL** with `tstzrange` and `EXCLUDE USING GIST`. Never construct `Appointment(slot=...)` from the ORM — the `slot` column is a TSTZRANGE managed by the DB constraint.
- **7 Alembic migrations** (0001–0007). Always run `alembic upgrade head` before testing.
- **Production static files are baked into the Docker nginx image.** Editing `admin.js` or `admin.html` requires `docker compose build nginx && docker compose up -d` to see changes in production.

---

## Developer commands (exact)

```bash
# Backend (venv external to project)
cd /home/nx-digital/barber-app/backend
/home/nx-digital/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run migrations
/home/nx-digital/venv/bin/alembic upgrade head

# Serve frontend static files (no Node needed)
cd /home/nx-digital/barber-app
python3 -m http.server 5173

# Run tests (backend must be running on :8000)
/home/nx-digital/venv/bin/python -m pytest tests/ -v

# Verify JS ESM syntax (catches silent blank-page bugs)
node --input-type=module --check admin.js

# Production deploy (from VPS)
docker compose build backend nginx && docker compose up -d
```

---

## Decisions settled (do not reopen)

| Decision | Rule |
|---|---|
| **Brand name** | Always "Código de Caballeros Salon", never "Barber Studio" or anything else |
| **i18n fallback** | sessionStorage → localStorage (try/catch) → navigator.languages → `'es'` |
| **Language selector** | Text-only "Español \| English", no flag icons |
| **Phone format** | Always `+34 600 000 000` (Spanish placeholder) |
| **Date formatting** | `locale()` — ES uses `es-ES`, EN uses `en-US` |
| **Auth** | JWT via `Authorization: Bearer <token>`. HTTPS required in production |
| **No emoji** | Unless the user explicitly requests them |
| **No `print()`** | Use `logging` (verified: zero `print()` calls in backend Python) |
| **Date source of truth** | `YYYY-MM-DD` string for all agenda views |
| **Rate limit** | SlowAPI in-memory, 5/min on `POST /book`, configurable via `RATE_LIMIT_BOOK` |
| **ADMIN_PASSWORD** | No default — `.env` required, app crashes at startup if empty |
| **Reset demo** | `RESET_DEMO_ALLOWED=true` env var required; default is `false` |

---

## Key file map

| File | Role |
|---|---|
| `admin.js` (~4745 lines) | React 18 CDN admin panel (Agenda, CRM, Dashboard, Settings) |
| `demo.js` (~508 lines) | Public booking flow (3 steps: service → slot → form) |
| `i18n.js` (~772 lines) | ES/EN dictionary shared by both frontends |
| `backend/app/core/auth.py` | JWT create + verify (only auth method) |
| `backend/app/core/logic.py` | Slot calculation + appointment creation (raw SQL) |
| `backend/app/core/state_machine.py` | `ALLOWED_TRANSITIONS` dict — `booked→{completed,cancelled}`, others terminal |
| `backend/app/core/email.py` | Bilingual transactional email (works in production via Gmail SMTP) |
| `backend/app/core/push.py` | Web Push VAPID (active in production) |
| `backend/app/scheduler/tasks.py` | APScheduler: auto-complete, reminders (15min), recalls (6h) |
| `DESIGN_SYSTEM.md` | Visual token system for admin.js — check before styling changes |
| `.env.example` | Authoritative list of all env vars with defaults |

---

## Gotchas

- **`send_recalls()` only logs** — does NOT send email (known bug, not part of current scope).
- **booking-logic.md claims "envío real de emails ahora solo loguea"** — this is **stale**. Email IS functional in production via Gmail SMTP (`send_confirmation` + `send_cancellation` both send real emails when `SMTP_HOST` is configured).
- **`RESET_DEMO_ALLOWED` defaults to `false`** — must be explicitly set to `true` in `.env` to use `/admin/reset-demo` on production.
- **No git commits by agent** — the user decides when to commit.
- **fastapi dev mode** uses `--reload` for backend; frontend uses `python3 -m http.server` for static files. There is no hot-reload for frontend changes.
- **nginx config has both static file routes AND a catch-all proxy** — the `location /` block at line 82 of `nginx.conf` proxies to backend. Static file locations must be listed before this catch-all.
