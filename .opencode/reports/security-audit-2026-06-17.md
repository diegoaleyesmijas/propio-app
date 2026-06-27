# Auditoría de Seguridad — Barber Booking MVP (Producción)

**Target:** https://codigodecaballeros.site  
**Fecha:** 2026-06-17  

## Resumen Ejecutivo

- **Severidad global:** MEDIA
- **Findings totales:** 6
- **Bloqueantes:** 1 (bug 500)

---

## Findings

### [CRÍTICO] `/admin/stats/new-clients` retorna 500 Internal Server Error
- **Categoría:** OWASP A05 — Security Misconfiguration
- **Archivo:** Backend — `app/api/admin.py` (endpoint de stats)
- **Descripción:** El endpoint `GET /admin/stats/new-clients` lanza una excepción no capturada que resulta en 500 Internal Server Error. La respuesta es `text/plain` en lugar de `application/json`.
- **Impacto:** Funcionalidad de estadísticas rota. Podría exponer stack traces en otros entornos.
- **Recomendación:** Revisar el handler del endpoint. Añadir try/except y logging. Devolver JSON con code 500.
- **Esfuerzo:** bajo

### [ALTA] CORS abierto con wildcard `Access-Control-Allow-Origin: *`
- **Categoría:** OWASP A05 — Security Misconfiguration
- **Archivo:** `backend/app/main.py` — Configuración CORS
- **Descripción:** La API permite peticiones desde cualquier origen (`ACAO: *`). Un sitio malicioso podría hacer peticiones cross-origin y leer respuestas si no hay otras protecciones.
- **Impacto:** Posible exfiltración de datos si hay sesión activa del admin o si se almacenan credenciales en localStorage.
- **Recomendación:** Restringir CORS a los orígenes del frontend (`https://codigodecaballeros.site`). Para desarrollo usar esta configuración, pero en producción añadir `allow_origins=["https://codigodecaballeros.site"]`.
- **Esfuerzo:** bajo

### [ALTA] Sin HSTS ni cabeceras de seguridad HTTP
- **Categoría:** OWASP A02 — Cryptographic Failures / A05
- **Archivo:** nginx (infraestructura)
- **Descripción:** No se encontraron las siguientes cabeceras de seguridad: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`. El redirect HTTP→HTTPS funciona, pero sin HSTS la primera petición HTTP puede ser interceptada.
- **Impacto:** Vulnerabilidad a ataques MITM en la primera conexión (downgrade attack). Sin X-Frame-Options el sitio puede ser embebido en iframes (clickjacking).
- **Recomendación:** Configurar en nginx:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Content-Security-Policy "default-src 'self'" always;
  ```
- **Esfuerzo:** bajo

### [MEDIA] Sin Cache-Control en assets estáticos JS
- **Categoría:** OWAP A05 — Security Misconfiguration
- **Archivo:** Frontend (nginx/static serving)
- **Descripción:** `demo.js`, `admin.js`, `i18n.js` se sirven sin cabeceras de caché. Esto impacta rendimiento (el navegador descarga los assets en cada visita) y no permite inmutabilidad.
- **Recomendación:** Usar hashing en nombres de archivo y `Cache-Control: public, max-age=31536000, immutable`.
- **Esfuerzo:** medio

### [MEDIA] Rate limit ausente en endpoints admin
- **Categoría:** OWASP A07 — Auth Failures
- **Archivo:** `backend/app/core/limiter.py`
- **Descripción:** El rate limit (slowapi) solo está configurado para `POST /book`. Los endpoints admin no tienen rate limit, permitiendo a un atacante con API key válida hacer DoS/fuzzing intensivo.
- **Recomendación:** Añadir rate limit a los endpoints admin, aunque sea más permisivo (ej: 60/min).
- **Esfuerzo:** bajo

### [BAJA] Marca incorrecta en `<title>` de la demo
- **Categoría:** Diseño / Consistencia
- **Archivo:** `frontend/demo.html` (o el HTML servido en `/`)
- **Descripción:** El título de la página es "Barber Studio · Reservas (Demo Validación)" en lugar de "Codigo de Caballeros Salon".
- **Recomendación:** Actualizar el `<title>` para reflejar la marca correcta.
- **Esfuerzo:** bajo

---

## Roadmap de mitigación

1. **(Crítico)** Arreglar `GET /admin/stats/new-clients` (500 error)
2. **(Importante)** Restringir CORS a dominios específicos
3. **(Importante)** Añadir cabeceras de seguridad HTTP (HSTS, CSP, XFO, XCTO)
4. **(Media)** Añadir Cache-Control a assets estáticos
5. **(Media)** Añadir rate limit a endpoints admin
6. **(Baja)** Corregir nombre de marca en título de la demo
