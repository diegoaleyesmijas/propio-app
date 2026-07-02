"""
APScheduler tasks.
- send_reminders: emails clients with an upcoming appointment in the next
  REMINDER_WINDOW_HOURS.
- auto_complete: marks past appointments as 'completed' if still 'booked'.
"""
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session

from app.db.database import engine
from app.core.config import settings
from app.core.email import send_confirmation, send_recall, _fmt_date, _fmt_time

logger = logging.getLogger("scheduler")


async def send_reminders():
    """Look for appointments needing a reminder email."""
    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        window_end = now + timedelta(hours=settings.REMINDER_WINDOW_HOURS)

        rows = db.execute(
            text("""
                UPDATE appointments
                SET notification_status = CASE
                        WHEN customer_email IS NULL THEN 'skipped_no_email'
                        ELSE 'pending'
                    END
                WHERE status = 'booked'
                  AND notification_status IN ('pending', 'sent')
                  AND lower(slot) BETWEEN :now AND :window_end
                RETURNING id, token_uuid, customer_name, customer_email,
                          customer_phone, lower(slot) AS start_time,
                  customer_email IS NULL AS no_email
            """),
            {"now": now, "window_end": window_end}
        ).fetchall()

        for r in rows:
            appt_id = r[0]
            token_uuid = r[1]
            name = r[2]
            email = r[3]
            start_time = r[5]
            no_email = r[-1]

            if no_email:
                logger.info(f"Reminder skipped (no email) for appointment {appt_id}")
                continue

            # Enviar email de recordatorio usando SMTP real
            manage_url = f"{settings.FRONTEND_URL}/reservar.html?token={token_uuid}"
            date_str = _fmt_date(start_time, 'es')
            time_str = _fmt_time(start_time)
            success = send_confirmation(email, name, "Recordatorio", date_str, time_str, manage_url, 'es')

            db.execute(
                text("""
                    UPDATE appointments
                    SET notification_status = :status
                    WHERE id = :id
                """),
                {"status": "sent" if success else "failed", "id": appt_id}
            )
        db.commit()


async def auto_complete():
    """Mark finished appointments as 'completed'."""
    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        result = db.execute(
            text("""
                UPDATE appointments
                SET status = 'completed'
                WHERE status = 'booked' AND upper(slot) < :now
            """),
            {"now": now}
        )
        db.commit()
        if result.rowcount:
            logger.info(f"Auto-completed {result.rowcount} appointments")


async def send_recalls():
    """
    Clients sin visita en los últimos 28-30 días → email de recall.
    Busca la última cita 'completed' de cada cliente (con email) que no tenga
    recall_sent = TRUE. Si pasaron 28-30 días desde upper(slot), envía recordatorio
    y marca recall_sent = TRUE.
    """
    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        days_ago_30 = now - timedelta(days=30)
        days_ago_28 = now - timedelta(days=28)

        rows = db.execute(
            text("""
                WITH last_visit AS (
                    SELECT DISTINCT ON (a.client_id)
                        a.id AS appointment_id,
                        a.client_id,
                        a.customer_name,
                        a.customer_email,
                        upper(a.slot) AS last_visit_date,
                        a.recall_sent
                    FROM appointments a
                    WHERE a.status = 'completed'
                      AND a.client_id IS NOT NULL
                      AND a.customer_email IS NOT NULL
                    ORDER BY a.client_id, upper(a.slot) DESC
                )
                SELECT appointment_id, client_id, customer_name,
                       customer_email, last_visit_date
                FROM last_visit
                WHERE recall_sent = FALSE
                  AND last_visit_date BETWEEN :days_ago_30 AND :days_ago_28
            """),
            {"days_ago_30": days_ago_30, "days_ago_28": days_ago_28}
        ).fetchall()

        for r in rows:
            appt_id, client_id, name, email, last_visit = r
            booking_url = f"{settings.FRONTEND_URL}/reservar.html"
            review_url = f"https://search.google.com/local/reviews?placeid={settings.GOOGLE_PLACE_ID}" if settings.GOOGLE_PLACE_ID else None
            success = send_recall(email, name, booking_url, review_url, 'es')
            logger.info(
                f"Recall {'sent' if success else 'failed'} to {email} for {name}"
                f" (last visit {last_visit.date()})"
            )
            db.execute(
                text("UPDATE appointments SET recall_sent = TRUE WHERE id = :id"),
                {"id": appt_id}
            )
        db.commit()
        if rows:
            logger.info(f"Sent {len(rows)} recall emails")


def start_scheduler():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(send_reminders, "interval", minutes=15, id="send_reminders")
    scheduler.add_job(auto_complete, "interval", minutes=15, id="auto_complete")
    scheduler.add_job(send_recalls, "interval", hours=6, id="send_recalls")
    scheduler.start()
    logger.info("Scheduler started: reminders every 15 min, auto-complete every 15 min, recalls every 6h")
    return scheduler
