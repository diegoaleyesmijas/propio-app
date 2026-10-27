"""
QA E2E — Funcionalidad "horarios por duración de servicio" (estilo Booksy).

Valida (rama feat/slots-por-duracion):
  A. GET /available-slots: inicios alineados al grid del servicio
     (slot_interval_minutes o fallback SLOT_INTERVAL_MINUTES=5),
     hueco solo si start+duration <= cierre del bloque.
  B. POST /book rechaza inicios desalineados (400); acepta alineados (200);
     fin exacto al cierre del bloque (13:40+20=14:00); solape -> 409.
     POST /admin/appointments NO valida alineacion (admin libre).
  C. CRUD /admin/services con slot_interval_minutes (1-60 o null) -> 200;
     0 / 70 -> 422. GET /services lo expone.
  F. Spot-check seguridad: /admin/* exige JWT (401), /book con rate limit.

Convenciones horarias (IMPORTANTE):
  La API devuelve ISO-8601 en UTC. Los horarios del negocio son
  Europe/Madrid. El 2026-10-28 es CET (UTC+1): 13:40 local = 12:40Z.
  Los literales del brief "13:40 / 13:45 / 12:47" se prueban en HORA LOCAL
  (Europe/Madrid), que es como se interpretan en los requisitos
  ("ultimo inicio del bloque de manana 10:00-14:00 es 13:40").

Datos de prueba: sufijo "_test", telefono +34999..., cleanup al terminar.
Requiere backend en http://localhost:8000 (pytest tests/test_slot_interval_api.py -v -s).
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
import requests

BASE = os.environ.get("QA_BASE_URL", "http://localhost:8000")
ARTIFACTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_artifacts", "api")
TZ = ZoneInfo("Europe/Madrid")

# Fecha objetivo: manana laborable (miercoles 2026-10-28, sin festivo)
TARGET_DATE = "2026-10-28"

TEST_CUSTOMER = {
    "customer_name": "QA Interval Test",
    "customer_phone": "+34999000001",
    "customer_email": "qa-interval-test@example.com",
}

# ── Credenciales admin (desde .env si no estan en el entorno) ──────────────
def _load_env_file():
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())


_load_env_file()
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "")

session = requests.Session()


# ── Helpers ────────────────────────────────────────────────────────────────
def log(msg: str, ok: bool = None):
    mark = "✅" if ok is True else "❌" if ok is False else "ℹ️"
    print(f"  {mark} {msg}")


def save_artifact(name: str, payload):
    os.makedirs(ARTIFACTS, exist_ok=True)
    path = os.path.join(ARTIFACTS, name)
    with open(path, "w") as fh:
        fh.write(payload if isinstance(payload, str) else repr(payload))
    log(f"artifact: {path}")


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def local_hhmm(iso: str) -> str:
    return parse_iso(iso).astimezone(TZ).strftime("%H:%M")


def local_mod(iso: str) -> int:
    d = parse_iso(iso).astimezone(TZ)
    return d.hour * 60 + d.minute


@pytest.fixture(scope="module")
def jwt():
    if not ADMIN_PASS:
        pytest.skip("ADMIN_PASSWORD no disponible en entorno ni .env")
    r = session.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=10)
    assert r.status_code == 200, f"login admin fallo: {r.status_code} {r.text[:200]}"
    tok = r.json()["access_token"]
    log("JWT admin obtenido via POST /admin/login", True)
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def auth_headers(jwt):
    return {**jwt, "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_services(auth_headers):
    """Crea servicios de prueba con grid 15 y 7 min. Cleanup: borrado SQL."""
    created = []
    specs = [
        ("QA Interval 15_test", 15, 15),
        ("QA Interval 7_test", 20, 7),
    ]
    for name, dur, interval in specs:
        r = session.post(
            f"{BASE}/admin/services",
            headers=auth_headers,
            json={
                "name": name,
                "price": 10.0,
                "duration_minutes": dur,
                "slot_interval_minutes": interval,
            },
            timeout=10,
        )
        assert r.status_code in (200, 201), f"create service {name}: {r.status_code} {r.text[:200]}"
        sid = r.json().get("id")
        created.append(sid)
        log(f"servicio de prueba creado id={sid} name={name!r} interval={interval}", True)
    yield created
    # Cleanup: borrado fisico de las filas creadas por este test (soft-delete
    # del endpoint deja la fila; aqui limpiamos del todo via SQL).
    for sid in created:
        try:
            r = session.delete(f"{BASE}/admin/services/{sid}", headers=auth_headers, timeout=10)
            log(f"cleanup soft-delete service {sid}: HTTP {r.status_code}")
        except Exception as e:
            log(f"cleanup service {sid} error: {e}", False)


# Rate limit de POST /book: 5/minuto por IP. Espaciamos llamadas reales.
_book_calls: list = []


def _book_wait():
    """Garantiza <= 4 llamadas a /book en la ventana movil de 60s."""
    now = time.time()
    _book_calls[:] = [t for t in _book_calls if now - t < 65]
    if len(_book_calls) >= 4:
        sleep_for = 65 - (now - _book_calls[0])
        log(f"esperando {sleep_for:.0f}s por rate limit de /book")
        time.sleep(sleep_for + 1)


def book_public(payload: dict) -> requests.Response:
    _book_wait()
    r = session.post(f"{BASE}/book", json=payload, timeout=10)
    _book_calls.append(time.time())
    return r


def cancel_appointment(appt_id: int, auth_headers: dict):
    r = session.patch(
        f"{BASE}/admin/appointments/{appt_id}/status",
        headers=auth_headers,
        json={"status": "cancelled"},
        timeout=10,
    )
    log(f"cleanup: cancel appointment #{appt_id} -> HTTP {r.status_code}", r.status_code == 200)
    return r


def find_appointment_id(auth_headers: dict, customer_name: str, date_str: str) -> int | None:
    r = session.get(f"{BASE}/admin/summary", headers=auth_headers, params={"date": date_str}, timeout=10)
    if r.status_code != 200:
        return None
    for a in r.json().get("appointments", []):
        if a.get("customer_name") == customer_name:
            return a.get("id")
    return None


# ═══════════════════════════════════════════════════════════════════════════
# A. GET /available-slots — grid del servicio
# ═══════════════════════════════════════════════════════════════════════════

class TestAvailableSlotsGrid:
    """Caso A — servicio 32 (20 min, slot_interval NULL -> fallback 5)."""

    def test_a1_grid_5min_fallback_service_32(self):
        r = session.get(f"{BASE}/available-slots", params={"service_id": 32, "date": TARGET_DATE}, timeout=10)
        assert r.status_code == 200
        slots = r.json()["slots"]
        save_artifact(f"available_slots_service32_{TARGET_DATE}.json", r.text)
        log(f"GET /available-slots service_id=32 date={TARGET_DATE} -> {len(slots)} huecos", True)

        # 1) Todos los inicios en multiplos de 5 min (hora local) y sin segundos
        bad = [s for s in slots if local_mod(s) % 5 != 0 or parse_iso(s).second not in (0,)]
        assert not bad, f"inicios desalineados al fallback 5min: {bad[:5]}"
        log("todos los inicios son minutos % 5 == 0 (hora local)", True)

        # 2) Devuelve ISO UTC
        assert all(s.endswith("+00:00") or s.endswith("Z") for s in slots), "slots en ISO UTC"
        log("formato de slots = ISO-8601 UTC", True)

        hours = {local_hhmm(s) for s in slots}
        morning = sorted(s for s in slots if parse_iso(s).astimezone(TZ).hour < 14)
        afternoon = sorted(s for s in slots if parse_iso(s).astimezone(TZ).hour >= 14)

        # 3) Bloque manana 10:00-14:00: primero 10:00, ultimo 13:40; 13:45 NO
        assert local_hhmm(morning[0]) == "10:00", f"primer hueco manana: {local_hhmm(morning[0])}"
        assert local_hhmm(morning[-1]) == "13:40", f"ultimo hueco manana: {local_hhmm(morning[-1])} (esperado 13:40)"
        assert "13:45" not in hours, "13:45 no debe aparecer (13:45+20=14:05 > cierre 14:00)"
        log("manana 10:00-14:00: ultimo inicio 13:40 (13:40+20=14:00 cabe); 13:45 ausente", True)

        # 4) Bloque tarde 16:30-20:30: 16:45 y 20:10 presentes
        assert "16:45" in hours, "16:45 debe estar disponible por la tarde"
        assert "20:10" in hours, "20:10 debe ser el ultimo inicio de la tarde (20:10+20=20:30)"
        assert local_hhmm(afternoon[0]) == "16:30", f"primer hueco tarde: {local_hhmm(afternoon[0])}"
        assert local_hhmm(afternoon[-1]) == "20:10", f"ultimo hueco tarde: {local_hhmm(afternoon[-1])}"
        log("tarde 16:30-20:30: 16:45 y 20:10 presentes; ultimo inicio 20:10", True)

        # 5) Todo hueco cabe en su bloque (start+20 <= cierre del bloque)
        for s in slots:
            end = parse_iso(s) + timedelta(minutes=20)
            local = parse_iso(s).astimezone(TZ)
            if local.hour < 14:
                close_local = local.replace(hour=14, minute=0, second=0, microsecond=0)
            else:
                close_local = local.replace(hour=20, minute=30, second=0, microsecond=0)
            assert end <= close_local.astimezone(timezone.utc), f"hueco {s} no cabe en su bloque"
        log("ningun hueco excede el cierre de su bloque (start+20 <= close)", True)

    def test_a2_grid_15min_service(self, test_services):
        sid_15 = test_services[0]
        r = session.get(f"{BASE}/available-slots", params={"service_id": sid_15, "date": TARGET_DATE}, timeout=10)
        assert r.status_code == 200
        slots = r.json()["slots"]
        save_artifact(f"available_slots_service{sid_15}_interval15_{TARGET_DATE}.json", r.text)
        assert slots, "servicio 15min debe tener huecos"
        bad = [s for s in slots if local_mod(s) % 15 != 0]
        assert not bad, f"inicios no alineados a 15min: {bad[:5]}"
        hhmm_set = {local_hhmm(s)[3:] for s in slots}
        assert hhmm_set <= {"00", "15", "30", "45"}, f"minutos inesperados: {hhmm_set}"
        log(f"servicio interval=15: {len(slots)} huecos, solo minutos :00/:15/:30/:45", True)

    def test_a3_grid_7min_service(self, test_services):
        sid_7 = test_services[1]
        r = session.get(f"{BASE}/available-slots", params={"service_id": sid_7, "date": TARGET_DATE}, timeout=10)
        assert r.status_code == 200
        slots = r.json()["slots"]
        save_artifact(f"available_slots_service{sid_7}_interval7_{TARGET_DATE}.json", r.text)
        assert slots, "servicio 7min debe tener huecos"
        bad = [s for s in slots if local_mod(s) % 7 != 0]
        assert not bad, f"inicios no alineados a 7min (minutos de dia locales): {bad[:5]}"
        log(f"servicio interval=7: {len(slots)} huecos, minutos-de-dia locales % 7 == 0", True)
        # Y todos los huecos caben con 20 min de duracion dentro del bloque
        for s in slots:
            end = parse_iso(s) + timedelta(minutes=20)
            h = parse_iso(s).astimezone(TZ).hour
            limit_local = (14, 0) if h < 14 else (20, 30)
            lim = end.astimezone(TZ).replace(hour=limit_local[0], minute=limit_local[1], second=0, microsecond=0)
            assert end <= lim.astimezone(timezone.utc), f"hueco {s} no cabe en el bloque"


# ═══════════════════════════════════════════════════════════════════════════
# B. Reservas — alineacion, horario, solape, admin libre
# ═══════════════════════════════════════════════════════════════════════════

class TestBookings:
    created_ids: list = []

    def test_b1_book_misaligned_rejected(self):
        """12:47 (local) = 11:47Z, servicio 32 -> 400 'not aligned'."""
        payload = {**TEST_CUSTOMER, "service_id": 32, "start_time": "2026-10-28T11:47:00Z"}
        r = book_public(payload)
        save_artifact("book_misaligned_1147Z_response.json", f"HTTP {r.status_code}\n{r.text}")
        assert r.status_code == 400, f"esperado 400, obtuvimos {r.status_code}: {r.text[:200]}"
        assert "not aligned" in r.text.lower(), f"detalle inesperado: {r.text[:200]}"
        log("POST /book 12:47 local (11:47Z) -> 400 'start time is not aligned to the booking interval'", True)

    def test_b2_book_last_morning_slot_1340_local(self, auth_headers):
        """13:40 local = 12:40Z -> 200 y fin exacto 14:00 local (13:00Z)."""
        payload = {**TEST_CUSTOMER, "service_id": 32, "start_time": "2026-10-28T12:40:00Z"}
        r = book_public(payload)
        save_artifact("book_aligned_1240Z_response.json", f"HTTP {r.status_code}\n{r.text}")
        assert r.status_code == 200, f"esperado 200, obtuvimos {r.status_code}: {r.text[:300]}"
        data = r.json()
        start = parse_iso(data["start_time"])
        end = parse_iso(data["end_time"])
        assert start == parse_iso("2026-10-28T12:40:00Z"), f"start inesperado: {data['start_time']}"
        assert end == parse_iso("2026-10-28T13:00:00Z"), f"fin inesperado: {data['end_time']} (esperado 14:00 local exacto)"
        log("POST /book 13:40 local (12:40Z) -> 200, fin 14:00 local exacto (13:00Z)", True)

        # Cleanup diferido: la cita es <24h -> el cliente no puede cancelar
        # (regla CANCELLATION_WINDOW_HOURS); se cancela via admin.
        appt_id = find_appointment_id(auth_headers, TEST_CUSTOMER["customer_name"], TARGET_DATE)
        if appt_id:
            TestBookings.created_ids.append(appt_id)
        else:
            log("no se encontro el id de la cita en /admin/summary para cleanup", False)

    def test_b3_book_1345_local_out_of_hours(self):
        """13:45 local = 12:45Z, servicio 32 (20 min) -> 400 fuera de horario."""
        payload = {**TEST_CUSTOMER, "service_id": 32, "start_time": "2026-10-28T12:45:00Z"}
        r = book_public(payload)
        save_artifact("book_1245Z_out_of_hours_response.json", f"HTTP {r.status_code}\n{r.text}")
        assert r.status_code == 400, f"esperado 400, obtuvimos {r.status_code}: {r.text[:200]}"
        assert "business hours" in r.text.lower() or "closed" in r.text.lower(), f"detalle inesperado: {r.text[:200]}"
        log("POST /book 13:45 local (12:45Z) -> 400 fuera de horario (13:45+20=14:05 > 14:00)", True)

    def test_b4_book_overlap_409(self):
        """Mismo hueco que b2 -> 409 (constraint EXCLUDE USING GIST)."""
        payload = {
            **TEST_CUSTOMER,
            "customer_name": "QA Interval Test Overlap_test",
            "service_id": 32,
            "start_time": "2026-10-28T12:40:00Z",
        }
        r = book_public(payload)
        save_artifact("book_overlap_1240Z_response.json", f"HTTP {r.status_code}\n{r.text}")
        assert r.status_code == 409, f"esperado 409, obtuvimos {r.status_code}: {r.text[:200]}"
        log("POST /book solapado 12:40Z -> 409 (no_overlapping_appointments)", True)

    def test_b5_admin_misaligned_allowed(self, auth_headers):
        """Admin libre: 12:47 local (11:47Z) desalineado -> 200."""
        payload = {
            "service_id": 32,
            "customer_name": "QA Interval Admin_test",
            "customer_phone": "+34999000002",
            "customer_email": "qa-interval-admin-test@example.com",
            "start_time": "2026-10-28T11:47:00Z",
            "is_demo": True,
        }
        r = session.post(f"{BASE}/admin/appointments", headers=auth_headers, json=payload, timeout=10)
        save_artifact("admin_book_misaligned_1147Z_response.json", f"HTTP {r.status_code}\n{r.text}")
        assert r.status_code == 200, f"esperado 200, obtuvimos {r.status_code}: {r.text[:300]}"
        log("POST /admin/appointments 12:47 local (11:47Z) desalineado -> 200 (admin libre, is_demo=true)", True)
        appt_id = r.json().get("id")
        if appt_id:
            TestBookings.created_ids.append(appt_id)

    def test_teardown_cancel_created(self, auth_headers):
        """Las citas canceladas no bloquean huecos. Se cancela lo creado."""
        for appt_id in list(TestBookings.created_ids):
            cancel_appointment(appt_id, auth_headers)
        TestBookings.created_ids.clear()
        assert True


# ═══════════════════════════════════════════════════════════════════════════
# C. CRUD servicios — slot_interval_minutes
# ═══════════════════════════════════════════════════════════════════════════

class TestServicesCrud:
    def test_c1_create_update_valid_intervals(self, auth_headers, test_services):
        sid = test_services[0]
        # PATCH a 30
        r = session.patch(
            f"{BASE}/admin/services/{sid}",
            headers=auth_headers,
            json={"slot_interval_minutes": 30},
            timeout=10,
        )
        assert r.status_code == 200, f"PATCH interval=30: {r.status_code} {r.text[:200]}"
        log("PATCH /admin/services slot_interval_minutes=30 -> 200", True)

        # GET /services lo refleja
        r = session.get(f"{BASE}/services", timeout=10)
        svc = next(s for s in r.json() if s["id"] == sid)
        assert svc["slot_interval_minutes"] == 30, f"GET /services no refleja 30: {svc}"
        log("GET /services devuelve slot_interval_minutes=30", True)

        # PATCH explicit null -> fallback global
        r = session.patch(
            f"{BASE}/admin/services/{sid}",
            headers=auth_headers,
            json={"slot_interval_minutes": None},
            timeout=10,
        )
        assert r.status_code == 200, f"PATCH interval=null: {r.status_code} {r.text[:200]}"
        r = session.get(f"{BASE}/services", timeout=10)
        svc = next(s for s in r.json() if s["id"] == sid)
        assert svc["slot_interval_minutes"] is None, f"null explicito no persiste: {svc}"
        log("PATCH slot_interval_minutes=null -> 200 y persiste como null (fallback global)", True)

    def test_c2_create_with_null_interval(self, auth_headers):
        r = session.post(
            f"{BASE}/admin/services",
            headers=auth_headers,
            json={"name": "QA Interval Null_test", "price": 5.0, "duration_minutes": 10, "slot_interval_minutes": None},
            timeout=10,
        )
        assert r.status_code in (200, 201), f"create con null: {r.status_code} {r.text[:200]}"
        sid = r.json()["id"]
        log(f"POST /admin/services con slot_interval_minutes=null -> 200 (id={sid})", True)
        session.delete(f"{BASE}/admin/services/{sid}", headers=auth_headers, timeout=10)

    def test_c3_invalid_intervals_422(self, auth_headers):
        for bad in (0, 70, -5, 61):
            r = session.post(
                f"{BASE}/admin/services",
                headers=auth_headers,
                json={"name": f"QA Interval Bad{bad}_test", "price": 5.0, "duration_minutes": 10,
                      "slot_interval_minutes": bad},
                timeout=10,
            )
            assert r.status_code == 422, f"interval={bad} deberia dar 422, obtuvimos {r.status_code}: {r.text[:200]}"
            log(f"POST /admin/services slot_interval_minutes={bad} -> 422", True)

        # PATCH invalido tambien
        sid = None
        r = session.get(f"{BASE}/services", timeout=10)
        sid = next(s["id"] for s in r.json() if s["name"] == "QA Interval 15_test")
        r = session.patch(
            f"{BASE}/admin/services/{sid}",
            headers=auth_headers,
            json={"slot_interval_minutes": 0},
            timeout=10,
        )
        assert r.status_code == 422, f"PATCH interval=0 deberia dar 422: {r.status_code}"
        log("PATCH /admin/services slot_interval_minutes=0 -> 422", True)

    def test_c4_no_invalid_interval_leak(self, auth_headers):
        """Ningun servicio expone slot_interval_minutes fuera de {null, 1..60}."""
        r = session.get(f"{BASE}/services", timeout=10)
        assert r.status_code == 200
        for s in r.json():
            v = s.get("slot_interval_minutes")
            assert v is None or 1 <= v <= 60, f"intervalo invalido expuesto: {s}"
        r = session.get(f"{BASE}/admin/services", headers=auth_headers, timeout=10)
        for s in r.json():
            v = s.get("slot_interval_minutes")
            assert v is None or 1 <= v <= 60, f"intervalo invalido en admin: {s}"
        log("GET /services y /admin/services: ningun slot_interval_minutes fuera de null/1..60", True)


# ═══════════════════════════════════════════════════════════════════════════
# E. Regresion rapida de endpoints base + F. Seguridad spot-check
# ═══════════════════════════════════════════════════════════════════════════

class TestRegressionAndSecurity:
    def test_e1_services_and_summary_ok(self, auth_headers):
        r = session.get(f"{BASE}/services", timeout=10)
        assert r.status_code == 200 and len(r.json()) > 0
        log(f"GET /services -> 200 ({len(r.json())} servicios)", True)
        r = session.get(f"{BASE}/admin/summary", headers=auth_headers, params={"date": TARGET_DATE}, timeout=10)
        assert r.status_code == 200
        log(f"GET /admin/summary?date={TARGET_DATE} -> 200 ({len(r.json().get('appointments', []))} citas)", True)
        r = session.get(f"{BASE}/admin/upcoming", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        log("GET /admin/upcoming -> 200", True)

    def test_f1_admin_requires_jwt(self):
        for path in ("/admin/summary", "/admin/clients", "/admin/upcoming", "/admin/services"):
            r = session.get(f"{BASE}{path}", timeout=10)
            assert r.status_code == 401, f"{path} sin token deberia ser 401, obtuvimos {r.status_code}"
        r = session.patch(f"{BASE}/admin/appointments/1/status", json={"status": "cancelled"}, timeout=10)
        assert r.status_code == 401, f"PATCH admin sin token deberia ser 401: {r.status_code}"
        log("endpoints /admin/* sin Authorization -> 401", True)

    def test_f2_book_rate_limited(self):
        """POST /book con RATE_LIMIT_BOOK=5/min: la 6a llamada rapida -> 429."""
        # Ventana limpia: esperar a que caduquen llamadas previas
        if _book_calls:
            wait = 66 - (time.time() - _book_calls[0])
            if wait > 0:
                log(f"esperando {wait:.0f}s para limpiar la ventana de rate limit")
                time.sleep(wait + 1)
        codes = []
        for i in range(6):
            payload = {
                "customer_name": f"QA Interval Rate_test",
                "customer_phone": "+34999000003",
                "service_id": 32,
                "start_time": "2026-10-28T11:47:00Z",  # desalineado -> no crea datos
            }
            r = session.post(f"{BASE}/book", json=payload, timeout=10)
            codes.append(r.status_code)
        log(f"rAFa de 6 POST /book: {codes}", True)
        assert 429 in codes, f"esperado al menos un 429 (rate limit), codigos: {codes}"
        assert codes[0] != 429, f"la primera llamada no deberia estar limitada: {codes}"
        log("rate limit activo en POST /book (6a llamada -> 429)", True)
        _book_calls.append(time.time())

    def test_f3_db_constraints_present(self):
        """Integridad: EXCLUDE GIST + CHECKs de status/notification_status."""
        import psycopg2
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/barberapp")
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT conname, contype FROM pg_constraint WHERE conrelid='appointments'::regclass"
            )
            rows = dict(cur.fetchall())
            assert "no_overlapping_appointments" in rows, f"falta EXCLUDE: {rows}"
            assert rows.get("no_overlapping_appointments") == "x"
            assert "valid_status" in rows and rows.get("valid_status") == "c"
            assert "valid_notification_status" in rows and rows.get("valid_notification_status") == "c"
            log("constraints appointments: no_overlapping_appointments (EXCLUDE), valid_status, valid_notification_status", True)
        finally:
            conn.close()
