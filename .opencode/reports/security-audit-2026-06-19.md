# Auditoría de Seguridad — Barber Booking MVP

## Resumen ejecutivo
- **Severidad global**: BAJA (MVP con autenticación JWT implementada)
- **Findings totales**: 3
- **Bloqueantes**: 0

## Findings

### [MAJOR] revenue.toFixed() sin null guard en Dashboard
- **Categoría**: OWASP A08 — Data Integrity
- **Archivo**: `backend/app/...` → Frontend `admin.js:L1513`
- **Descripción**: El componente Dashboard usa `data.revenue.toFixed(0)` sin verificar que `revenue` sea un número. Si el endpoint devolviera `null` o `undefined`, la aplicación lanzaría un TypeError en tiempo de ejecución.
- **Impacto**: Potencial denial-of-service parcial del panel admin si el endpoint de dashboard falla.
- **Recomendación**: Cambiar a `(data.revenue || 0).toFixed(0)` como fallback.
- **Esfuerzo**: Bajo (1 línea, sin cambios en backend)

### [MINOR] CORS abierto a un solo origen específico
- **Categoría**: OWASP A05 — Security Misconfiguration
- **Archivo**: `backend/app/main.py` (middleware CORS)
- **Descripción**: El servidor responde con `access-control-allow-origin: https://codigodecaballeros.site`. Esto es correcto para producción, pero debe verificarse que no haya orígenes adicionales en desarrollo.
- **Impacto**: Bajo — la configuración actual es segura para producción.
- **Recomendación**: Mantener la configuración actual. Considerar variable de entorno para diferentes entornos.
- **Esfuerzo**: Medio (requiere config/CI)

### [INFO] Sin rate limiting visible en endpoints admin
- **Categoría**: OWASP A07 — Auth Failures / A04 — Insecure Design
- **Archivo**: `backend/app/api/admin.py`
- **Descripción**: Los endpoints `/admin/*` no tienen rate limiting explícito. Dependen exclusivamente de la validación JWT.
- **Impacto**: Bajo — el acceso ya está protegido por JWT. Sin embargo, un atacante con token válido podría hacer fuerza bruta.
- **Recomendación**: Implementar rate limiting en endpoints admin (ej: 100 req/min por token).
- **Esfuerzo**: Bajo (slowapi ya está disponible en el proyecto)

## Roadmap de mitigación
1. (Importante) Agregar null guard `(data.revenue || 0).toFixed(0)` en admin.js L1513
2. (Nice-to-have) Rate limiting en endpoints admin
3. (Nice-to-have) Auditoría de dependencias con CVEs conocidos
