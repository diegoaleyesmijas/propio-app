"""
Tests for the appointment status state machine (ALLOWED_TRANSITIONS).

Covers:
  a) Valid transitions:    booked -> completed, booked -> cancelled
  b) Invalid transitions:  completed -> booked, completed -> cancelled,
                           cancelled -> booked, cancelled -> completed
  c) No-op:                booked -> booked
  d) Edge cases:           non-existent appointment, bad status value

Requires the backend to be running on localhost:8000.
Uses JWT auth (obtained via POST /admin/login).

Run:
  cd /home/nx-digital/barber-app
  /home/nx-digital/venv/bin/python -m pytest tests/test_state_machine.py -v --tb=short
"""

import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE = "http://localhost:8000"
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "test-admin-password-for-dev-only")
TEST_PREFIX = "TEST_SM"

session = requests.Session()

# ── Get JWT token once at module load ──
def _get_jwt():
    r = session.post(f"{BASE}/admin/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"JWT login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]

JWT_TOKEN = _get_jwt()
ADMIN_HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# Module-level counter for distributing bookings across dates to avoid slot exhaustion
_booking_counter = [0]


def _next_future_date():
    """Return progressively further-out dates to avoid slot exhaustion."""
    _booking_counter[0] += 1
    days = 3 + (_booking_counter[0] % 28)  # Spread across 3-30 days
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_free_slot(service_id=1, date_str=None):
    """Get first available slot for a service+date."""
    if date_str is None:
        date_str = _next_future_date()
    r = session.get(f"{BASE}/available-slots",
                    params={"service_id": service_id, "date": date_str})
    if r.status_code != 200 or not r.json().get("slots"):
        # Try another date
        date_str = _next_future_date()
        r = session.get(f"{BASE}/available-slots",
                        params={"service_id": service_id, "date": date_str})
    if r.status_code != 200:
        return None, date_str
    slots = r.json().get("slots", [])
    if not slots:
        return None, date_str
    return slots[0], date_str


def _create_booking(service_id=1, slot=None, name=None):
    """
    Create a test booking via admin endpoint (not rate-limited).
    Returns response dict with token_uuid, id, etc., or None on failure.
    """
    if name is None:
        name = f"{TEST_PREFIX}_{uuid.uuid4().hex[:8]}"
    if slot is None:
        slot, _ = _get_free_slot(service_id)
        if slot is None:
            return None
    r = session.post(f"{BASE}/admin/appointments", json={
        "service_id": service_id,
        "customer_name": name,
        "customer_phone": "+34999666100",
        "customer_email": f"{name.lower()}@test.sm",
        "start_time": slot,
    }, headers=ADMIN_HEADERS)
    if r.status_code != 200:
        return None
    return r.json()


def _patch_status(appointment_id, new_status):
    """PATCH appointment status. Returns (status_code, data)."""
    r = session.patch(
        f"{BASE}/admin/appointments/{appointment_id}/status",
        json={"status": new_status},
        headers=ADMIN_HEADERS,
    )
    try:
        data = r.json()
    except Exception:
        data = {}
    return r.status_code, data


def _cancel_via_manage(token):
    """DELETE /manage/{token}. Returns (status_code, data)."""
    r = session.delete(f"{BASE}/manage/{token}")
    try:
        data = r.json()
    except Exception:
        data = {}
    return r.status_code, data


# ═══════════════════════════════════════════════════════════════════════════════
# Tests: State Machine
# ═══════════════════════════════════════════════════════════════════════════════

