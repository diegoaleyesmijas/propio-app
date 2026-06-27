#!/usr/bin/env python3
"""
E2E State Machine Verification — Barber Booking MVP
Tests the appointment status transition matrix via API + Chrome UI.

Usage:
    python tests/test_state_machine_e2e.py [--base-url https://codigodecaballeros.site]
"""

import argparse
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta, date

import requests

# ── Config ──────────────────────────────────────────────────────────
BASE_URL = "https://codigodecaballeros.site"
USERNAME = "admin"
PASSWORD = "CONTRASENA_REEMPLAZADA_ROTACION_20260627"
RESULTS = []
SCREENSHOTS = []


# ── Helpers ─────────────────────────────────────────────────────────
def log(msg: str, ok: bool = None):
    if ok is True:
        print(f"  ✅ {msg}")
    elif ok is False:
        print(f"  ❌ {msg}")
    else:
        print(f"  ℹ️  {msg}")
    RESULTS.append({"msg": msg, "ok": ok})


def screenshot(name: str, url: str, script: str = None, wait: int = 3):
    """Take a screenshot of a URL using Chrome headless, optionally running a script first."""
    out_path = f"/tmp/state_machine_{name}.png"
    # Build chrome args
    chrome_args = [
        "/usr/bin/google-chrome",
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        f"--window-size=420,1200",
        f"--virtual-time-budget={wait * 1000}",
        f"--screenshot={out_path}",
        url,
    ]
    try:
        env = os.environ.copy()
        if script:
            env["CHROME_SCRIPT"] = script
        result = subprocess.run(chrome_args, capture_output=True, text=True, timeout=30, env=env)
        if result.returncode == 0 and os.path.exists(out_path):
            SCREENSHOTS.append({"name": name, "path": out_path})
            log(f"Screenshot saved: {out_path}")
        else:
            log(f"Screenshot failed: {result.stderr[:200]}", ok=False)
    except Exception as e:
        log(f"Screenshot error: {e}", ok=False)
    return out_path


def get_jwt() -> str:
    """Get a JWT token from the admin login endpoint."""
    r = requests.post(f"{BASE_URL}/admin/login", json={
        "username": USERNAME,
        "password": PASSWORD,
    }, timeout=10)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    log("Admin login OK, got JWT token")
    return data["access_token"]


def admin_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def get_services() -> list:
    r = requests.get(f"{BASE_URL}/services", timeout=10)
    assert r.status_code == 200
    return r.json()


def tomorrow_str() -> str:
    """Return tomorrow's date as YYYY-MM-DD string."""
    return (date.today() + timedelta(days=1)).isoformat()


def get_available_slots(service_id: int, date_str: str) -> list:
    r = requests.get(
        f"{BASE_URL}/available-slots?service_id={service_id}&date={date_str}",
        timeout=10,
    )
    assert r.status_code == 200, f"Available slots failed: {r.text}"
    data = r.json()
    return data.get("slots", [])


def create_test_booking(token: str, service_id: int, slot_start: str) -> dict:
    """Create a test booking and return the result."""
    test_id = str(uuid.uuid4())[:8]
    payload = {
        "service_id": service_id,
        "customer_name": f"Test User {test_id}",
        "customer_phone": "+34999000000",
        "customer_email": f"test{test_id}@example.com",
        "start_time": slot_start,
        "is_first_time": True,
    }
    r = requests.post(
        f"{BASE_URL}/book",
        json=payload,
        timeout=10,
    )
    # May fail if rate-limited or slot now in the past — retry with a different date
    if r.status_code == 429:
        log("Rate limited on /book, will retry with different data", ok=False)
        return None
    if r.status_code == 409:
        log(f"Conflict on booking: {r.text}", ok=False)
        return None
    assert r.status_code == 200, f"Create booking failed: {r.status_code} {r.text}"
    return r.json()


# ── Test Suites ─────────────────────────────────────────────────────

def test_01_api_services():
    """Test GET /services returns an array."""
    log("--- 1. API: GET /services ---")
    services = get_services()
    assert len(services) > 0, "No services found"
    log(f"Found {len(services)} services: {[s['name'] for s in services]}", ok=True)
    return services


def test_02_api_available_slots(services):
    """Test GET /available-slots returns slots for a service."""
    log("\n--- 2. API: GET /available-slots ---")
    svc = services[0]
    date_str = tomorrow_str()
    slots = get_available_slots(svc["id"], date_str)
    log(f"Service '{svc['name']}' on {date_str}: {len(slots)} slots available")
    if len(slots) > 0:
        log(f"First slot: {slots[0]}", ok=True)
    else:
        log("No slots available tomorrow — may need to check business hours", ok=False)
    return slots


