import logging
logger = logging.getLogger("admin")

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from sqlalchemy import text, or_
from datetime import date as _date, datetime, timezone, time, timedelta
from typing import Optional, List
import csv
import io
import json

from pydantic import BaseModel

class ImportClient(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None

class ImportRequest(BaseModel):
    clients: List[ImportClient]

from app.db.database import get_session
from app.db.models import Client, Appointment
from app.schemas import AdminBookingCreate, ResetDemoRequest, ResetDemoResponse
from app.core.config import settings, TZ
from app.core.logic import create_appointment
from app.core.email import background_send_confirmation, background_send_cancellation
from app.core.lang import parse_lang
from app.core.state_machine import validate_transition
from app.core.auth import verify_admin
from app.core.push import send_booking_push
from app.schemas import (
    AdminBookingCreate, ResetDemoRequest, ResetDemoResponse,
    PushSubscriptionIn, PushSubscriptionOut,
)
from app.db.models import PushSubscription

router = APIRouter()


def _appointment_row(r):
    """Convert a raw DB row to a dict."""
    return {
        "id": r[0],
        "token_uuid": str(r[1]),
        "customer_name": r[2],
        "customer_phone": r[3],
        "customer_email": r[4],
        "service_name": r[5],
        "service_price": float(r[6]) if r[6] is not None else None,
        "start_time": r[7].isoformat() if r[7] else None,
        "end_time": r[8].isoformat() if r[8] else None,
        "status": r[9],
        "service_color": r[10] if len(r) > 10 else None,
        "notification_status": r[11] if len(r) > 11 else None,
        "client_id": r[12] if len(r) > 12 else None,
        "is_first_booking": r[13] if len(r) > 13 else False,
    }


APPT_COLS = """a.id, a.token_uuid, a.customer_name, a.customer_phone, a.customer_email,
               s.name AS service_name, s.price AS service_price,
               lower(a.slot) AS start_time, upper(a.slot) AS end_time, a.status,
               s.hex_color AS service_color"""

NOTIF_COLS = APPT_COLS + ", a.notification_status, a.client_id"

SUMMARY_COLS = NOTIF_COLS + """,
    CASE WHEN a.client_id IS NULL THEN FALSE
         WHEN (SELECT COUNT(*) FROM appointments a2
               WHERE a2.client_id = a.client_id AND a2.status != 'cancelled' AND a2.id != a.id) = 0
         THEN TRUE ELSE FALSE END AS is_first_booking"""


@router.get("/admin/summary")
def admin_summary(date: str, db: Session = Depends(get_session)):
    """List all appointments for a given day (YYYY-MM-DD)."""
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        return {"error": "Invalid date"}
    start_dt = datetime.combine(target, time.min).replace(tzinfo=TZ).astimezone(timezone.utc)
    end_dt = datetime.combine(target, time.max).replace(tzinfo=TZ).astimezone(timezone.utc)

    rows = db.execute(
        text(f"""
            SELECT {SUMMARY_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.slot && tstzrange(:start_dt, :end_dt, '[)')
            ORDER BY lower(a.slot)
        """),
        {"start_dt": start_dt, "end_dt": end_dt}
    ).fetchall()
    return {"date": date, "appointments": [_appointment_row(r) for r in rows]}


@router.get("/admin/agenda/weekly")
def admin_agenda_weekly(date: str, db: Session = Depends(get_session)):
    """List appointments for 7 days starting from the given date (YYYY-MM-DD)."""
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        return {"error": "Invalid date"}
    start_dt = datetime.combine(target, time.min).replace(tzinfo=TZ).astimezone(timezone.utc)
    end_dt = datetime.combine(target + timedelta(days=7), time.min).replace(tzinfo=TZ).astimezone(timezone.utc)

    rows = db.execute(
        text(f"""
            SELECT {NOTIF_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.slot && tstzrange(:start_dt, :end_dt, '[)')
            ORDER BY lower(a.slot)
        """),
        {"start_dt": start_dt, "end_dt": end_dt}
    ).fetchall()

    # Group by date
    days = {}
    for i in range(7):
        day = target + timedelta(days=i)
        days[day.isoformat()] = []

    for r in rows:
        start = r[7]
        if start:
            day_local = start.astimezone(TZ).strftime("%Y-%m-%d")
            if day_local in days:
                days[day_local].append(_appointment_row(r))

    return {"start_date": date, "days": days}


@router.get("/admin/agenda/monthly")
def admin_agenda_monthly(date: str, db: Session = Depends(get_session)):
    """Monthly overview: counts and revenue per day (YYYY-MM)."""
    try:
        year, month = map(int, date.split("-"))
        target = _date(year, month, 1)
    except (ValueError, AttributeError):
        return {"error": "Invalid date format. Use YYYY-MM"}

    # First day of month to first day of next month
    if month == 12:
        end_date = _date(year + 1, 1, 1)
    else:
        end_date = _date(year, month + 1, 1)

    start_dt = datetime.combine(target, time.min).replace(tzinfo=TZ).astimezone(timezone.utc)
    end_dt = datetime.combine(end_date, time.min).replace(tzinfo=TZ).astimezone(timezone.utc)

    rows = db.execute(
        text(f"""
            SELECT {NOTIF_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.slot && tstzrange(:start_dt, :end_dt, '[)')
            ORDER BY lower(a.slot)
        """),
        {"start_dt": start_dt, "end_dt": end_dt}
    ).fetchall()

    # Aggregate per day
    daily = {}
    for r in rows:
        start = r[7]
        if start:
            day = start.astimezone(TZ).strftime("%Y-%m-%d")
            if day not in daily:
                daily[day] = {"count": 0, "completed": 0, "cancelled": 0, "revenue": 0.0}
            daily[day]["count"] += 1
            if r[9] == "completed":
                daily[day]["completed"] += 1
                daily[day]["revenue"] += float(r[6]) if r[6] else 0
            elif r[9] == "cancelled":
                daily[day]["cancelled"] += 1

    return {"month": date, "days": daily}


@router.get("/admin/clients/export")
def admin_clients_export(db: Session = Depends(get_session)):
    """Export all clients as CSV for WhatsApp/email marketing."""
    rows = db.execute(
        text("""
            SELECT c.id, c.name, c.phone, c.email, c.created_at,
                   COALESCE(v.total_visits, 0) AS total_visits,
                   v.last_visit
            FROM clients c
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) FILTER (WHERE a.status = 'completed') AS total_visits,
                    MAX(CASE WHEN a.status = 'completed' THEN upper(a.slot) ELSE NULL END) AS last_visit
                FROM appointments a
                WHERE a.client_id = c.id
            ) v ON true
            ORDER BY total_visits DESC NULLS LAST, c.created_at DESC
        """)
    ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Nombre", "Teléfono", "Email", "Registrado", "Visitas", "Última visita"])

    now = datetime.now(timezone.utc)
    for r in rows:
        last_visit_str = r[6].strftime("%Y-%m-%d") if r[6] else ""
        created_str = r[4].strftime("%Y-%m-%d") if r[4] else ""
        writer.writerow([r[0], r[1], r[2], r[3], created_str, int(r[5]), last_visit_str])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clientes.csv"}
    )


class ImportClientItem(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None


class ImportClientsRequest(BaseModel):
    clients: List[ImportClientItem]


@router.post("/admin/clients/import")
def admin_import_clients(payload: ImportClientsRequest, db: Session = Depends(get_session)):
    """Import clients from Booksy CSV export. Deduplicates by phone."""
    created = 0
    updated = 0
    skipped = 0

    for c in payload.clients:
        if not c.name or not c.phone:
            skipped += 1
            continue

        # Normalize phone: remove spaces, +, dashes for matching
        phone_clean = c.phone.replace(" ", "").replace("-", "").replace("+", "")
        existing = db.execute(
            select(Client).where(
                text("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = :p"),
            ),
            {"p": phone_clean},
        ).scalar_one_or_none()

        if existing:
            # Update name/email if changed
            changed = False
            if existing.name != c.name:
                existing.name = c.name
                changed = True
            if c.email and existing.email != c.email:
                existing.email = c.email
                changed = True
            if changed:
                db.add(existing)
                updated += 1
            else:
                skipped += 1
        else:
            client = Client(name=c.name, phone=c.phone, email=c.email or None)
            db.add(client)
            created += 1

    db.commit()
    return {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total": created + updated + skipped,
    }


@router.get("/admin/clients")
def admin_clients(
    q: str | None = Query(None, description="Buscar por nombre, teléfono o email"),
    db: Session = Depends(get_session),
    _: str = Depends(verify_admin)
):
    """Clients with their completed visit count and last visit date.

    Uses LATERAL subquery to leverage the new ix_appointments_client_id index,
    avoiding full-table scans on appointments.
    Supports optional search query 'q' for name, phone, or email.
    """
    query = text("""
        SELECT c.id, c.name, c.phone, c.email, c.created_at, c.notes,
               COALESCE(v.total_visits, 0) AS total_visits,
               v.last_visit
        FROM clients c
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*) FILTER (WHERE a.status = 'completed') AS total_visits,
                MAX(CASE WHEN a.status = 'completed' THEN upper(a.slot) ELSE NULL END) AS last_visit
            FROM appointments a
            WHERE a.client_id = c.id
        ) v ON true
        ORDER BY total_visits DESC NULLS LAST, c.created_at DESC
    """)

    if q:
        like = f"%{q}%"
        query = text("""
            SELECT c.id, c.name, c.phone, c.email, c.created_at, c.notes,
                   COALESCE(v.total_visits, 0) AS total_visits,
                   v.last_visit
            FROM clients c
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) FILTER (WHERE a.status = 'completed') AS total_visits,
                    MAX(CASE WHEN a.status = 'completed' THEN upper(a.slot) ELSE NULL END) AS last_visit
                FROM appointments a
                WHERE a.client_id = c.id
            ) v ON true
            WHERE c.name ILIKE :like OR c.phone ILIKE :like OR c.email ILIKE :like
            ORDER BY total_visits DESC NULLS LAST, c.created_at DESC
        """)
        rows = db.execute(query, {"like": like}).fetchall()
    else:
        rows = db.execute(query).fetchall()

    now = datetime.now(timezone.utc)
    return [
        {
            "id": r[0],
            "name": r[1],
            "phone": r[2],
            "email": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
            "notes": r[5] or "",
            "total_visits": int(r[6]),
            "last_visit": r[7].isoformat() if r[7] else None,
            "days_since_last_visit": (now - r[7]).days if r[7] else None,
            "is_new": int(r[6]) == 0,
        }
        for r in rows
    ]


@router.patch("/admin/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: int, payload: dict, db: Session = Depends(get_session)):
    """Update appointment status. Validates against the state machine transition matrix."""
    new_status = payload.get("status")
    if new_status not in ("booked", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")

    row = db.execute(
        text("SELECT status FROM appointments WHERE id = :id"),
        {"id": appointment_id}
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")

    current = row[0]

    # Validate transition using the state machine matrix
    try:
        validate_transition(current, new_status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.execute(
        text("UPDATE appointments SET status = :s WHERE id = :id"),
        {"s": new_status, "id": appointment_id}
    )
    db.commit()
    return {"id": appointment_id, "status": new_status}


@router.post("/admin/appointments")
def admin_create_booking(
    payload: AdminBookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    accept_lang: str | None = Header(None, alias="Accept-Language"),
):
    """Create a booking from the admin panel. Same validation as public /book."""
    lang = parse_lang(accept_lang)
    result = create_appointment(
        db=db,
        service_id=payload.service_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        start_time=payload.start_time,
        is_first_time=payload.is_first_time,
        is_demo=payload.is_demo,
    )
    background_tasks.add_task(
        background_send_confirmation,
        email=result["customer_email"],
        customer_name=result["customer_name"],
        service_name=result["service_name"],
        start_time=result["start_time"],
        token_uuid=result["token_uuid"],
        appointment_id=result["id"],
        lang=lang,
    )
    # Push notification al admin
    background_tasks.add_task(
        send_booking_push,
        customer_name=result["customer_name"],
        service_name=result["service_name"],
        start_time=result["start_time"],
        is_first_booking=result.get("is_first_booking", False),
    )
    return {
        "id": result["id"],
        "token_uuid": result["token_uuid"],
        "service_name": result["service_name"],
        "service_color": result.get("service_color"),
        "customer_name": result["customer_name"],
        "start_time": result["start_time"],
        "end_time": result["end_time"],
        "status": result["status"],
        "is_first_booking": result.get("is_first_booking", False),
    }


@router.post("/admin/reset-demo", response_model=ResetDemoResponse)
def admin_reset_demo(
    payload: ResetDemoRequest,
    db: Session = Depends(get_session),
    _: bool = Depends(verify_admin),
):
    """Delete all demo data. Protected by confirm flag + env guard."""
    # Capa 2: confirmación explícita en body
    if not payload.confirm:
        raise HTTPException(status_code=400, detail="Must set confirm=true to reset demo data")

    # Capa 3: guarda de entorno — en producción requiere override explícito
    if settings.APP_ENV == "production" and not settings.RESET_DEMO_ALLOWED:
        raise HTTPException(
            status_code=403,
            detail="Reset demo is disabled in production. Set RESET_DEMO_ALLOWED=true to enable."
        )

    # 1. Borrar citas demo
    deleted_appts = db.execute(
        text("DELETE FROM appointments WHERE is_demo = TRUE RETURNING id")
    ).fetchall()
    appt_count = len(deleted_appts)

    # 2. Borrar clientes demo que NO tengan citas no-demo restantes
    deleted_clients = db.execute(
        text("""
            DELETE FROM clients
            WHERE is_demo = TRUE
              AND id NOT IN (
                SELECT DISTINCT client_id FROM appointments
                WHERE client_id IS NOT NULL AND is_demo = FALSE
              )
            RETURNING id
        """)
    ).fetchall()
    client_count = len(deleted_clients)

    # 3. Clientes demo con citas no-demo residuales: orfan las citas demo
    db.execute(
        text("UPDATE appointments SET client_id = NULL WHERE is_demo = TRUE AND client_id IS NOT NULL")
    )

    db.commit()

    logger.info(f"Reset demo: deleted {appt_count} appointments, {client_count} clients")
    return ResetDemoResponse(
        ok=True,
        deleted_appointments=appt_count,
        deleted_clients=client_count,
    )


@router.get("/admin/upcoming")
def admin_upcoming(db: Session = Depends(get_session)):
    """Next 7 upcoming booked appointments starting from now."""
    rows = db.execute(
        text(f"""
            SELECT {APPT_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.status = 'booked' AND lower(a.slot) >= NOW()
            ORDER BY lower(a.slot)
            LIMIT 7
        """)
    ).fetchall()
    return [_appointment_row(r) for r in rows]


@router.get("/admin/clients/{client_id}")
def admin_client_detail(client_id: int, db: Session = Depends(get_session)):
    """Full client detail: info + visit history + stats."""
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Visit history
    visits = db.execute(
        text(f"""
            SELECT {NOTIF_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.client_id = :cid
            ORDER BY lower(a.slot) DESC
        """),
        {"cid": client_id}
    ).fetchall()

    # Stats
    stats = db.execute(
        text("""
            SELECT
                COUNT(*) AS total_appts,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_visits,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_visits,
                SUM(CASE WHEN status = 'completed' THEN s.price ELSE 0 END) AS total_spent
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.client_id = :cid
        """),
        {"cid": client_id}
    ).first()

    # Service breakdown
    breakdown = db.execute(
        text("""
            SELECT s.name, COUNT(*) AS count, SUM(s.price) AS total
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.client_id = :cid AND a.status = 'completed'
            GROUP BY s.name
            ORDER BY count DESC
        """),
        {"cid": client_id}
    ).fetchall()

    return {
        "id": client.id,
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "notes": client.notes,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "stats": {
            "total_appointments": stats[0] or 0,
            "completed_visits": stats[1] or 0,
            "cancelled_visits": stats[2] or 0,
            "total_spent": float(stats[3]) if stats[3] else 0.0,
        },
        "service_breakdown": [
            {"service": r[0], "count": r[1], "total": float(r[2]) if r[2] else 0}
            for r in breakdown
        ],
        "visits": [_appointment_row(r) for r in visits],
    }


@router.patch("/admin/clients/{client_id}")
def admin_update_client(client_id: int, payload: dict, db: Session = Depends(get_session)):
    """Update client name, phone, or email."""
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if "name" in payload:
        client.name = payload["name"]
    if "phone" in payload:
        client.phone = payload["phone"]
    if "email" in payload:
        client.email = payload["email"]
    if "notes" in payload:
        client.notes = payload["notes"]

    db.add(client)
    db.commit()
    db.refresh(client)
    return {
        "id": client.id,
        "name": client.name,
        "phone": client.phone,
        "email": client.email,
        "notes": client.notes,
    }


@router.delete("/admin/clients/{client_id}")
def admin_delete_client(client_id: int, db: Session = Depends(get_session)):
    """Delete a client. Keeps past appointments (sets client_id = NULL)."""
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Orphan appointments so historical data is preserved
    db.execute(
        text("UPDATE appointments SET client_id = NULL WHERE client_id = :cid"),
        {"cid": client_id},
    )
    db.delete(client)
    db.commit()
    return {"ok": True, "message": "Client deleted"}


@router.get("/admin/stats/new-clients")
def admin_new_clients_stats(month: str = "", db: Session = Depends(get_session)):
    """Count new clients registered in a given month (YYYY-MM). If empty, uses current month."""
    if not month:
        now = datetime.now(TZ)
        month = now.strftime("%Y-%m")

    try:
        year, mon = map(int, month.split("-"))
    except (ValueError, AttributeError):
        return {"error": "Invalid month format. Use YYYY-MM"}

    # Clients created in that month
    row = db.execute(
        text("""
            SELECT
                COUNT(*) AS total_new,
                COUNT(*) FILTER (WHERE email IS NOT NULL) AS with_email
            FROM clients
            WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CAST(:month AS date))
        """),
        {"month": f"{year}-{mon:02d}-01"}
    ).first()

    # Also total clients to date
    total_clients = db.execute(
        text("SELECT COUNT(*) FROM clients")
    ).scalar()

    return {
        "month": month,
        "new_clients": row[0] or 0,
        "with_email": row[1] or 0,
        "total_clients": total_clients or 0,
    }


@router.get("/admin/notifications/recent")
def admin_recent_bookings(
    since: str = "",
    db: Session = Depends(get_session),
):
    """New bookings since a given timestamp (ISO format). Used by the notification bell."""
    if not since:
        # First load: return bookings from the last 24 hours
        since_dt = datetime.now(timezone.utc) - timedelta(hours=24)

    try:
        since_dt = datetime.fromisoformat(since)
        if since_dt.tzinfo is None:
            since_dt = since_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        since_dt = datetime.now(timezone.utc) - timedelta(hours=1)

    rows = db.execute(
        text(f"""
            SELECT {NOTIF_COLS}
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.created_at > :since
              AND a.id NOT IN (SELECT appointment_id FROM dismissed_notifications)
            ORDER BY a.created_at DESC
            LIMIT 20
        """),
        {"since": since_dt}
    ).fetchall()

    # Compute is_first_booking for each notification
    bookings = []
    for r in rows:
        appt = _appointment_row(r)
        cid = appt.get("client_id")
        if cid:
            prev = db.execute(
                text("""
                    SELECT COUNT(*) FROM appointments
                    WHERE client_id = :cid AND status != 'cancelled' AND id != :aid
                """),
                {"cid": cid, "aid": appt["id"]}
            ).scalar()
            appt["is_first_booking"] = (prev == 0)
        else:
            appt["is_first_booking"] = False
        bookings.append(appt)

    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "bookings": bookings,
        "since": now_iso,
    }


@router.delete("/admin/notifications/{appointment_id}/dismiss")
def admin_dismiss_notification(appointment_id: int, db: Session = Depends(get_session)):
    """Dismiss a notification so it doesn't appear again."""
    # Verify appointment exists
    appt = db.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Insert into dismissed_notifications (ignore if already dismissed)
    db.execute(
        text("""
            INSERT INTO dismissed_notifications (appointment_id, dismissed_at)
            VALUES (:aid, NOW())
            ON CONFLICT (appointment_id) DO NOTHING
        """),
        {"aid": appointment_id}
    )
    db.commit()
    return {"ok": True}


@router.get("/admin/dashboard")
def admin_dashboard(db: Session = Depends(get_session)):
    """Monthly dashboard: revenue, comparison, ticket average, new clients.

    Optimized: combines this-month and previous-month stats into a single query,
    and counts clients in another single query (instead of 4 separate queries).
    """
    now = datetime.now(TZ)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_start_utc = month_start.astimezone(timezone.utc)

    # Previous month
    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    # Next month (for end of current month range)
    if month_start.month == 12:
        next_month_start = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month_start = month_start.replace(month=month_start.month + 1)

    next_month_start_utc = next_month_start.astimezone(timezone.utc)
    prev_month_start_utc = prev_month_start.astimezone(timezone.utc)

    # Combined query: this month stats + previous month revenue in one pass
    combined = db.execute(
        text("""
            SELECT
                -- This month
                COUNT(*) FILTER (WHERE a.slot && tstzrange(:start, :end, '[)')) AS total_appts,
                COUNT(*) FILTER (WHERE a.slot && tstzrange(:start, :end, '[)') AND a.status = 'completed') AS completed,
                COALESCE(SUM(CASE WHEN a.slot && tstzrange(:start, :end, '[)') AND a.status = 'completed' THEN s.price ELSE 0 END), 0) AS revenue,
                COUNT(*) FILTER (WHERE a.slot && tstzrange(:start, :end, '[)') AND a.status = 'booked') AS booked,
                -- Previous month revenue
                COALESCE(SUM(CASE WHEN a.slot && tstzrange(:prev_start, :prev_end, '[)') AND a.status = 'completed' THEN s.price ELSE 0 END), 0) AS prev_revenue
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.slot && tstzrange(:prev_start, :end, '[)')
        """),
        {
            "start": month_start_utc,
            "end": next_month_start_utc,
            "prev_start": prev_month_start_utc,
            "prev_end": month_start_utc,
        }
    ).first()

    # Combined clients query: new this month + total
    client_counts = db.execute(
        text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE created_at >= :start) AS new_this_month
            FROM clients
        """),
        {"start": month_start_utc}
    ).first()

    # Today's stats (bookings, completed, cancelled, revenue) in one query
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start.astimezone(timezone.utc)
    today_end = today_start.replace(hour=23, minute=59, second=59, microsecond=999999)
    today_end_utc = today_end.astimezone(timezone.utc)

    today_stats = db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'booked') AS bookings_today,
                COUNT(*) FILTER (WHERE status = 'completed') AS completed_today,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_today,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN s.price ELSE 0 END), 0) AS revenue_today
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.slot && tstzrange(:start, :end, '[)')
        """),
        {"start": today_start_utc, "end": today_end_utc}
    ).first()

    # Clients to reactivate (last visit > 30 days, top 5 by total spent)
    reactivate = db.execute(
        text("""
            SELECT c.name, 
                   MAX(CASE WHEN a.status = 'completed' THEN upper(a.slot) ELSE NULL END) AS last_visit,
                   COUNT(*) FILTER (WHERE a.status = 'completed') AS total_visits,
                   COALESCE(SUM(CASE WHEN a.status = 'completed' THEN s.price ELSE 0 END), 0) AS total_spent
            FROM clients c
            JOIN appointments a ON a.client_id = c.id
            JOIN services s ON s.id = a.service_id
            GROUP BY c.id, c.name
            HAVING MAX(CASE WHEN a.status = 'completed' THEN upper(a.slot) ELSE NULL END) < NOW() - INTERVAL '30 days'
               AND COUNT(*) FILTER (WHERE a.status = 'completed') > 0
            ORDER BY total_spent DESC
            LIMIT 5
        """)
    ).fetchall()

    reactivate_clients = []
    for r in reactivate:
        last_visit = r[1]
        days_since = (datetime.now(timezone.utc) - last_visit).days if last_visit else 0
        reactivate_clients.append({
            "name": r[0],
            "last_visit": last_visit.strftime("%Y-%m-%d") if last_visit else None,
            "days_since": days_since,
            "total_visits": int(r[2]) if r[2] else 0,
            "total_spent": float(r[3]) if r[3] else 0.0,
        })

    revenue = float(combined[2]) if combined[2] else 0.0
    completed_count = int(combined[1]) if combined[1] else 0
    avg_ticket = round(revenue / completed_count, 2) if completed_count > 0 else 0.0

    return {
        "month": now.strftime("%Y-%m"),
        "revenue": revenue,
        "prev_month_revenue": float(combined[4]) if combined[4] else 0.0,
        "total_appointments": int(combined[0]) if combined[0] else 0,
        "completed": completed_count,
        "booked": int(combined[3]) if combined[3] else 0,
        "avg_ticket": avg_ticket,
        "new_clients": int(client_counts[1]) if client_counts[1] else 0,
        "total_clients": int(client_counts[0]) if client_counts[0] else 0,
        "bookings_today": int(today_stats[0]) if today_stats[0] else 0,
        "completed_today": int(today_stats[1]) if today_stats[1] else 0,
        "cancelled_today": int(today_stats[2]) if today_stats[2] else 0,
        "revenue_today": float(today_stats[3]) if today_stats[3] else 0.0,
        "reactivate_clients": reactivate_clients,
    }


# ── Holidays ────────────────────────────────────────────────────────────

class HolidayCreate(BaseModel):
    holiday_date: str  # YYYY-MM-DD
    name_es: str
    name_en: Optional[str] = None


@router.get("/admin/holidays")
def admin_list_holidays(year: Optional[int] = None, db: Session = Depends(get_session)):
    """List holidays, optionally filtered by year."""
    if year:
        rows = db.execute(
            text("SELECT id, holiday_date, name_es, name_en, year FROM holidays WHERE year = :y ORDER BY holiday_date"),
            {"y": year}
        ).fetchall()
    else:
        rows = db.execute(
            text("SELECT id, holiday_date, name_es, name_en, year FROM holidays ORDER BY holiday_date DESC")
        ).fetchall()
    return [
        {
            "id": r[0],
            "holiday_date": r[1].isoformat() if r[1] else None,
            "name_es": r[2],
            "name_en": r[3],
            "year": r[4],
        }
        for r in rows
    ]


@router.post("/admin/holidays")
def admin_create_holiday(payload: HolidayCreate, db: Session = Depends(get_session)):
    """Add a holiday."""
    from datetime import date as _date
    try:
        hdate = _date.fromisoformat(payload.holiday_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Check duplicate
    existing = db.execute(
        text("SELECT id FROM holidays WHERE holiday_date = :d"),
        {"d": hdate}
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")

    db.execute(
        text("""
            INSERT INTO holidays (holiday_date, name_es, name_en, year)
            VALUES (:d, :nes, :nen, :y)
        """),
        {"d": hdate, "nes": payload.name_es, "nen": payload.name_en or None, "y": hdate.year}
    )
    db.commit()
    return {"ok": True, "holiday_date": payload.holiday_date}


@router.delete("/admin/holidays/{holiday_id}")
def admin_delete_holiday(holiday_id: int, db: Session = Depends(get_session)):
    """Remove a holiday."""
    result = db.execute(
        text("DELETE FROM holidays WHERE id = :id RETURNING id"),
        {"id": holiday_id}
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.commit()
    return {"ok": True}


# ── Seasonal Schedules ──────────────────────────────────────────────────

class SeasonCreate(BaseModel):
    name: str
    season_start: str  # YYYY-MM-DD
    season_end: str    # YYYY-MM-DD
    business_hours: str  # JSON string


@router.get("/admin/seasons")
def admin_list_seasons(db: Session = Depends(get_session)):
    """List all seasonal schedules."""
    rows = db.execute(
        text("""
            SELECT id, name, season_start, season_end, business_hours, active
            FROM seasonal_schedules ORDER BY season_start DESC
        """)
    ).fetchall()
    return [
        {
            "id": r[0],
            "name": r[1],
            "season_start": r[2].isoformat() if r[2] else None,
            "season_end": r[3].isoformat() if r[3] else None,
            "business_hours": r[4],
            "active": r[5],
        }
        for r in rows
    ]


@router.post("/admin/seasons")
def admin_create_season(payload: SeasonCreate, db: Session = Depends(get_session)):
    """Create a new seasonal schedule."""
    from datetime import date as _date
    try:
        s_start = _date.fromisoformat(payload.season_start)
        s_end = _date.fromisoformat(payload.season_end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if s_end <= s_start:
        raise HTTPException(status_code=400, detail="season_end must be after season_start")

    # Validate JSON
    try:
        parsed = json.loads(payload.business_hours)
        if not isinstance(parsed, dict):
            raise ValueError("Must be a dict")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid business_hours JSON")

    db.execute(
        text("""
            INSERT INTO seasonal_schedules (name, season_start, season_end, business_hours)
            VALUES (:name, :ss, :se, :bh)
        """),
        {"name": payload.name, "ss": s_start, "se": s_end, "bh": payload.business_hours}
    )
    db.commit()
    return {"ok": True, "name": payload.name}


@router.patch("/admin/seasons/{season_id}")
def admin_update_season(season_id: int, payload: dict, db: Session = Depends(get_session)):
    """Update a seasonal schedule (partial)."""
    # Check exists
    existing = db.execute(
        text("SELECT id FROM seasonal_schedules WHERE id = :id"),
        {"id": season_id}
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Season not found")

    from datetime import date as _date
    updates = []
    params = {"id": season_id}

    if "name" in payload:
        updates.append("name = :name")
        params["name"] = payload["name"]
    if "season_start" in payload:
        try:
            params["ss"] = _date.fromisoformat(payload["season_start"])
            updates.append("season_start = :ss")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid season_start date")
    if "season_end" in payload:
        try:
            params["se"] = _date.fromisoformat(payload["season_end"])
            updates.append("season_end = :se")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid season_end date")
    if "active" in payload:
        updates.append("active = :active")
        params["active"] = bool(payload["active"])
    if "business_hours" in payload:
        try:
            json.loads(payload["business_hours"])
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid business_hours JSON")
        updates.append("business_hours = :bh")
        params["bh"] = payload["business_hours"]

    if updates:
        db.execute(
            text(f"UPDATE seasonal_schedules SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        db.commit()

    return {"ok": True}


@router.delete("/admin/seasons/{season_id}")
def admin_delete_season(season_id: int, db: Session = Depends(get_session)):
    """Delete a seasonal schedule."""
    result = db.execute(
        text("DELETE FROM seasonal_schedules WHERE id = :id RETURNING id"),
        {"id": season_id}
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Season not found")
    db.commit()
    return {"ok": True}


# ── Time Blocks ─────────────────────────────────────────────────────────

class TimeBlockCreate(BaseModel):
    block_date: str  # YYYY-MM-DD
    block_type: str = "time_range"  # 'full_day' | 'time_range'
    start_time: Optional[str] = None  # "HH:MM"
    end_time: Optional[str] = None    # "HH:MM"
    reason: Optional[str] = None


@router.get("/admin/blocks")
def admin_list_blocks(date: Optional[str] = None, db: Session = Depends(get_session)):
    """List time blocks, optionally filtered by date."""
    if date:
        try:
            from datetime import date as _date
            target = _date.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
        rows = db.execute(
            text("""
                SELECT id, block_date, block_type, start_time, end_time, reason
                FROM time_blocks WHERE block_date = :d
                ORDER BY start_time
            """),
            {"d": target}
        ).fetchall()
    else:
        rows = db.execute(
            text("""
                SELECT id, block_date, block_type, start_time, end_time, reason
                FROM time_blocks ORDER BY block_date DESC LIMIT 100
            """)
        ).fetchall()

    return [
        {
            "id": r[0],
            "block_date": r[1].isoformat() if r[1] else None,
            "block_type": r[2],
            "start_time": r[3],
            "end_time": r[4],
            "reason": r[5],
        }
        for r in rows
    ]


@router.post("/admin/blocks")
def admin_create_block(payload: TimeBlockCreate, db: Session = Depends(get_session)):
    """Create a time block (full day or time range)."""
    from datetime import date as _date
    try:
        bdate = _date.fromisoformat(payload.block_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if payload.block_type not in ("full_day", "time_range"):
        raise HTTPException(status_code=400, detail="block_type must be 'full_day' or 'time_range'")

    if payload.block_type == "time_range":
        if not payload.start_time or not payload.end_time:
            raise HTTPException(status_code=400, detail="start_time and end_time required for time_range")
        # Validate time format + order
        try:
            h_s, m_s = payload.start_time.split(":")
            h_e, m_e = payload.end_time.split(":")
            if not (0 <= int(h_s) <= 23 and 0 <= int(m_s) <= 59 and 0 <= int(h_e) <= 23 and 0 <= int(m_e) <= 59):
                raise ValueError
            # end_time must be after start_time
            if payload.start_time >= payload.end_time:
                raise HTTPException(status_code=400, detail="end_time must be after start_time")
        except HTTPException:
            raise
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    db.execute(
        text("""
            INSERT INTO time_blocks (block_date, block_type, start_time, end_time, reason)
            VALUES (:d, :bt, :st, :et, :r)
        """),
        {
            "d": bdate,
            "bt": payload.block_type,
            "st": payload.start_time,
            "et": payload.end_time,
            "r": payload.reason,
        }
    )
    db.commit()
    return {"ok": True, "block_date": payload.block_date}


@router.delete("/admin/blocks/{block_id}")
def admin_delete_block(block_id: int, db: Session = Depends(get_session)):
    """Remove a time block."""
    result = db.execute(
        text("DELETE FROM time_blocks WHERE id = :id RETURNING id"),
        {"id": block_id}
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Block not found")
    db.commit()
    return {"ok": True}


# ── Settings (Google Reviews, etc.) ──

@router.get("/admin/settings")
def admin_get_settings():
    """Return public-facing settings for the admin panel."""
    return {
        "google_place_id": settings.GOOGLE_PLACE_ID,
        "google_maps_api_key": settings.GOOGLE_MAPS_API_KEY,
        "vapid_public_key": settings.VAPID_PUBLIC_KEY,
    }


@router.patch("/admin/settings")
def admin_update_settings(payload: dict):
    """Update settings (only allowed keys). Updates are in-memory only for MVP."""
    allowed = {"google_place_id", "google_maps_api_key"}
    updated = {}
    for key in allowed:
        if key in payload:
            setattr(settings, key.upper(), payload[key])
            updated[key] = payload[key]
    # Note: for MVP these are in-memory only. In production, persist to DB or .env.
    return {"ok": True, "updated": updated}


@router.get("/admin/push/vapid-key")
def get_vapid_public_key():
    """Devuelve la clave VAPID pública para que el frontend registre push."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=501, detail="VAPID not configured")
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/admin/push/register", response_model=PushSubscriptionOut)
def register_push_subscription(
    payload: PushSubscriptionIn,
    db: Session = Depends(get_session),
    _: bool = Depends(verify_admin),
):
    """Registra una suscripción Web Push para el admin."""
    # Upsert por endpoint (evitar duplicados)
    existing = db.exec(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    ).first()
    if existing:
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        existing.status = "active"
        existing.last_error = None
        existing.fail_count = 0
        existing.last_used = datetime.now(timezone.utc)
        if payload.user_agent:
            existing.user_agent = payload.user_agent
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    sub = PushSubscription(
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
        user_agent=payload.user_agent or "",
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    logger.info(f"New push subscription registered: {sub.id}")
    return sub


@router.delete("/admin/push/unregister")
def unregister_push_subscription(
    endpoint: str = Query(...),
    db: Session = Depends(get_session),
    _: bool = Depends(verify_admin),
):
    """Elimina una suscripción Web Push."""
    existing = db.exec(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        logger.info(f"Push subscription removed: {existing.id}")
    return {"ok": True}
