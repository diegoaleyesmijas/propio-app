# AGENTS.md — Barber Booking MVP

## Resumen del proyecto
Sistema de reservas mobile-first para barberia/salon single-barber ("Codigo de Caballeros Salon").
Stack: FastAPI + PostgreSQL + SQLModel (backend), React 18 CDN ESM + Tailwind (frontend).
El frontend real son 4 archivos estaticos (demo.html, admin.html, demo.js, admin.js) mas i18n.js compartido. No usa Vite como build activo.

## Fase actual: mejora por fases (Plan 8 fases, Fase 1/8 completada)
El proyecto está ejecutando un plan de 8 fases priorizadas:
- ✅ **Fase 1 (P0-2)**: Eliminar fallback inseguro de API key → solo JWT
- ✅ **Fase 2 (P0-4)**: Reset de datos demo (is_demo flag + POST /admin/reset-demo + botón admin)
- ✅ **Fase 3 (P0-1 + P1-2)**: Agenda Día usable (citas clicables + jerarquía visual + modal detalle + is_first_booking en /summary)
- ⏳ **Fase 4 (P0-3)**: Navegación de fecha unificada + botón "Hoy"
- ⏳ **Fase 5 (P1-1)**: Jerarquía de marca en header
- ⏳ **Fase 6 (P1-4)**: Contexto claro en navegación móvil
- ⏳ **Fase 7 (P1-3)**: Fuente de verdad única de ingresos
- ⏳ **Fase 8 (P2-1)**: Pulido de login/splash

Ver `PROJECT_STATUS.md` para detalle de cada fase completada.

## Archivos clave

```
/home/nx-digital/barber-app/
frontend:
  i18n.js           Diccionario ES/EN compartido (import ESM)
  demo.html         Frontend publico (type="module")
  demo.js           Logica de reserva publica (importa i18n.js)
  admin.html        Panel barbero (type="module")
  admin.js          Logica admin (importa i18n.js)

backend:
  app/core/lang.py          Parser Accept-Language a 'es'/'en'
  app/core/email.py         Envio transactional bilingue (ES/EN)
  app/core/auth.py          Verificacion JWT para /admin/*
  app/core/limiter.py       Rate limiter (slowapi, memoria local)
  app/core/config.py        Settings (DB, horario, SMTP, rate limit, JWT)
  app/core/logic.py         Logica de negocio (slots, create_appointment)
  app/api/public.py         Endpoints publicos (/book, /manage, /services, /available-slots)
  app/api/admin.py          Endpoints admin (summary, clients, upcoming, status, create)
  app/main.py               App FastAPI + middleware (CORS, SlowAPI, auth)

infra:
  docker-compose.yml
  static.Dockerfile
  backend/entrypoint.sh
```

## Skills instaladas
- **find-skills** (vercel-labs, vía `.agents/skills/find-skills/`): Descubre skills en el ecosistema abierto cuando una tarea concreta lo requiera. No se usará por defecto — solo bajo necesidad real validada (instalaciones >1K, fuente reputada, repo >100 stars).

## Decisiones tomadas (no reabrir)

- Marca: siempre "Codigo de Caballeros Salon", nunca "Barber Studio".
- Idioma persistencia: memoria sesion -> localStorage (try/catch) -> navigator.languages -> fallback 'es'.
- Selector idioma: "Espanol | English" / "English | Espanol" en header, sin banderas.
- Sin traduccion BD: nombres de servicios y precios no se traducen.
- Placeholder telefono: siempre espanol (+34 600 000 000).
- Fechas: se renderizan segun locale() (ES -> es-ES, EN -> en-US).
- type="module": demo.html y admin.html cargan con type="module".
- Sin localStorage: app no falla (try/catch silencioso).
- Auth admin: JWT via header Authorization: Bearer <token>. Token obtenido via POST /admin/login. En produccion debe ir siempre detras de HTTPS.
- Rate limit: slowapi en memoria local, 5 peticiones/minuto por IP en POST /book. Configurable via RATE_LIMIT_BOOK.
- No commits a git: el usuario decide cuando commitear.

## Convenciones de codigo

- Frontend: React 18 via CDN (esm.sh), createElement plano sin JSX, Tailwind via CDN, mobile-first.
- Backend: Python 3.10+, FastAPI, SQLModel, Pydantic v2, UTC en backend, logs a stdout.
- Errores HTTP: 400 (regla negocio), 401 (no autorizado), 404 (no encontrado), 409 (solapamiento), 429 (rate limit), 500 (inesperado).
- Auth admin centralizada por router (dependencies=[Depends(verify_admin)]), no por ruta individual.
- Emails bilingues: send_confirmation() y send_cancellation() aceptan lang='es'|'en', cuerpos y asuntos en el idioma correspondiente.
- i18n: t('key', ...args) con placeholders {0}, {1}. Sin dependencias externas.

## Estado por capa

- **Backend**: MVP completo con auth admin JWT, rate limiting (/book), emails bilingües.
- **Frontend**: demo y admin funcionales con i18n ES/EN completo.
- **Email**: bilingue validado (ES y EN), routers conectados via Accept-Language.
- **Seguridad**: auth JWT-only (sin fallback API key), rate limit en /book. Pendiente HTTPS para produccion.
- **Docker**: docker-compose.yml y static.Dockerfile creados pero no verificados (Docker no disponible en host).

## Deudas tecnicas

- Rate limiting en memoria local: no escala a multiples replicas. Migrar a Redis si hay >1 instancia.
- Sin HTTPS: el despliegue en produccion requiere reverse proxy (nginx/Caddy) con TLS.
- Auth admin basica (JWT fijo): suficiente para MVP. Migrar a login con refresh tokens si el proyecto crece.
- Frontend sin build: los archivos se sirven directamente con http.server. Para produccion, considerar servir con nginx (static.Dockerfile ya existe).
- Docker pendiente de verificacion: no se ha probado docker-compose up en este host.