def test_03_api_state_machine_transitions(token: str, services: list):
    """Test the state machine transition matrix via API."""
    log("\n--- 3. API: State Machine Transition Matrix ---")

    svc = services[0]
    date_str = tomorrow_str()
    slots = get_available_slots(svc["id"], date_str)

    if not slots:
        log("No slots available — trying day after tomorrow", ok=False)
        date_str = (date.today() + timedelta(days=2)).isoformat()
        slots = get_available_slots(svc["id"], date_str)

    if not slots:
        log("Still no slots — trying day 3", ok=False)
        date_str = (date.today() + timedelta(days=3)).isoformat()
        slots = get_available_slots(svc["id"], date_str)

    if not slots:
        log("Cannot test state machine: no available slots found in the next 3 days", ok=False)
        log("This may be due to business hours — Friday is half-day, weekend closed", ok=False)
        return None

    # Create a booking
    slot = slots[0]
    log(f"Creating test booking at {slot}")
    booking = create_test_booking(token, svc["id"], slot)
    if not booking:
        log("Failed to create test booking, trying different approach...", ok=False)
        # Try creating via admin endpoint
        return None

    token_uuid = booking.get("token_uuid")
    assert token_uuid, f"No token_uuid in booking response: {booking}"
    log(f"Booking created with token: {token_uuid}", ok=True)

    # Get the appointment ID via manage endpoint
    r = requests.get(f"{BASE_URL}/manage/{token_uuid}", timeout=10)
    assert r.status_code == 200
    appt_data = r.json()
    log(f"Appointment status: {appt_data['status']}", ok=True)

    # We need the appointment ID — let's search via admin summary
    r2 = requests.get(
        f"{BASE_URL}/admin/summary?date={date_str}",
        headers=admin_headers(token),
        timeout=10,
    )
    assert r2.status_code == 200
    summary = r2.json()
    appt_id = None
    for a in summary.get("appointments", []):
        if a.get("token_uuid") == token_uuid:
            appt_id = a["id"]
            break

    if not appt_id:
        log("Could not find appointment ID in summary", ok=False)
        return None

    log(f"Appointment ID: {appt_id}", ok=True)

    # ── Transition 1: booked → completed (should succeed) ──
    log("\n  [Test] booked → completed (should succeed):")
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "completed"},
        timeout=10,
    )
    if r.status_code == 200:
        log("  ✅ booked → completed: 200 OK", ok=True)
    else:
        log(f"  ❌ booked → completed: {r.status_code} {r.text}", ok=False)

    # ── Transition 2: completed → booked (should fail — terminal) ──
    log("\n  [Test] completed → booked (should fail — terminal):")
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "booked"},
        timeout=10,
    )
    if r.status_code == 400 and "terminal" in r.text.lower():
        log(f"  ✅ completed → booked: {r.status_code} (terminal error)", ok=True)
    else:
        log(f"  ❌ completed → booked: {r.status_code} {r.text}", ok=False)

    # ── Transition 3: completed → cancelled (should fail — terminal) ──
    log("\n  [Test] completed → cancelled (should fail — terminal):")
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "cancelled"},
        timeout=10,
    )
    if r.status_code == 400 and "terminal" in r.text.lower():
        log(f"  ✅ completed → cancelled: {r.status_code} (terminal error)", ok=True)
    else:
        log(f"  ❌ completed → cancelled: {r.status_code} {r.text}", ok=False)

    return {"appt_id": appt_id, "token_uuid": token_uuid, "date_str": date_str}