class TestStateMachine:

    # ── a) Valid transitions ──────────────────────────────────────────────

    def test_valid_booked_to_completed(self):
        """booked -> completed via admin PATCH → 200"""
        data = _create_booking(name=f"{TEST_PREFIX}_v1_{uuid.uuid4().hex[:4]}")
        assert data is not None, "Could not create test booking (no free slots?)"
        sc, resp = _patch_status(data["id"], "completed")
        assert sc == 200, f"Expected 200, got {sc}: {resp}"
        assert resp.get("status") == "completed"

    def test_valid_booked_to_cancelled_admin(self):
        """booked -> cancelled via admin PATCH → 200"""
        data = _create_booking(name=f"{TEST_PREFIX}_v2_{uuid.uuid4().hex[:4]}")
        assert data is not None, "Could not create test booking"
        sc, resp = _patch_status(data["id"], "cancelled")
        assert sc == 200, f"Expected 200, got {sc}: {resp}"
        assert resp.get("status") == "cancelled"

    def test_valid_booked_to_cancelled_public(self):
        """booked -> cancelled via DELETE /manage → 200 (for future slots)"""
        slot, date_str = _get_free_slot(1, _next_future_date())
        assert slot is not None, "No free slot available"
        data = _create_booking(1, slot, name=f"{TEST_PREFIX}_v3_{uuid.uuid4().hex[:4]}")
        assert data is not None, "Could not create test booking"
        token = data["token_uuid"]

        sc, resp = _cancel_via_manage(token)
        assert sc == 200, f"Expected 200, got {sc}: {resp}"
        assert resp.get("detail") is not None

    # ── b) Invalid transitions ────────────────────────────────────────────

    def test_invalid_completed_to_booked(self):
        """completed -> booked → 400 (terminal)"""
        data = _create_booking(name=f"{TEST_PREFIX}_i1_{uuid.uuid4().hex[:4]}")
        assert data is not None
        # Mark as completed first
        sc, _ = _patch_status(data["id"], "completed")
        assert sc == 200
        # Try to revert to booked
        sc, resp = _patch_status(data["id"], "booked")
        assert sc == 400, f"Expected 400, got {sc}: {resp}"
        assert "terminal" in resp.get("detail", "").lower(), \
            f"Message should mention terminal: {resp.get('detail')}"

    def test_invalid_completed_to_cancelled(self):
        """completed -> cancelled → 400 (terminal)"""
        data = _create_booking(name=f"{TEST_PREFIX}_i2_{uuid.uuid4().hex[:4]}")
        assert data is not None
        sc, _ = _patch_status(data["id"], "completed")
        assert sc == 200
        sc, resp = _patch_status(data["id"], "cancelled")
        assert sc == 400, f"Expected 400, got {sc}: {resp}"
        assert "terminal" in resp.get("detail", "").lower()

    def test_invalid_cancelled_to_booked(self):
        """cancelled -> booked → 400 (terminal)"""
        data = _create_booking(name=f"{TEST_PREFIX}_i3_{uuid.uuid4().hex[:4]}")
        assert data is not None
        sc, _ = _patch_status(data["id"], "cancelled")
        assert sc == 200
        sc, resp = _patch_status(data["id"], "booked")
        assert sc == 400, f"Expected 400, got {sc}: {resp}"
        assert "terminal" in resp.get("detail", "").lower()

    def test_invalid_cancelled_to_completed(self):
        """cancelled -> completed → 400 (terminal)"""
        data = _create_booking(name=f"{TEST_PREFIX}_i4_{uuid.uuid4().hex[:4]}")
        assert data is not None
        sc, _ = _patch_status(data["id"], "cancelled")
        assert sc == 200
        sc, resp = _patch_status(data["id"], "completed")
        assert sc == 400, f"Expected 400, got {sc}: {resp}"
        assert "terminal" in resp.get("detail", "").lower()

    # ── c) No-op ──────────────────────────────────────────────────────────

    def test_noop_booked_to_booked(self):
        """booked -> booked → 400 (no-op, already booked)"""
        data = _create_booking(name=f"{TEST_PREFIX}_n1_{uuid.uuid4().hex[:4]}")
        assert data is not None
        sc, resp = _patch_status(data["id"], "booked")
        assert sc == 400, f"Expected 400, got {sc}: {resp}"
        # Should mention "already" in the detail message
        assert "already" in resp.get("detail", "").lower(), \
            f"Message should mention 'already': {resp.get('detail')}"

    # ── d) Edge cases ─────────────────────────────────────────────────────

    def test_invalid_nonexistent_appointment(self):
        """PATCH with non-existent appointment_id → 404"""
        sc, resp = _patch_status(999999, "cancelled")
        assert sc == 404, f"Expected 404, got {sc}: {resp}"

    def test_invalid_bad_status_value(self):
        """PATCH with invalid status string → 400"""
        data = _create_booking(name=f"{TEST_PREFIX}_e1_{uuid.uuid4().hex[:4]}")
        assert data is not None
        r = session.patch(
            f"{BASE}/admin/appointments/{data['id']}/status",
            json={"status": "invalid_status"},
            headers=ADMIN_HEADERS,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
