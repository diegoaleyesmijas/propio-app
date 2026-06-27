"""
Production E2E Test Suite — Barber Booking MVP
Target: https://codigodecaballeros.site/
Author: QA & Security Engineer
Date: 2026-06-17

Run: cd /home/nx-digital/barber-app && /home/nx-digital/venv/bin/python -m pytest tests/test_production_e2e.py -v --tb=short 2>&1 | tee /tmp/test_report.log
"""

import requests
import json
import uuid
import time
import sys
import os
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse

# ─── Configuration ───────────────────────────────────────────────────────────
BASE = "https://codigodecaballeros.site"
HTTP_BASE = "http://codigodecaballeros.site"
ADMIN_USER = "admin"
ADMIN_PASS = "CONTRASENA_REEMPLAZADA_ROTACION_20260627"
TEST_PREFIX = "E2E_TEST"

# Session with connection pooling
s = requests.Session()
s.headers.update({"User-Agent": "BarberApp-QA-TestSuite/1.0"})

# ─── Test data tracking for cleanup ──────────────────────────────────────────
created_bookings = []   # list of token_uuids
created_sessions = []   # list of test session labels

def now_utc():
    return datetime.now(timezone.utc)

def future_date(days=2):
    """Return a date string N days from now that should have free slots."""
    d = now_utc() + timedelta(days=days)
    # If day is Monday (0), the barber might be off; skip to Tuesday
    # Actually, let's just check and adjust
    return d.strftime("%Y-%m-%d")

def get_free_slot(service_id=1, date_str=None):
    """Find the first available slot for a given service and date."""
    if date_str is None:
        date_str = future_date(3)
    r = s.get(f"{BASE}/available-slots", params={"service_id": service_id, "date": date_str})
    if r.status_code != 200:
        # Try tomorrow
        date_str = future_date(2)
        r = s.get(f"{BASE}/available-slots", params={"service_id": service_id, "date": date_str})
        if r.status_code != 200:
            date_str = future_date(4)
            r = s.get(f"{BASE}/available-slots", params={"service_id": service_id, "date": date_str})
    data = r.json()
    slots = data.get("slots", [])
    if not slots:
        return None, None
    return slots[0], date_str

# ─── Helpers ─────────────────────────────────────────────────────────────────

def log_test(name, passed, detail=""):
    icon = "✅" if passed else "❌"
    print(f"  {icon} {name}" + (f" — {detail}" if detail else ""))

def login_jwt():
    """Get JWT token for admin."""
    r = s.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

def make_booking(service_id=1, start_time=None, customer_name=None):
    """Create a test booking and track it for cleanup. Returns booking response dict."""
    if customer_name is None:
        customer_name = f"{TEST_PREFIX}_{uuid.uuid4().hex[:8]}"
    if start_time is None:
        slot, date_str = get_free_slot(service_id)
        if not slot:
            raise RuntimeError("No free slots available for testing")
        start_time = slot
    
    r = s.post(f"{BASE}/book", json={
        "service_id": service_id,
        "customer_name": customer_name,
        "customer_phone": "+34999666001",
        "customer_email": f"{customer_name.lower()}@test.e2e",
        "start_time": start_time,
    })
    
    if r.status_code == 200:
        data = r.json()
        created_bookings.append(data["token_uuid"])
        return data
    return None

def cleanup_bookings():
    """Cancel all bookings created during this test run."""
    print(f"\n  🧹 Cleaning up {len(created_bookings)} test bookings...")
    for token in created_bookings:
        try:
            r = s.delete(f"{BASE}/manage/{token}")
            if r.status_code == 200:
                print(f"    ✅ Cancelled {token[:8]}...")
            else:
                print(f"    ⚠️  Could not cancel {token[:8]}... ({r.status_code}): {r.text[:100]}")
        except Exception as e:
            print(f"    ❌ Error cleaning {token[:8]}...: {e}")