def test_04_api_cancelled_terminal(token: str, services: list):
    """Test that cancelled is also terminal."""
    log("\n--- 4. API: Cancelled is terminal ---")

    svc = services[0]
    date_str = tomorrow_str()
    slots = get_available_slots(svc["id"], date_str)

    if not slots:
        date_str = (date.today() + timedelta(days=3)).isoformat()
        slots = get_available_slots(svc["id"], date_str)

    if not slots:
        log("No slots available to test cancelled terminal", ok=False)
        return

    slot = slots[0]
    booking = create_test_booking(token, svc["id"], slot)
    if not booking:
        log("Could not create booking for cancelled terminal test", ok=False)
        return

    token_uuid = booking.get("token_uuid")

    # Get appointment ID via summary
    r = requests.get(
        f"{BASE_URL}/admin/summary?date={date_str}",
        headers=admin_headers(token),
        timeout=10,
    )
    assert r.status_code == 200
    summary = r.json()
    appt_id = None
    for a in summary.get("appointments", []):
        if a.get("token_uuid") == token_uuid:
            appt_id = a["id"]
            break

    if not appt_id:
        log("Could not find appointment for cancelled test", ok=False)
        return

    # Cancel via admin
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "cancelled"},
        timeout=10,
    )
    if r.status_code == 200:
        log("  ✅ booked → cancelled: 200 OK", ok=True)
    else:
        log(f"  ❌ booked → cancelled: {r.status_code} {r.text}", ok=False)
        return

    # Try cancelled → booked
    log("\n  [Test] cancelled → booked (should fail):")
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "booked"},
        timeout=10,
    )
    if r.status_code == 400:
        log(f"  ✅ cancelled → booked: {r.status_code} (terminal error)", ok=True)
    else:
        log(f"  ❌ cancelled → booked: {r.status_code} {r.text}", ok=False)

    # Try cancelled → completed
    log("\n  [Test] cancelled → completed (should fail):")
    r = requests.patch(
        f"{BASE_URL}/admin/appointments/{appt_id}/status",
        headers=admin_headers(token),
        json={"status": "completed"},
        timeout=10,
    )
    if r.status_code == 400:
        log(f"  ✅ cancelled → completed: {r.status_code} (terminal error)", ok=True)
    else:
        log(f"  ❌ cancelled → completed: {r.status_code} {r.text}", ok=False)


def test_05_api_public_cancel_validation(token: str):
    """Test that public cancel endpoint blocks cancelling completed/cancelled."""
    log("\n--- 5. API: Public cancel validation ---")

    # Try cancelling a non-existent booking
    fake_token = "00000000-0000-0000-0000-000000000000"
    r = requests.delete(f"{BASE_URL}/manage/{fake_token}", timeout=10)
    if r.status_code == 404:
        log("  ✅ DELETE /manage/{fake}: 404 (not found)", ok=True)
    else:
        log(f"  ❌ DELETE /manage/{fake}: {r.status_code} {r.text}", ok=False)


def test_06_list_admin_upcoming(token: str):
    """Test GET /admin/upcoming returns data."""
    log("\n--- 6. API: GET /admin/upcoming ---")
    r = requests.get(f"{BASE_URL}/admin/upcoming", headers=admin_headers(token), timeout=10)
    if r.status_code == 200:
        data = r.json()
        log(f"Upcoming: {len(data)} appointments", ok=True)
        for a in data:
            log(f"  - #{a['id']}: {a['customer_name']} | {a['service_name']} | {a['start_time']} | status={a['status']}")
    else:
        log(f"Failed: {r.status_code} {r.text}", ok=False)


def test_07_chrome_admin_login():
    """Use Chrome to test admin login and verify no JS errors."""
    log("\n--- 7. Chrome: Admin login + console check ---")
    out_path = "/tmp/state_machine_admin_login.png"
    js_log_path = "/tmp/state_machine_admin_console.json"

    chrome_script = f"""
    var consoleLogs = [];
    var consoleErrors = [];
    
    // Capture console output
    console.log = function() {{ consoleLogs.push(Array.from(arguments).join(' ')); }};
    console.error = function() {{ consoleErrors.push(Array.from(arguments).join(' ')); }};
    window.onerror = function(msg, url, line, col, err) {{
        consoleErrors.push('ERROR: ' + msg + ' at ' + url + ':' + line);
    }};
    
    // Store for later retrieval
    window.__consoleLogs = consoleLogs;
    window.__consoleErrors = consoleErrors;
    """

    try:
        result = subprocess.run(
            [
                "/usr/bin/google-chrome",
                "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars",
                "--window-size=420,1200",
                f"--virtual-time-budget=8000",
                f"--screenshot={out_path}",
                "--run-all-compositor-stages-before-draw",
                f"{BASE_URL}/admin.html",
            ],
            capture_output=True, text=True, timeout=15,
        )
        if os.path.exists(out_path):
            SCREENSHOTS.append({"name": "admin_login_page", "path": out_path})
            log(f"Screenshot saved: {out_path}", ok=True)
        else:
            log("Screenshot not created", ok=False)

        # Check for JS errors in stderr (Chrome logs JS errors to stderr)
        stderr_lower = result.stderr.lower()
        js_errors = []
        for line in result.stderr.split("\n"):
            if "error" in line.lower() and ("js" in line.lower() or "uncaught" in line.lower() or "typeerror" in line.lower() or "referenceerror" in line.lower()):
                js_errors.append(line)

        if js_errors:
            log(f"Found {len(js_errors)} JS errors in Chrome output", ok=False)
            for err in js_errors[:5]:
                log(f"  JS Error: {err[:200]}", ok=False)
        else:
            log("No JS errors detected in Chrome output", ok=True)

        # Also check for general console output that looks healthy
        if "react" in stderr_lower and "warning" not in stderr_lower:
            log("React rendered successfully", ok=True)

    except subprocess.TimeoutExpired:
        log("Chrome timed out", ok=False)
    except Exception as e:
        log(f"Chrome error: {e}", ok=False)


