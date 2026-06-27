from datetime import datetime, timedelta, timezone, date as date_type, time
from typing import List, Optional, Dict
from uuid import UUID
import json
import logging

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from sqlmodel import Session, select

from app.core.config import settings, TZ
from app.db.models import Client, Service

logger = logging.getLogger("app.logic")


def get_business_hours_for_date(db: Session, target_date: date_type) -> Dict[int, list]:
    """
    Resuelve el horario laboral para una fecha concreta.

    Orden de precedencia:
    1. Si es festivo en BD -> return {} (cerrado)
    2. Si hay temporada activa que cubre la fecha -> return sus horas
    3. Fallback -> return settings.BUSINESS_HOURS

    Devuelve el mismo formato que settings.BUSINESS_HOURS:
    {weekday: [(open_time, close_time), ...]}  o {} si cerrado.
    """
    # 1. Check holidays
    holiday = db.execute(
        text("SELECT id FROM holidays WHERE holiday_date = :d"),
        {"d": target_date}
    ).first()
    if holiday:
        return {}

    # 2. Check seasonal schedules
    row = db.execute(
        text("""
            SELECT business_hours FROM seasonal_schedules
            WHERE active = TRUE
              AND season_start <= :d
              AND season_end >= :d
            ORDER BY season_start DESC
            LIMIT 1
        """),
        {"d": target_date}
    ).first()
    if row:
        try:
            raw = json.loads(row[0])
            # Convert string keys to int, string times to time objects
            result = {}
            for wk_str, blocks in raw.items():
                wk = int(wk_str)
                result[wk] = []
                for open_str, close_str in blocks:
                    h_open, m_open = open_str.split(":")
                    h_close, m_close = close_str.split(":")
                    result[wk].append((
                        time(int(h_open), int(m_open)),
                        time(int(h_close), int(m_close))
                    ))
            return result
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Invalid business_hours JSON for date {target_date}: {e}")
            return settings.BUSINESS_HOURS

    # 3. Fallback to config
    return settings.BUSINESS_HOURS


def get_time_blocks_for_date(db: Session, target_date: date_type) -> list:
    """Retorna los bloqueos activos para una fecha."""
    rows = db.execute(
        text("""
            SELECT block_type, start_time, end_time, reason
            FROM time_blocks
            WHERE block_date = :d
            ORDER BY
                CASE WHEN block_type = 'full_day' THEN 0 ELSE 1 END,
                start_time
        """),
        {"d": target_date}
    ).fetchall()
    return [
        {
            "type": r[0],
            "start": r[1],
            "end": r[2],
            "reason": r[3],
        }
        for r in rows
    ]


def is_slot_blocked(slot_start_utc: datetime, slot_end_utc: datetime,
                    blocks: list) -> bool:
    """Check if a slot overlaps with any time block."""
    for b in blocks:
        if b["type"] == "full_day":
            return True  # full_day blocks everything
        # time_range block
        if b["start"] and b["end"]:
            # Convert block times to UTC for that date
            block_date = slot_start_utc.astimezone(TZ).date()
            h_s, m_s = b["start"].split(":")
            h_e, m_e = b["end"].split(":")
            block_start_local = datetime.combine(
                block_date, time(int(h_s), int(m_s)), tzinfo=TZ
            )
            block_end_local = datetime.combine(
                block_date, time(int(h_e), int(m_e)), tzinfo=TZ
            )
            block_start_utc = block_start_local.astimezone(timezone.utc)
            block_end_utc = block_end_local.astimezone(timezone.utc)

            # Overlap check
            if slot_start_utc < block_end_utc and slot_end_utc > block_start_utc:
                return True
    return False


def _validate_business_hours(dt: datetime, duration: timedelta,
                             db: Session) -> None:
    """Raise 400 if dt or dt+duration fall outside business hours."""
    local_start = dt.astimezone(TZ)
    local_end = (dt + duration).astimezone(TZ)
    weekday = local_start.weekday()
    target_date = local_start.date()

    hours = get_business_hours_for_date(db, target_date)
    blocks = hours.get(weekday, [])

    if not blocks:
        raise HTTPException(status_code=400, detail="The shop is closed on this day")
    t_start = local_start.time()
    t_end = local_end.time()
    for open_t, close_t in blocks:
        if open_t <= t_start and t_end <= close_t:
            return
    raise HTTPException(
        status_code=400,
        detail="The appointment time falls outside business hours"
    )


