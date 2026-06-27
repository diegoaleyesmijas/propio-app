"""
Transactional email for booking confirmations and cancellations.
Uses stdlib smtplib + email — zero external dependencies.
If SMTP_HOST is not configured, emails are only logged.
"""

import logging
import smtplib
from datetime import datetime
from email.message import EmailMessage
from sqlalchemy import text
from sqlmodel import Session

from app.core.config import settings, TZ
from app.db.database import engine

logger = logging.getLogger("email")

BUSINESS_NAME = "Código de Caballeros Salon"

WEEKDAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
WEEKDAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def _confirm_subject(lang: str = 'es') -> str:
    if lang == 'en':
        return f"Booking confirmed · {BUSINESS_NAME}"
    return f"Reserva confirmada · {BUSINESS_NAME}"


def _cancel_subject(lang: str = 'es') -> str:
    if lang == 'en':
        return f"Booking cancelled · {BUSINESS_NAME}"
    return f"Reserva cancelada · {BUSINESS_NAME}"


def _send_raw(to: str, subject: str, body: str) -> bool:
    """Low-level send. Returns True on success, False on failure."""
    if not settings.SMTP_HOST:
        logger.info(f"[EMAIL] {subject} → {to}")
        for line in body.strip().splitlines():
            logger.info(f"[EMAIL]   {line}")
        return True

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USER:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def send_confirmation(
    to: str,
    customer_name: str,
    service_name: str,
    date_str: str,
    time_str: str,
    manage_url: str,
    lang: str = 'es',
) -> bool:
    """Send booking confirmation email."""
    if lang == 'en':
        body = (
            f"Hi {customer_name},\n\n"
            f"Your booking is confirmed at {BUSINESS_NAME}:\n"
            f"  Service: {service_name}\n"
            f"  Date: {date_str}\n"
            f"  Time: {time_str}\n\n"
            f"Manage or cancel here:\n"
            f"  {manage_url}\n\n"
            f"Thanks,\n"
            f"{BUSINESS_NAME}"
        )
    else:
        body = (
            f"Hola {customer_name},\n\n"
            f"Tu reserva está confirmada en {BUSINESS_NAME}:\n"
            f"  Servicio: {service_name}\n"
            f"  Fecha: {date_str}\n"
            f"  Hora: {time_str}\n\n"
            f"Gestiona o cancela aquí:\n"
            f"  {manage_url}\n\n"
            f"Gracias,\n"
            f"{BUSINESS_NAME}"
        )
    return _send_raw(to, _confirm_subject(lang), body)


def send_cancellation(
    to: str,
    customer_name: str,
    service_name: str,
    date_str: str,
    time_str: str,
    booking_url: str,
    lang: str = 'es',
) -> bool:
    """Send booking cancellation email."""
    if lang == 'en':
        body = (
            f"Hi {customer_name},\n\n"
            f"Your booking has been cancelled at {BUSINESS_NAME}:\n"
            f"  Service: {service_name}\n"
            f"  Date: {date_str}\n"
            f"  Time: {time_str}\n\n"
            f"If you want to rebook:\n"
            f"  {booking_url}\n\n"
            f"Thanks,\n"
            f"{BUSINESS_NAME}"
        )
    else:
        body = (
            f"Hola {customer_name},\n\n"
            f"Tu reserva ha sido cancelada en {BUSINESS_NAME}:\n"
            f"  Servicio: {service_name}\n"
            f"  Fecha: {date_str}\n"
            f"  Hora: {time_str}\n\n"
            f"Si quieres reagendar:\n"
            f"  {booking_url}\n\n"
            f"Gracias,\n"
            f"{BUSINESS_NAME}"
        )
    return _send_raw(to, _cancel_subject(lang), body)


# ── Background tasks (called from routers via BackgroundTasks) ──

FRONTEND_URL = settings.FRONTEND_URL

def _fmt_date(dt: datetime, lang: str = 'es') -> str:
    """Format a timezone-aware datetime for email display (local time). 100% deterministic, no system locale."""
    local = dt.astimezone(TZ)
    wd = local.weekday()
    mo = local.month - 1
    day = local.day
    if lang == 'en':
        return f"{WEEKDAYS_EN[wd]}, {MONTHS_EN[mo]} {day}"
    return f"{WEEKDAYS_ES[wd]}, {day} de {MONTHS_ES[mo]}"


def _fmt_time(dt: datetime) -> str:
    """Format time as HH:MM in local time."""
    local = dt.astimezone(TZ)
    return local.strftime("%H:%M")


def _update_notification_status(appointment_id: int, status: str) -> None:
    """Update notification_status with an independent session."""
    try:
        with Session(engine) as db:
            db.execute(
                text("UPDATE appointments SET notification_status = :s WHERE id = :id"),
                {"s": status, "id": appointment_id}
            )
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update notification_status for {appointment_id}: {e}")


def background_send_confirmation(
    email: str,
    customer_name: str,
    service_name: str,
    start_time: datetime,
    token_uuid: str,
    appointment_id: int,
    lang: str = 'es',
) -> None:
    """Fire-and-forget: send confirmation email, then update status."""
    if not email:
        _update_notification_status(appointment_id, "skipped_no_email")
        return

    manage_url = f"{FRONTEND_URL}/demo.html?token={token_uuid}"
    date_str = _fmt_date(start_time, lang)
    time_str = _fmt_time(start_time)

    success = send_confirmation(email, customer_name, service_name, date_str, time_str, manage_url, lang)
    _update_notification_status(appointment_id, "sent" if success else "failed")


def background_send_cancellation(
    email: str,
    customer_name: str,
    service_name: str,
    start_time: datetime,
    appointment_id: int,
    lang: str = 'es',
) -> None:
    """Fire-and-forget: send cancellation email, then update status."""
    if not email:
        _update_notification_status(appointment_id, "skipped_no_email")
        return

    booking_url = f"{FRONTEND_URL}/demo.html"
    date_str = _fmt_date(start_time, lang)
    time_str = _fmt_time(start_time)

    success = send_cancellation(email, customer_name, service_name, date_str, time_str, booking_url, lang)
    _update_notification_status(appointment_id, "sent" if success else "failed")