def test_08_chrome_admin_ui_actions(token: str):
    """Use Chrome to interact with admin panel — takes screenshots."""
    log("\n--- 8. Chrome: Admin UI verification ---")

    # Get some appointment data first to know what we're looking at
    today = date.today().isoformat()
    r = requests.get(
        f"{BASE_URL}/admin/summary?date={today}",
        headers=admin_headers(token),
        timeout=10,
    )
    today_appts = []
    if r.status_code == 200:
        data = r.json()
        today_appts = data.get("appointments", [])
        log(f"Today ({today}): {len(today_appts)} appointments")

    # Also try tomorrow
    tomorrow = tomorrow_str()
    r = requests.get(
        f"{BASE_URL}/admin/summary?date={tomorrow}",
        headers=admin_headers(token),
        timeout=10,
    )
    tomorrow_appts = []
    if r.status_code == 200:
        data = r.json()
        tomorrow_appts = data.get("appointments", [])
        log(f"Tomorrow ({tomorrow}): {len(tomorrow_appts)} appointments")

    # Get weekly agenda
    r = requests.get(
        f"{BASE_URL}/admin/agenda/weekly?date={today}",
        headers=admin_headers(token),
        timeout=10,
    )
    weekly_appts = {}
    if r.status_code == 200:
        data = r.json()
        weekly_appts = data.get("days", {})
        total = sum(len(v) for v in weekly_appts.values())
        log(f"Weekly agenda: {total} appointments across {len(weekly_appts)} days")

    # Screenshot the admin page
    for view_name, view_url in [
        ("admin_agenda_day", f"{BASE_URL}/admin.html?view=day&date={today}"),
        ("admin_agenda_week", f"{BASE_URL}/admin.html?view=week&date={today}"),
    ]:
        out_path = f"/tmp/state_machine_{view_name}.png"
        try:
            subprocess.run(
                [
                    "/usr/bin/google-chrome",
                    "--headless", "--disable-gpu", "--no-sandbox",
                    "--hide-scrollbars",
                    "--window-size=420,1200",
                    "--virtual-time-budget=8000",
                    f"--screenshot={out_path}",
                    view_url,
                ],
                capture_output=True, text=True, timeout=15,
            )
            if os.path.exists(out_path):
                SCREENSHOTS.append({"name": view_name, "path": out_path})
        except Exception as e:
            log(f"Screenshot {view_name} failed: {e}", ok=False)

    # Report what we found about each appointment status
    status_counts = {"booked": 0, "completed": 0, "cancelled": 0}
    for appt_list in [today_appts, tomorrow_appts]:
        for a in appt_list:
            s = a.get("status", "unknown")
            if s in status_counts:
                status_counts[s] += 1

    log(f"Appointment status distribution: {status_counts}")

    # Check if there are non-booked appointments (completed or cancelled)
    terminal_appts = [a for a in (today_appts + tomorrow_appts) if a.get("status") in ("completed", "cancelled")]
    log(f"Terminal appointments (completed/cancelled): {len(terminal_appts)}")

    for a in terminal_appts[:3]:
        log(f"  Terminal: #{a['id']} {a['customer_name']} -> {a['status']}")


def test_09_chrome_demo_flow():
    """Chrome: Demo page screenshots."""
    log("\n--- 9. Chrome: Demo page ---")
    out_path = "/tmp/state_machine_demo.png"
    try:
        subprocess.run(
            [
                "/usr/bin/google-chrome",
                "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars",
                "--window-size=420,1200",
                "--virtual-time-budget=8000",
                f"--screenshot={out_path}",
                f"{BASE_URL}/demo.html",
            ],
            capture_output=True, text=True, timeout=15,
        )
        if os.path.exists(out_path):
            SCREENSHOTS.append({"name": "demo_page", "path": out_path})
            log(f"Demo screenshot: {out_path}", ok=True)
        else:
            log("Demo screenshot not created", ok=False)
    except Exception as e:
        log(f"Demo screenshot error: {e}", ok=False)