def create_appointment(
    db: Session,
    service_id: int,
    customer_name: str,
    customer_phone: str,
    customer_email: Optional[str],
    start_time: datetime,
    is_first_time: Optional[bool] = None,
    is_demo: Optional[bool] = None,
) -> dict:
    """
    Core booking logic shared by /book and /admin/appointments.
    - Validates service, business hours, client dedup, time blocks
    - Inserts via raw SQL with tstzrange (EXCLUDE constraint guards overlaps)
    - Returns dict with id, token_uuid, service_name, start_time, end_time
    Raises HTTPException 404/400/409 on failure.
    """
    # 1. Validate service
    service = db.get(Service, service_id)
    if not service or not service.active:
        raise HTTPException(status_code=404, detail="Service not found")

    # 2. Normalize timezone & compute end
    start = start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    end = start + timedelta(minutes=service.duration_minutes)

    # 3. Validate business hours (checks holidays + seasons)
    _validate_business_hours(start, timedelta(minutes=service.duration_minutes), db)

    # 3b. Check manual time blocks
    local_start = start.astimezone(TZ)
    target_date = local_start.date()
    blocks = get_time_blocks_for_date(db, target_date)
    if is_slot_blocked(start, end, blocks):
        raise HTTPException(
            status_code=400,
            detail="This time slot is blocked. Please choose another one."
        )

    # 4. Find or create client (dedup by phone, then by email)
    client = db.exec(
        select(Client).where(Client.phone == customer_phone)
    ).first()
    if not client and customer_email:
        client = db.exec(
            select(Client).where(Client.email == customer_email)
        ).first()
    if client:
        client.name = customer_name
        if customer_phone:
            client.phone = customer_phone
        if customer_email:
            client.email = customer_email
    else:
        client = Client(phone=customer_phone, name=customer_name, email=customer_email)
        db.add(client)
        db.flush()

    # 5. Check if first real booking
    existing_real = db.execute(
        text("""
            SELECT COUNT(*) FROM appointments
            WHERE client_id = :cid AND status != 'cancelled'
        """),
        {"cid": client.id}
    ).scalar()
    is_first_booking = (existing_real == 0)

    # 6. Insert appointment (EXCLUDE constraint validates overlaps)
    is_demo_val = is_demo if is_demo is not None else False
    try:
        row = db.execute(
            text("""
                INSERT INTO appointments (
                    service_id, client_id, customer_name, customer_email,
                    customer_phone, slot, status, notification_status, is_demo
                )
                VALUES (
                    :service_id, :client_id, :customer_name, :customer_email,
                    :customer_phone, tstzrange(:start_iso, :end_iso, '[)'),
                    'booked', 'pending', :is_demo
                )
                RETURNING id, token_uuid
            """),
            {
                "service_id": service.id,
                "client_id": client.id,
                "customer_name": customer_name,
                "customer_email": customer_email,
                "customer_phone": customer_phone,
                "start_iso": start.isoformat(),
                "end_iso": end.isoformat(),
                "is_demo": is_demo_val,
            }
        ).first()
        db.commit()

        # Also mark client as demo if this is a demo booking
        if is_demo_val and client and not client.is_demo:
            db.execute(
                text("UPDATE clients SET is_demo = TRUE WHERE id = :cid"),
                {"cid": client.id}
            )
            db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This time slot is no longer available. Please choose another one."
        )

    return {
        "id": row[0],
        "token_uuid": str(row[1]),
        "service_name": service.name,
        "service_color": getattr(service, 'hex_color', None) or "#78716C",
        "start_time": start,
        "end_time": end,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_phone": customer_phone,
        "status": "booked",
        "is_first_booking": is_first_booking,
        "is_first_time": is_first_time,
        "is_demo": is_demo_val,
    }


def get_available_slots(db: Session, service_id: int, target_date: date_type) -> List[str]:
    """
    Returns a list of ISO-formatted start times (strings) that are available
    for a given service on a given date.
    Now respects: holidays, seasonal schedules, and manual time blocks.
    """
    # 1. Get service duration
    result = db.execute(
        text("SELECT duration_minutes FROM services WHERE id = :sid AND active = TRUE"),
        {"sid": service_id}
    ).first()
    if not result:
        return []
    duration_min = result[0]
    duration = timedelta(minutes=duration_min)

    # 2. Get business hours (checks holidays + seasons)
    hours = get_business_hours_for_date(db, target_date)
    weekday = target_date.weekday()
    blocks = hours.get(weekday, [])
    if not blocks:
        return []

    # 3. Get manual time blocks for this date
    time_blocks = get_time_blocks_for_date(db, target_date)
    has_full_day_block = any(b["type"] == "full_day" for b in time_blocks)
    if has_full_day_block:
        return []

    step = timedelta(minutes=settings.SLOT_INTERVAL_MINUTES)
    now_utc = datetime.now(timezone.utc)
    slots: List[str] = []

    # 4. Iterate each business block
    for open_time, close_time in blocks:
        open_local = datetime.combine(target_date, open_time).replace(tzinfo=TZ)
        close_local = datetime.combine(target_date, close_time).replace(tzinfo=TZ)

        open_utc = open_local.astimezone(timezone.utc)
        close_utc = close_local.astimezone(timezone.utc)

        # 5. Get busy appointments overlapping this block
        rows = db.execute(
            text("""
                SELECT lower(slot) AS start, upper(slot) AS end
                FROM appointments
                WHERE status != 'cancelled'
                  AND slot && tstzrange(:open_dt, :close_dt, '[)')
            """),
            {"open_dt": open_utc.isoformat(), "close_dt": close_utc.isoformat()}
        ).fetchall()
        busy = [(r[0], r[1]) for r in rows]

        # 6. Walk the block in LOCAL time, compare in UTC
        # Align open time UP to next SLOT_INTERVAL boundary (e.g. 10:15 → 10:30, not 10:00)
        cursor_local = open_local
        if cursor_local.minute % settings.SLOT_INTERVAL_MINUTES != 0:
            # Round UP to next interval boundary
            cursor_local = cursor_local.replace(
                minute=((cursor_local.minute // settings.SLOT_INTERVAL_MINUTES) + 1) * settings.SLOT_INTERVAL_MINUTES,
                second=0, microsecond=0
            )
        while cursor_local + duration <= close_local:
            start_utc = cursor_local.astimezone(timezone.utc)
            end_utc = start_utc + duration

            if start_utc > now_utc:
                # Check appointment overlap
                is_free = True
                for b_start, b_end in busy:
                    if start_utc < b_end and end_utc > b_start:
                        is_free = False
                        break

                # Check time block overlap
                if is_free:
                    if is_slot_blocked(start_utc, end_utc, time_blocks):
                        is_free = False

                if is_free:
                    slots.append(start_utc.isoformat())

            cursor_local += step

    return slots
