# Auditoría de Seguridad — Spot-check feature "horarios por duración de servicio"

**Fecha**: 2026-10-27
**Auditor**: QA & Security Agent (OpenCode)
**Alcance**: Spot-check sobre la rama `feat/slots-por-duracion` (migración 0011
`services.slot_interval_minutes`, grid de huecos por servicio, CRUD admin,
frontend demo/admin/i18n). Entorno LOCAL (`localhost:8000` / `localhost:5173`).
No sustituye a la auditoría completa de producción
(`security-audit-2026-06-29.md`, severidad global ALTA, 16 findings).

**Severidad global del spot-check**: 🟡 MEDIA (sin bloqueantes nuevos; los
findings son pre-existentes o de severidad baja)

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Findings totales | 6 |
| Bloqueantes (CRITICAL/HIGH nuevos) | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| INFO | 2 |

La feature no introduce superficie de ataque nueva: los valores de
`slot_interval_minutes` se validan en Pydantic (1–60 o null), las queries usan
SQL parametrizado (SQLAlchemy `text()` con `:params`, sin concatenación) y no
hay secretos hardcodeados ni `token_uuid` en logs. Los hallazgos son en su
mayoría deudas previas ya conocidas.

---

## Findings (los 3 más críticos resumidos)

### 🟡 [MEDIUM-01] `echo=True` en SQLAlchemy — SQL completo en logs
- **Categoría**: OWASP A05 — Security Misconfiguration
- **Archivo**: `backend/app/db/database.py:6`
- **Descripción**: `create_engine(DATABASE_URL, echo=True)` loguea cada
  statement y parámetros. En producción esto imprime PII (nombres, teléfonos,
  emails de clientes) en stdout/logs del contenedor.
- **Impacto**: Fuga de datos personales a través de logs; superficie ampliada
  si los logs se envían a un agregador externo.
- **Recomendación**: `echo=settings.DEBUG` o `echo=False` en producción.
- **Esfuerzo**: bajo
- **Estado**: PRE-EXISTENTE (no relacionado con esta feature)

### 🟡 [MEDIUM-02] `/admin/*` sin throttling adicional y JWT único de 24h
- **Categoría**: OWASP A01 — Broken Access Control / A07 — Auth Failures
- **Archivo**: `backend/app/api/admin.py` (todos los endpoints), `backend/app/core/auth.py`
- **Descripción**: Los endpoints `/admin/*` exigen JWT (verificado: 401 sin
  token) pero no tienen rate limit propio salvo `/admin/login` (5/min). Un JWT
  robado vale 24h y no hay revocación ni refresh.
- **Impacto**: Robo de token → acceso completo al panel durante 24h; fuzzing
  de endpoints admin sin freno.
- **Recomendación**: Rate limit por IP en rutas admin; tokens más cortos o
  revocables; en producción, restringir `/admin` por IP o VPN.
- **Esfuerzo**: medio
- **Estado**: PRE-EXISTENTE (aceptado por diseño en MVP — documentado)

### 🔵 [LOW-01] Sin CHECK de rango en `services.slot_interval_minutes`
- **Categoría**: OWASP A08 — Data Integrity
- **Archivo**: `backend/migrations/versions/0011_service_slot_interval.py`
- **Descripción**: El rango 1–60 se valida solo en Pydantic
  (`schemas.py:_check_slot_interval_range`). La migración crea la columna sin
  `CHECK (slot_interval_minutes BETWEEN 1 AND 60)`. Un INSERT por SQL directo
  puede meter 0, -5 o 1000.
- **Impacto**: Bajo — el runtime se protege (`logic.py` hace fallback si
  `step_min <= 0`), pero la integridad del dato depende de la capa de
  aplicación.
- **Recomendación**: Añadir CHECK en una migración nueva.
- **Esfuerzo**: bajo
- **Estado**: NUEVO (introducido por esta feature)

### 🔵 [LOW-02] Copy de ayuda engañosa en el campo de intervalo
- **Categoría**: UX / A04 — Insecure Design (menor)
- **Archivo**: `i18n.js:289` (`settings.service_slot_interval_help`) y `i18n.js:715`
- **Descripción**: "Vacío = automático (según la duración del servicio)" /
  "based on service duration" sugiere que el fallback depende de la duración,
  pero la implementación usa el grid global `SLOT_INTERVAL_MINUTES=5` para
  todos los servicios con `NULL`. Además el brief pedía la opción "Vacío" y el
  select etiqueta "Automático".
- **Impacto**: Un admin puede configurar mal los horarios esperando otro
  comportamiento. Sin impacto de seguridad directo.
- **Recomendación**: Corregir el texto ("Vacío = automático (cada 5 min)") o
  implementar fallback por duración si esa era la intención.
- **Esfuerzo**: bajo
- **Estado**: NUEVO (introducido por esta feature)

### ℹ️ [INFO-01] Frontend local sin proxy a la API (gap de tooling)
- **Categoría**: OWASP A05 (menor) / DevEx
- **Archivo**: `demo.js:8`, `admin.js:26` (`const API = window.API_BASE || ''`)
- **Descripción**: Servido con `python3 -m http.server 5173` (comando de
  `AGENTS.md`), las llamadas a `/services`, `/book`, etc. van a :5173 → 404.
  En producción nginx sirve estáticos y proxtea la API (same-origin). El código
  soporta `window.API_BASE` como escape hatch.
- **Impacto**: Un desarrollador puede creer que el frontend está roto en local.
  Las capturas E2E previas de este repo eran HTML mock, no la app real.
- **Recomendación**: Documentar en AGENTS.md el uso de `window.API_BASE` o
  servir con un mini-proxy nginx-like en local.
- **Esfuerzo**: bajo
- **Estado**: PRE-EXISTENTE

### ℹ️ [INFO-02] Validaciones de la feature verificadas como correctas
- `POST /book` rechaza inicios desalineados (400 "not aligned") y el check va
  ANTES de horario (no filtrable cambiando la hora).
- `slot_interval_minutes` inválido (0/70/-5/61) → 422 en POST y PATCH; no se
  persiste (verificado con `GET /services`).
- No se filtra `token_uuid` por logs (`grep logger.*token` en `app/` → vacío).
- Sin secretos hardcodeados en `backend/app/` (grep de literales → vacío;
  credenciales vía `.env`/settings).
- Queries con SQLAlchemy `text()` parametrizado (`:sid`, `:open_dt`, …) — sin
  concatenación de variables (A03 limpio en la feature).

---

## Roadmap de mitigación
1. (Importante) `echo=False` en `database.py` antes de cualquier despliegue con datos reales.
2. (Importante) Rate limit y/o restricción de red para `/admin/*` (hereda el plan de `security-audit-2026-06-29.md`).
3. (Nice-to-have) CHECK de rango en `slot_interval_minutes` + copy i18n corregido.