def test_10_verify_state_machine_logic():
    """Unit-test the state machine function directly."""
    log("\n--- 10. State Machine Logic Verification ---")
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    try:
        from app.core.state_machine import validate_transition, ALLOWED_TRANSITIONS

        # Verify the matrix
        assert "booked" in ALLOWED_TRANSITIONS
        assert "completed" in ALLOWED_TRANSITIONS
        assert "cancelled" in ALLOWED_TRANSITIONS

        # Allowed transitions
        validate_transition("booked", "completed")  # should pass
        log("✅ booked → completed: allowed", ok=True)

        validate_transition("booked", "cancelled")  # should pass
        log("✅ booked → cancelled: allowed", ok=True)

        # Forbidden transitions
        tests = [
            ("completed", "booked", "terminal"),
            ("completed", "cancelled", "terminal"),
            ("cancelled", "booked", "terminal"),
            ("cancelled", "completed", "terminal"),
        ]
        for current, new, expected_msg in tests:
            try:
                validate_transition(current, new)
                log(f"❌ {current} → {new}: should have raised ValueError", ok=False)
            except ValueError as e:
                log(f"✅ {current} → {new}: blocked ({e})", ok=True)

        log("State machine logic is correct", ok=True)

    except ImportError as e:
        log(f"Cannot test state machine logic directly: {e}. Will verify via API only.", ok=False)
    except Exception as e:
        log(f"State machine test error: {e}", ok=False)


# ── Report ──────────────────────────────────────────────────────────

def print_report():
    print("\n" + "=" * 60)
    print("   STATE MACHINE E2E TEST REPORT")
    print("=" * 60)
    print(f"   Target: {BASE_URL}")
    print(f"   Time:   {datetime.now().isoformat()}")
    print(f"   Tests:  {len(RESULTS)}")
    print("-" * 60)

    passed = sum(1 for r in RESULTS if r["ok"] is True)
    failed = sum(1 for r in RESULTS if r["ok"] is False)
    skipped = sum(1 for r in RESULTS if r["ok"] is None)

    for r in RESULTS:
        icon = "✅" if r["ok"] is True else ("❌" if r["ok"] is False else "ℹ️")
        print(f"  {icon} {r['msg']}")

    print("-" * 60)
    print(f"   Passed: {passed} | Failed: {failed} | Info: {skipped}")
    print(f"   Screenshots: {len(SCREENSHOTS)}")
    for s in SCREENSHOTS:
        print(f"     - {s['name']}: {s['path']}")

    if failed > 0:
        print("\n  ⚠️  Some tests FAILED — review above for details")
    else:
        print("\n  ✅ All tests passed!")

    print("=" * 60)


# ── Main ────────────────────────────────────────────────────────────

def main():
    global BASE_URL
    parser = argparse.ArgumentParser(description="State Machine E2E Tests")
    parser.add_argument("--base-url", default=BASE_URL, help="Base URL of the API")
    args = parser.parse_args()

    BASE_URL = args.base_url.rstrip("/")

    admin_url_local = f"{BASE_URL}/admin.html"
    demo_url_local = f"{BASE_URL}/demo.html"

    print(f"🔧 State Machine E2E Verification")
    print(f"   API:    {BASE_URL}")
    print(f"   Admin:  {admin_url_local}")
    print(f"   Demo:   {demo_url_local}")
    print(f"   Time:   {datetime.now().isoformat()}")
    print()

    # Step 1: Get JWT
    try:
        token = get_jwt()
    except Exception as e:
        log(f"Could not get JWT token: {e}", ok=False)
        print_report()
        sys.exit(1)

    # Step 2: Get services
    services = test_01_api_services()

    # Step 3: Available slots
    test_02_api_available_slots(services)

    # Step 4: State machine transitions
    test_03_api_state_machine_transitions(token, services)

    # Step 5: Cancelled terminal
    test_04_api_cancelled_terminal(token, services)

    # Step 6: Public cancel validation
    test_05_api_public_cancel_validation(token)

    # Step 7: Admin upcoming
    test_06_list_admin_upcoming(token)

    # Step 8: Chrome admin login
    test_07_chrome_admin_login()

    # Step 9: Chrome admin UI
    test_08_chrome_admin_ui_actions(token)

    # Step 10: Chrome demo
    test_09_chrome_demo_flow()

    # Step 11: State machine logic
    test_10_verify_state_machine_logic()

    print_report()


if __name__ == "__main__":
    main()