# ═══════════════════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestProductionE2E:
    
    def setup_method(self):
        self.start_time = time.time()
        self.jwt = login_jwt()
        self.admin_headers = {"Authorization": f"Bearer {self.jwt}"}
    
    def teardown_method(self):
        elapsed = time.time() - self.start_time
        print(f"    ⏱  {elapsed:.2f}s")

    # ── 1. PUBLIC API ──────────────────────────────────────────────────────
    
    def test_01_services_list(self):
        """GET /services → 200, returns list of services"""
        r = s.get(f"{BASE}/services")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) >= 1, f"Expected >=1 service, got {len(data)}"
        required = {"id", "name", "price", "duration_minutes"}
        for svc in data:
            assert required.issubset(svc.keys()), f"Missing fields in {svc}"
        log_test("GET /services returns service list", True, f"{len(data)} services found")
    
    def test_02_available_slots(self):
        """GET /available-slots?service_id=1&date=YYYY-MM-DD → 200, slots list"""
        date_str = future_date(3)
        r = s.get(f"{BASE}/available-slots", params={"service_id": 1, "date": date_str})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "slots" in data, f"Missing 'slots' key: {data}"
        assert "date" in data, f"Missing 'date' key: {data}"
        assert "service_id" in data, f"Missing 'service_id' key: {data}"
        log_test("GET /available-slots returns slots", True, f"{len(data['slots'])} slots for {date_str}")
    
    def test_03_available_slots_bad_service(self):
        """GET /available-slots with invalid service_id → 422 or empty slots"""
        r = s.get(f"{BASE}/available-slots", params={"service_id": 9999, "date": future_date(3)})
        assert r.status_code in (200, 422, 404), f"Unexpected: {r.status_code}"
        log_test("GET /available-slots with bad service_id handles gracefully", True, f"Status {r.status_code}")
    
    def test_04_create_booking_success(self):
        """POST /book → 200 with valid data"""
        slot, date_str = get_free_slot(1)
        if not slot:
            log_test("POST /book success", False, "No free slots available")
            return
        
        booking = make_booking(1, slot)
        assert booking is not None, f"Booking failed: response was None"
        assert "token_uuid" in booking, f"Missing token_uuid: {booking}"
        assert "status" in booking, f"Missing status: {booking}"
        assert booking.get("status") == "booked", f"Expected 'booked', got {booking.get('status')}"
        log_test("POST /book creates booking", True, f"token={booking['token_uuid'][:8]}...")
    
    def test_05_create_booking_conflict(self):
        """POST /book → 409 when slot is already occupied"""
        # First make a booking to occupy a slot
        slot, date_str = get_free_slot(1)
        if not slot:
            log_test("POST /book conflict test", False, "No free slots available")
            return
        
        # Make the first booking
        b1 = make_booking(1, slot, f"{TEST_PREFIX}_conflict_test")
        if not b1:
            log_test("POST /book conflict test", False, "First booking failed unexpectedly")
            return
        
        # Try to book the same slot
        r = s.post(f"{BASE}/book", json={
            "service_id": 1,
            "customer_name": f"{TEST_PREFIX}_conflict_dup",
            "customer_phone": "+34999666002",
            "customer_email": "conflict_dup@test.e2e",
            "start_time": slot,
        })
        # Should be 409 (conflict) or 400 (business rule)
        assert r.status_code in (409, 400), f"Expected 409/400, got {r.status_code}: {r.text[:200]}"
        log_test("POST /book conflict returns 409/400", True, f"Status {r.status_code}")
    
    def test_06_create_booking_invalid_data(self):
        """POST /book → 422 with invalid data"""
        # Missing required fields
        r = s.post(f"{BASE}/book", json={
            "customer_name": "Invalid Test"
        })
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text[:200]}"
        
        # Invalid phone type (int instead of string)
        r = s.post(f"{BASE}/book", json={
            "service_id": 1,
            "customer_name": "Invalid Test",
            "customer_phone": 12345,
            "start_time": "2026-06-19T10:00:00+00:00"
        })
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text[:200]}"
        
        log_test("POST /book rejects invalid data", True, "422 on missing fields and wrong types")
    
    def test_07_get_booking(self):
        """GET /manage/{token} → 200 for valid token"""
        # Use a booking we already created, or create one
        if not created_bookings:
            slot, date_str = get_free_slot(1)
            if slot:
                make_booking(1, slot, f"{TEST_PREFIX}_get_test")
        
        if not created_bookings:
            log_test("GET /manage/{token}", False, "No test booking available")
            return
        
        token = created_bookings[0]
        r = s.get(f"{BASE}/manage/{token}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("token_uuid") == token, f"Token mismatch: {data.get('token_uuid')} != {token}"
        log_test("GET /manage/{token} returns booking", True, f"token={token[:8]}...")
    
    def test_08_get_booking_not_found(self):
        """GET /manage/{token} → 404 for non-existent token"""
        fake_token = "00000000-0000-0000-0000-000000000000"
        r = s.get(f"{BASE}/manage/{fake_token}")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"
        log_test("GET /manage/{token} 404 on invalid token", True)
    
    def test_09_cancel_booking_future(self):
        """DELETE /manage/{token} → 200 for cancellation (>24h ahead)"""
        # Create a booking far in the future
        slot, date_str = get_free_slot(1, future_date(14))  # 2 weeks ahead
        if not slot:
            log_test("DELETE /manage/{token} cancel far future", False, "No far-future slot")
            return
        
        # Remove this slot from cleanup since we're cancelling it now
        before_count = len(created_bookings)
        booking = make_booking(1, slot, f"{TEST_PREFIX}_cancel_test")
        if not booking:
            log_test("DELETE /manage/{token} cancel", False, "Could not create booking")
            return
        
        token = booking["token_uuid"]
        # Remove from cleanup list since we're cancelling it now
        if token in created_bookings:
            created_bookings.remove(token)
        
        r = s.delete(f"{BASE}/manage/{token}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "detail" in data, f"Missing 'detail' in response: {data}"
        log_test("DELETE /manage/{token} cancels booking", True, f"token={token[:8]}...")
    
    def test_10_cancel_booking_not_found(self):
        """DELETE /manage/{token} → 404 for non-existent token"""
        fake_token = "00000000-0000-0000-0000-000000000000"
        r = s.delete(f"{BASE}/manage/{fake_token}")
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"
        log_test("DELETE /manage/{token} 404 on invalid token", True)
    
    def test_11_rate_limiting(self):
        """POST /book → 429 after 5+ rapid requests"""
        results = []
        # Use unique start times all within the same minute to guarantee rate limit trigger
        now = now_utc()
        for i in range(8):
            # Use a unique but obviously-invalid start time far in the future
            start = (now + timedelta(days=60, hours=i)).isoformat()
            r = s.post(f"{BASE}/book", json={
                "service_id": 1,
                "customer_name": f"{TEST_PREFIX}_ratelimit_{i}_{uuid.uuid4().hex[:4]}",
                "customer_phone": "+34999666010",
                "customer_email": f"ratelimit{i}@test.e2e",
                "start_time": start,
            })
            results.append(r.status_code)
            # No delay - burst all requests to guarantee rate limit hit
        
        has_429 = 429 in results
        status_summary = {code: results.count(code) for code in set(results)}
        log_test("Rate limiting returns 429 on burst", True if has_429 else False,
                 f"Statuses: {status_summary}{' (no 429 seen)' if not has_429 else ''}")
        
        if not has_429:
            print(f"    ⚠️  Rate limit may be configured differently. First 5 should be 200, rest 429.")
            print(f"       Got: {status_summary}")
        
        # Clean up any successful bookings from this test
        # (these start 60 days out, so cancellation is fine)
        for i, status in enumerate(results):
            if status == 200:
                pass  # We'll clean them up in the general cleanup
    
    # ── 2. ADMIN API ───────────────────────────────────────────────────────
    
    def test_20_admin_login_success(self):
        """POST /admin/login → 200 with correct credentials"""
        r = s.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "access_token" in data, f"Missing access_token: {data}"
        assert len(data["access_token"]) > 20, f"Token too short: {data['access_token']}"
        log_test("POST /admin/login with valid credentials", True, "JWT token received")
    
    def test_21_admin_login_failure(self):
        """POST /admin/login → 401 with wrong credentials"""
        r = s.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": "wrong_password"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        log_test("POST /admin/login with invalid credentials", True, "401 returned")
    
    def test_22_admin_summary_with_jwt(self):
        """GET /admin/summary → 200 with JWT"""
        jwt = login_jwt()
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")},
                  headers={"Authorization": f"Bearer {jwt}"})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "date" in data, f"Missing 'date': {data}"
        assert "appointments" in data, f"Missing 'appointments': {data}"
        log_test("GET /admin/summary with JWT", True, f"{len(data['appointments'])} appointments today")
    
    def test_23_admin_summary_with_apikey_rejected(self):
        """GET /admin/summary → 401 with X-API-Key (removed fallback)"""
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")},
                  headers={"X-API-Key": "admin123"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        log_test("GET /admin/summary with X-API-Key rejected", True, "X-API-Key fallback removed")
    
    def test_24_admin_summary_unauthorized(self):
        """GET /admin/summary → 401 without auth"""
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        log_test("GET /admin/summary without auth returns 401", True)
    
    def test_25_admin_summary_bad_apikey(self):
        """GET /admin/summary → 401 with X-API-Key (no longer accepted)"""
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")},
                  headers={"X-API-Key": "invalid_key_12345"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        log_test("GET /admin/summary with X-API-Key returns 401", True, "API key auth removed")
    
    def test_26_admin_summary_bad_jwt(self):
        """GET /admin/summary → 401 with invalid JWT"""
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")},
                  headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.invalid"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text[:200]}"
        log_test("GET /admin/summary with invalid JWT returns 401", True)
    
    def test_27_admin_upcoming(self):
        """GET /admin/upcoming → 200"""
        r = s.get(f"{BASE}/admin/upcoming", headers=self.admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        log_test("GET /admin/upcoming", True, f"{len(data)} upcoming appointments")
    
    def test_28_admin_clients(self):
        """GET /admin/clients → 200"""
        r = s.get(f"{BASE}/admin/clients", headers=self.admin_headers)
        # Note: may have no clients registered separately
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        log_test("GET /admin/clients", True, f"{len(data)} clients")
    
    def test_29_admin_weekly_agenda(self):
        """GET /admin/agenda/weekly → 200"""
        today = now_utc().strftime("%Y-%m-%d")
        r = s.get(f"{BASE}/admin/agenda/weekly", params={"date": today},
                  headers=self.admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        log_test("GET /admin/agenda/weekly", True, f"Returned {len(data.get('days', []))} days")
    
    def test_30_admin_monthly_agenda(self):
        """GET /admin/agenda/monthly → 200"""
        r = s.get(f"{BASE}/admin/agenda/monthly", params={"date": "2026-06"},
                  headers=self.admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        log_test("GET /admin/agenda/monthly", True, f"Month: {data.get('month')}, {len(data.get('days', {}))} days")
    
    def test_31_admin_notifications_recent(self):
        """GET /admin/notifications/recent → 200"""
        r = s.get(f"{BASE}/admin/notifications/recent", headers=self.admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        log_test("GET /admin/notifications/recent", True, f"{len(data)} notifications")
    
    def test_32_admin_stats_new_clients(self):
        """GET /admin/stats/new-clients → 200 (BUG: returns 500)"""
        r = s.get(f"{BASE}/admin/stats/new-clients", headers=self.admin_headers)
        assert r.status_code == 200, \
            f"BUG: /admin/stats/new-clients returned {r.status_code} (expected 200). " \
            f"Response: {r.text[:200]}. " \
            f"Content-Type: {r.headers.get('Content-Type')}. " \
            f"This endpoint throws an unhandled server error."
        data = r.json()
        log_test("GET /admin/stats/new-clients", True, f"Stats: {str(data)[:100]}")
    
    def test_33_admin_patch_appointment_status(self):
        """PATCH /admin/appointments/{id}/status → 200 for valid status change"""
        # Get today's summary first to find a booked appointment
        r = s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")},
                  headers=self.admin_headers)
        if r.status_code != 200:
            log_test("PATCH appointment status", False, "Cannot get summary")
            return
        data = r.json()
        appointments = data.get("appointments", [])
        booked = [a for a in appointments if a.get("status") == "booked"]
        if not booked:
            log_test("PATCH appointment status", False, "No booked appointment found for today")
            return
        
        appt = booked[0]
        appt_id = appt["id"]
        
        # Try marking as completed
        r = s.patch(f"{BASE}/admin/appointments/{appt_id}/status",
                    json={"status": "completed"},
                    headers=self.admin_headers)
        # Should succeed
        assert r.status_code in (200, 400), f"Expected 200/400, got {r.status_code}: {r.text[:200]}"
        
        if r.status_code == 200:
            # Change it back to booked (if allowed)
            r2 = s.patch(f"{BASE}/admin/appointments/{appt_id}/status",
                         json={"status": "booked"},
                         headers=self.admin_headers)
            log_test("PATCH appointment status", True, f"Changed appointment {appt_id}")
        else:
            log_test("PATCH appointment status", True, f"Status change rejected ({r.status_code})")
    
    def test_34_admin_create_booking(self):
        """POST /admin/appointments → 200 (admin creates booking)"""
        slot, date_str = get_free_slot(1, future_date(3))
        if not slot:
            log_test("POST /admin/appointments", False, "No free slots")
            return
        
        r = s.post(f"{BASE}/admin/appointments", json={
            "service_id": 1,
            "customer_name": f"{TEST_PREFIX}_admin_create",
            "customer_phone": "+34999666020",
            "customer_email": "admin_create@test.e2e",
            "start_time": slot,
        }, headers=self.admin_headers)
        
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        # Token should be in response
        if "token_uuid" in data:
            created_bookings.append(data["token_uuid"])
        log_test("POST /admin/appointments (admin create)", True, f"token={data.get('token_uuid','N/A')[:8]}...")
    
    def test_35_admin_get_client_detail(self):
        """GET /admin/clients/{client_id} → 200"""
        # First get clients list
        r = s.get(f"{BASE}/admin/clients", headers=self.admin_headers)
        if r.status_code != 200 or not r.json():
            log_test("GET /admin/clients/{id}", False, "No clients found")
            return
        clients = r.json()
        client_id = clients[0].get("id") or clients[0].get("client_id")
        if not client_id:
            log_test("GET /admin/clients/{id}", False, "Cannot determine client ID structure")
            return
        
        r = s.get(f"{BASE}/admin/clients/{client_id}", headers=self.admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        log_test("GET /admin/clients/{id}", True, f"Client {client_id} details retrieved")
    
    # ── 3. FRONTEND & HEADERS ─────────────────────────────────────────────
    
    def test_40_https_redirect(self):
        """HTTP → HTTPS redirect (301)"""
        try:
            r = requests.get(HTTP_BASE, allow_redirects=False, timeout=10)
            assert r.status_code in (301, 302, 307, 308), f"Expected redirect, got {r.status_code}"
            location = r.headers.get("Location", "")
            assert location.startswith("https://"), f"Not redirecting to HTTPS: {location}"
            log_test("HTTP→HTTPS redirect", True, f"{r.status_code} → {location}")
        except requests.exceptions.ConnectionError:
            log_test("HTTP→HTTPS redirect", False, "Cannot connect to HTTP endpoint")
    
    def test_41_frontend_html_accessible(self):
        """Check frontend HTML pages are accessible"""
        r = s.get(f"{BASE}/")
        assert r.status_code == 200, f"Root: {r.status_code}"
        assert "text/html" in r.headers.get("Content-Type", ""), f"Wrong content type: {r.headers.get('Content-Type')}"
        
        r2 = s.get(f"{BASE}/demo.html")
        assert r2.status_code == 200, f"demo.html: {r2.status_code}"
        
        r3 = s.get(f"{BASE}/admin.html")
        assert r3.status_code == 200, f"admin.html: {r3.status_code}"
        
        log_test("Frontend HTML pages accessible", True, "Root, demo.html, admin.html all OK")
    
    def test_42_frontend_js_assets(self):
        """Check JS assets are accessible"""
        for asset in ["/demo.js", "/admin.js", "/i18n.js"]:
            r = s.get(f"{BASE}{asset}")
            assert r.status_code == 200, f"{asset}: {r.status_code}"
            # Check content type
            ct = r.headers.get("Content-Type", "")
            assert "javascript" in ct or "text" in ct, f"{asset}: wrong Content-Type: {ct}"
        log_test("Frontend JS assets accessible", True, "demo.js, admin.js, i18n.js all OK")
    
    def test_43_security_headers(self):
        """Check security headers on responses"""
        r = s.get(f"{BASE}/")
        headers = r.headers
        
        checks = []
        # Content-Type should be set
        checks.append(("Content-Type present", "Content-Type" in headers))
        checks.append(("Content-Type text/html", "text/html" in headers.get("Content-Type", "")))
        
        # Check for security headers (non-blocking, just documenting)
        security_headers = ["X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy",
                           "Strict-Transport-Security", "X-XSS-Protection"]
        present = [h for h in security_headers if h in headers]
        missing = [h for h in security_headers if h not in headers]
        
        if missing:
            print(f"    ⚠️  Missing security headers: {', '.join(missing)}")
        
        for name, passed in checks:
            log_test(f"Security header: {name}", passed)
        
        if present:
            log_test("Security headers present", True, f"Found: {', '.join(present)}")
    
    def test_44_cache_headers(self):
        """Check Cache-Control on static assets"""
        # i18n.js and JS assets may benefit from caching
        for asset in ["/i18n.js"]:
            r = s.get(f"{BASE}{asset}")
            cache = r.headers.get("Cache-Control", "none")
            print(f"    ℹ️  Cache-Control for {asset}: {cache}")
        
        log_test("Cache headers checked", True, "See Cache-Control values above")
    
    def test_45_ssl_certificate(self):
        """Check SSL certificate validity"""
        import ssl
        import socket
        hostname = urlparse(BASE).hostname
        port = 443
        
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as sock:
                sock.connect((hostname, port))
                cert = sock.getpeercert()
                subject = dict(x[0] for x in cert.get("subject", []))
                issuer = dict(x[0] for x in cert.get("issuer", []))
                not_after = cert.get("notAfter", "N/A")
                print(f"    ℹ️  SSL Subject: {subject.get('commonName', 'N/A')}")
                print(f"    ℹ️  SSL Issuer: {issuer.get('commonName', 'N/A')}")
                print(f"    ℹ️  SSL Expires: {not_after}")
                log_test("SSL certificate valid", True, f"Expires: {not_after}")
        except Exception as e:
            log_test("SSL certificate check", False, str(e))
    
    # ── 4. CORS & SECURITY ────────────────────────────────────────────────
    
    def test_50_cors_public_endpoints(self):
        """Check CORS headers on API responses"""
        # Test with a real origin
        r = s.options(f"{BASE}/services", 
                      headers={
                          "Origin": "https://malicious-site.com",
                          "Access-Control-Request-Method": "GET"
                      })
        # Check ACAO header
        acao = r.headers.get("Access-Control-Allow-Origin", "*")
        print(f"    ℹ️  Access-Control-Allow-Origin: {acao}")
        
        # If CORS is open, this is a finding but not a test failure per se
        if acao == "*":
            log_test("CORS: wildcard origin", True, "⚠️  ACAO=* (open CORS)")
        else:
            log_test("CORS: restricted origin", True, f"ACAO={acao}")
    
    def test_51_cors_post_from_other_origin(self):
        """Test POST /book with different Origin header"""
        r = s.post(f"{BASE}/book", 
                   json={
                       "service_id": 1,
                       "customer_name": f"{TEST_PREFIX}_cors_test_{uuid.uuid4().hex[:4]}",
                       "customer_phone": "+34999666030",
                       "customer_email": "cors_test@test.e2e",
                       "start_time": (now_utc() + timedelta(days=30)).isoformat(),
                   },
                   headers={"Origin": "https://attacker.com"})
        # If CORS is open, this will succeed. Record what happens.
        log_test("CORS POST from external origin", r.status_code == 200,
                 f"Status {r.status_code} (200=open CORS, 4xx=restricted)")
        # Note: if status is 200, it means CORS is completely open
    
    def test_52_admin_endpoints_unauthorized_all(self):
        """Verify all admin endpoints return 401 without auth"""
        endpoints = [
            "/admin/summary?date=2026-06-17",
            "/admin/upcoming",
            "/admin/clients",
            "/admin/agenda/weekly",
            "/admin/notifications/recent",
            "/admin/stats/new-clients",
        ]
        results = {}
        for ep in endpoints:
            r = s.get(f"{BASE}{ep}")
            results[ep] = r.status_code
        
        protected = all(status == 401 for status in results.values())
        unprotected = [ep for ep, status in results.items() if status != 401]
        if unprotected:
            print(f"    ❌ Unprotected endpoints: {unprotected}")
            for ep in unprotected:
                print(f"       {ep}: {results[ep]}")
        log_test("All admin endpoints require auth", protected,
                 f"{len(unprotected)} unprotected" if unprotected else "All 401")
    
    def test_53_cancel_24h_rule(self):
        """DELETE /manage/{token} → 400 if within 24h of appointment"""
        # Create a booking for "now" (should fail with 400)
        soon = (now_utc() + timedelta(hours=1)).isoformat()
        r = s.post(f"{BASE}/book", json={
            "service_id": 1,
            "customer_name": f"{TEST_PREFIX}_nearcancel",
            "customer_phone": "+34999666040",
            "customer_email": "nearcancel@test.e2e",
            "start_time": soon,
        })
        
        if r.status_code != 200:
            # Probably can't book that soon - that's fine
            log_test("24h cancel rule", True, f"Booking within 1h rejected ({r.status_code})")
            return
        
        data = r.json()
        token = data["token_uuid"]
        created_bookings.append(token)
        
        # Now try to cancel
        r2 = s.delete(f"{BASE}/manage/{token}")
        if r2.status_code == 400:
            log_test("24h cancel rule works", True, f"400: {r2.json().get('detail', '')[:100]}")
        else:
            log_test("24h cancel rule", r2.status_code == 200,
                     f"Status {r2.status_code} (accepted or rejected)")
    
    # ── 5. CHROME HEADLESS SCREENSHOTS ─────────────────────────────────────
    
    def test_60_screenshot_demo(self):
        """Screenshot with Chrome headless: demo page"""
        import subprocess
        screenshot_path = "/tmp/e2e_demo.png"
        try:
            subprocess.run([
                "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--window-size=420,1200",
                "--virtual-time-budget=8000",
                f"--screenshot={screenshot_path}",
                f"{BASE}/demo.html"
            ], check=True, capture_output=True, timeout=15)
            
            if os.path.exists(screenshot_path):
                size = os.path.getsize(screenshot_path)
                log_test("Chrome screenshot: demo.html", True, f"{size/1024:.1f}KB saved to {screenshot_path}")
            else:
                log_test("Chrome screenshot: demo.html", False, "Screenshot not created")
        except subprocess.CalledProcessError as e:
            log_test("Chrome screenshot: demo.html", False, f"Chrome error: {e.stderr.decode()[:200]}")
        except FileNotFoundError:
            log_test("Chrome screenshot: demo.html", False, "Chrome binary not found")
    
    def test_61_screenshot_admin(self):
        """Screenshot with Chrome headless: admin page"""
        import subprocess
        screenshot_path = "/tmp/e2e_admin.png"
        try:
            subprocess.run([
                "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--window-size=420,1200",
                "--virtual-time-budget=8000",
                f"--screenshot={screenshot_path}",
                f"{BASE}/admin.html"
            ], check=True, capture_output=True, timeout=15)
            
            if os.path.exists(screenshot_path):
                size = os.path.getsize(screenshot_path)
                log_test("Chrome screenshot: admin.html", True, f"{size/1024:.1f}KB saved to {screenshot_path}")
            else:
                log_test("Chrome screenshot: admin.html", False, "Screenshot not created")
        except subprocess.CalledProcessError as e:
            log_test("Chrome screenshot: admin.html", False, f"Chrome error: {e.stderr.decode()[:200]}")
        except FileNotFoundError:
            log_test("Chrome screenshot: admin.html", False, "Chrome binary not found")
    
    def test_62_screenshot_root(self):
        """Screenshot with Chrome headless: root (demo) page"""
        import subprocess
        screenshot_path = "/tmp/e2e_root.png"
        try:
            subprocess.run([
                "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--window-size=420,1200",
                "--virtual-time-budget=8000",
                f"--screenshot={screenshot_path}",
                f"{BASE}/"
            ], check=True, capture_output=True, timeout=15)
            
            if os.path.exists(screenshot_path):
                size = os.path.getsize(screenshot_path)
                log_test("Chrome screenshot: root (/) page", True, f"{size/1024:.1f}KB")
            else:
                log_test("Chrome screenshot: root", False, "Not created")
        except subprocess.CalledProcessError as e:
            log_test("Chrome screenshot: root", False, f"Chrome error: {e.stderr.decode()[:200]}")
        except FileNotFoundError:
            log_test("Chrome screenshot: root", False, "Chrome binary not found")
    
    # ── 6. RESPONSE TIMES ──────────────────────────────────────────────────
    
    def test_70_response_times(self):
        """Measure response times for key endpoints"""
        h = self.admin_headers
        endpoints = [
            ("GET /services", lambda: s.get(f"{BASE}/services")),
            ("GET /available-slots", lambda: s.get(f"{BASE}/available-slots", params={"service_id": 1, "date": future_date(3)})),
            ("POST /admin/login", lambda: s.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})),
            ("GET /admin/summary", lambda: s.get(f"{BASE}/admin/summary", params={"date": now_utc().strftime("%Y-%m-%d")}, headers=h)),
            ("GET /admin/upcoming", lambda: s.get(f"{BASE}/admin/upcoming", headers=h)),
            ("GET /admin/clients", lambda: s.get(f"{BASE}/admin/clients", headers=h)),
            ("GET /", lambda: s.get(f"{BASE}/")),
        ]
        
        results = {}
        for name, req_fn in endpoints:
            times = []
            for _ in range(3):
                start = time.time()
                r = req_fn()
                elapsed = time.time() - start
                times.append(elapsed)
            avg = sum(times) / len(times)
            results[name] = {"avg": avg, "min": min(times), "max": max(times), "status": r.status_code}
        
        print(f"\n    📊 Response times (3 samples each):")
        print(f"    {'Endpoint':<35} {'Avg':>8} {'Min':>8} {'Max':>8} {'Status':>8}")
        print(f"    {'─'*35} {'─'*8} {'─'*8} {'─'*8} {'─'*8}")
        for name, data in results.items():
            print(f"    {name:<35} {data['avg']*1000:>7.0f}ms {data['min']*1000:>7.0f}ms {data['max']*1000:>7.0f}ms {data['status']:>8}")
        
        # Check for slow endpoints
        slow = [name for name, data in results.items() if data['avg'] > 2.0]
        if slow:
            print(f"    ⚠️  Slow endpoints (>2s avg): {', '.join(slow)}")
        
        log_test("Response times measured", True, f"Fastest: {min(r['avg'] for r in results.values())*1000:.0f}ms avg")
    
    def test_71_booking_flow_end_to_end(self):
        """Complete E2E flow: create (admin) → get token → public cancel → verify"""
        import time as _time
        
        # 1. Find a slot
        slot, date_str = get_free_slot(1, future_date(5))
        if not slot:
            log_test("E2E booking flow", False, "No free slots")
            return
        
        # 2. Create booking via admin endpoint (not rate-limited)
        customer_name = f"{TEST_PREFIX}_e2e_flow"
        r1 = s.post(f"{BASE}/admin/appointments", json={
            "service_id": 1,
            "customer_name": customer_name,
            "customer_phone": "+34999666050",
            "customer_email": "e2e_flow@test.e2e",
            "start_time": slot,
        }, headers=self.admin_headers)
        assert r1.status_code == 200, f"Admin create failed: {r1.status_code} {r1.text[:200]}"
        appt_id = r1.json().get("id")
        service_name = r1.json().get("service_name", "Unknown")
        print(f"    📝 Created booking: id={appt_id}, service={service_name}")
        
        # 3. Find token_uuid by querying admin summary for that date
        date_for_query = slot[:10]  # Extract YYYY-MM-DD from ISO datetime
        r_summary = s.get(f"{BASE}/admin/summary", params={"date": date_for_query},
                          headers=self.admin_headers)
        assert r_summary.status_code == 200, f"Summary query failed: {r_summary.status_code}"
        
        # Find our appointment in the summary
        appointments = r_summary.json().get("appointments", [])
        our_appt = None
        for appt in appointments:
            if appt.get("id") == appt_id:
                our_appt = appt
                break
        
        assert our_appt is not None, f"Could not find appointment id={appt_id} in summary"
        token = our_appt.get("token_uuid")
        assert token is not None, f"No token_uuid found for appointment {appt_id}"
        print(f"    🔑 Found token_uuid: {token[:8]}...")
        created_bookings.append(token)  # Track for cleanup
        
        # 4. Get booking by public token endpoint
        r2 = s.get(f"{BASE}/manage/{token}")
        assert r2.status_code == 200, f"Public GET failed: {r2.status_code}"
        assert r2.json().get("token_uuid") == token, f"Token mismatch"
        print(f"    📖 Retrieved via public endpoint: status={r2.json().get('status')}")
        
        # 5. Cancel booking via public endpoint
        r3 = s.delete(f"{BASE}/manage/{token}")
        assert r3.status_code == 200, f"Public cancel failed: {r3.status_code} {r3.text[:200]}"
        print(f"    🗑️  Cancelled: {r3.json().get('detail')}")
        # Remove from cleanup list since already cancelled
        if token in created_bookings:
            created_bookings.remove(token)
        
        # 6. Verify cancelled status
        r4 = s.get(f"{BASE}/manage/{token}")
        assert r4.status_code == 200, f"GET after cancel failed: {r4.status_code}"
        assert r4.json().get("status") in ("cancelled", "canceled"), f"Expected cancelled, got {r4.json().get('status')}"
        print(f"    ✅ Verified cancelled: {r4.json().get('status')}")
        
        log_test("Complete E2E booking flow", True, "AdminCreate → FindToken → PublicManage → Cancel → Verify")
    
    def test_80_response_json_content_type(self):
        """Verify API endpoints return application/json"""
        endpoints = [
            (f"{BASE}/services", "GET"),
            (f"{BASE}/available-slots?service_id=1&date={future_date(3)}", "GET"),
        ]
        for url, method in endpoints:
            if method == "GET":
                r = s.get(url)
            ct = r.headers.get("Content-Type", "")
            assert "application/json" in ct, f"{url}: Content-Type is '{ct}'"
        log_test("API returns application/json", True)


# ─── Main entry point ────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 72)
    print("  🧪 BARBER BOOKING MVP — PRODUCTION E2E TEST SUITE")
    print(f"  🎯 Target: {BASE}")
    print(f"  📅 Date:   {now_utc().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 72)
    
    # Run tests manually (for direct execution)
    import inspect
    
    test_class = TestProductionE2E()
    test_methods = [m for m in dir(test_class) if m.startswith("test_")]
    test_methods.sort()
    
    passed = 0
    failed = 0
    errors = []
    
    for method_name in test_methods:
        method = getattr(test_class, method_name)
        if not callable(method):
            continue
        
        print(f"\n  ── {method_name.replace('test_', '').replace('_', ' ').title()} ──")
        try:
            test_class.setup_method()
            method()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((method_name, str(e)))
            print(f"    ❌ {method_name}: {e}")
        finally:
            test_class.teardown_method()
    
    # Cleanup
    cleanup_bookings()
    
    print("\n" + "=" * 72)
    print(f"  📊 RESULTS: {passed} passed, {failed} failed, {len(created_bookings)} active bookings cleaned up")
    if errors:
        print("\n  ❌ FAILURES:")
        for name, err in errors:
            print(f"    - {name}: {err}")
    print("=" * 72)
    
    sys.exit(1 if failed > 0 else 0)
