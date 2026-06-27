from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Request
from sqlmodel import Session, select
from sqlalchemy import text
from datetime import datetime, timezone
from typing import List

from app.db.database import get_session
from app.db.models import Service
from app.schemas import (
    ServiceOut, BookingCreate, BookingOut, CancelOut
)
from app.core.config import settings
from app.core.logic import get_available_slots, create_appointment
from app.core.email import background_send_confirmation, background_send_cancellation
from app.core.lang import parse_lang
from app.core.limiter import limiter
from app.core.push import send_booking_push

router = APIRouter()


@router.get("/services", response_model=List[ServiceOut])
def list_services(db: Session = Depends(get_session)):
    services = db.exec(select(Service).where(Service.active == True)).all()  # noqa: E712
    return services


@router.get("/available-slots")
def available_slots(service_id: int, date: str, db: Session = Depends(get_session)):
    from datetime import date as _date
    try:
        target = _date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    slots = get_available_slots(db, service_id, target)
    return {"date": date, "service_id": service_id, "slots": slots}


@router.post("/book", response_model=BookingOut)
@limiter.limit(settings.RATE_LIMIT_BOOK)
def create_booking(
    request: Request,
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    accept_lang: str | None = Header(None, alias="Accept-Language"),
):
    lang = parse_lang(accept_lang)
    result = create_appointment(
        db=db,
        service_id=payload.service_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        start_time=payload.start_time,
        is_first_time=payload.is_first_time,
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
    # Push notification al admin (desde flujo público también)
    background_tasks.add_task(
        send_booking_push,
        customer_name=result["customer_name"],
        service_name=result["service_name"],
        start_time=result["start_time"],
        is_first_booking=result.get("is_first_booking", False),
    )
    return BookingOut(
        token_uuid=result["token_uuid"],
        service_name=result["service_name"],
        start_time=result["start_time"],
        end_time=result["end_time"],
        customer_name=result["customer_name"],
        status=result["status"],
        is_first_booking=result.get("is_first_booking", False),
        is_first_time=result.get("is_first_time"),
    )


@router.get("/manage/{token_uuid}", response_model=BookingOut)
def get_booking(token_uuid: str, db: Session = Depends(get_session)):
    row = db.execute(
        text("""
            SELECT a.token_uuid, s.name, lower(a.slot) AS start_time,
                   upper(a.slot) AS end_time, a.customer_name, a.status
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.token_uuid = :token
        """),
        {"token": token_uuid}
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    return BookingOut(
        token_uuid=str(row[0]),
        service_name=row[1],
        start_time=row[2],
        end_time=row[3],
        customer_name=row[4],
        status=row[5],
    )


@router.delete("/manage/{token_uuid}", response_model=CancelOut)
def cancel_booking(
    token_uuid: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    accept_lang: str | None = Header(None, alias="Accept-Language"),
):
    lang = parse_lang(accept_lang)
    row = db.execute(
        text("""
            SELECT a.id, a.customer_name, a.customer_email, s.name AS service_name,
                   lower(a.slot) AS start_time, a.status
            FROM appointments a
            JOIN services s ON s.id = a.service_id
            WHERE a.token_uuid = :token
        """),
        {"token": token_uuid}
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")

    appt_id, customer_name, customer_email, service_name, start_time, status = row
    if status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
    if status == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel a completed booking")

    now = datetime.now(timezone.utc)
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    hours_left = (start_time - now).total_seconds() / 3600

    if hours_left < settings.CANCELLATION_WINDOW_HOURS:
        raise HTTPException(
            status_code=400,
            detail=f"Cancellations are only allowed at least {settings.CANCELLATION_WINDOW_HOURS} hours before the appointment. Please contact the shop directly."
        )

    db.execute(
        text("UPDATE appointments SET status = 'cancelled' WHERE token_uuid = :token"),
        {"token": token_uuid}
    )
    db.commit()

    background_tasks.add_task(
        background_send_cancellation,
        email=customer_email,
        customer_name=customer_name,
        service_name=service_name,
        start_time=start_time,
        appointment_id=appt_id,
        lang=lang,
    )
    return CancelOut(detail="Booking cancelled successfully")
