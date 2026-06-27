"""
Web Push (VAPID) — notificaciones push reales al admin cuando entra una reserva.
Sin Firebase, sin terceros. Protocolo Web Push estándar del navegador.
"""

import logging
from typing import Optional
from datetime import datetime, timezone
from sqlmodel import Session, select
from sqlalchemy import text

from pywebpush import webpush, WebPushException
from app.core.config import settings
from app.db.database import engine
from app.db.models import PushSubscription

logger = logging.getLogger("push")

# ── Enviar push a una suscripción individual ──

def _send_to_subscription(subscription: PushSubscription, payload: dict) -> bool:
    """Envía un push a una suscripción. Retorna True si ok, False si hay error."""
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                }
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={
                "sub": f"mailto:{settings.VAPID_CLAIM_EMAIL}",
            }
        )
        return True
    except WebPushException as e:
        # 410 Gone = suscripción inválida/caducada → marcar para limpieza
        if e.response and e.response.status_code == 410:
            _mark_subscription_invalid(subscription.id, str(e))
        else:
            _mark_subscription_error(subscription.id, str(e))
        return False
    except Exception as e:
        _mark_subscription_error(subscription.id, str(e))
        return False


# ── Enviar push a TODAS las suscripciones activas ──

def send_booking_push(
    customer_name: str,
    service_name: str,
    start_time: datetime,
    is_first_booking: bool = False,
) -> int:
    """
    Envía notificación push a todas las suscripciones activas del admin.
    Retorna cuántos push se enviaron con éxito.
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured — skipping push notification")
        return 0

    # Formatear hora legible
    tz = settings.TIMEZONE
    try:
        from zoneinfo import ZoneInfo
        local_tz = ZoneInfo(tz)
        local_time = start_time.astimezone(local_tz)
        time_str = local_time.strftime("%H:%M")
        date_str = local_time.strftime("%d/%m")
    except Exception:
        time_str = start_time.strftime("%H:%M")
        date_str = start_time.strftime("%Y-%m-%d")

    payload = {
        "title": "✂ Nueva reserva",
        "body": f"{customer_name} · {service_name} · {date_str} {time_str}",
        "tag": "new-booking",
        "url": settings.ADMIN_PANEL_URL,
        "icon": "/logo-192.png",
        "badge": "/pwa-icon-192.png",
        "data": {
            "customer": customer_name,
            "service": service_name,
            "time": time_str,
            "is_first_booking": is_first_booking,
        }
    }

    try:
        with Session(engine) as db:
            subs = db.exec(
                select(PushSubscription).where(PushSubscription.status == "active")
            ).all()
            if not subs:
                logger.debug("No active push subscriptions — nobody to notify")
                return 0

            success_count = 0
            for sub in subs:
                if _send_to_subscription(sub, payload):
                    success_count += 1
                    # Actualizar last_used
                    db.execute(
                        text("UPDATE push_subscriptions SET last_used = :now WHERE id = :id"),
                        {"now": datetime.now(timezone.utc), "id": sub.id}
                    )

            db.commit()
            logger.info(f"Push sent to {success_count}/{len(subs)} subscriptions")
            return success_count
    except Exception as e:
        logger.error(f"Error sending push notifications: {e}")
        return 0


# ── Gestión de suscripciones ──

def _mark_subscription_invalid(sub_id: int, error_msg: str) -> None:
    """Marca una suscripción como inválida/eliminada (410 Gone)."""
    try:
        with Session(engine) as db:
            db.execute(
                text("""
                    UPDATE push_subscriptions
                    SET status = 'expired', last_error = :err, fail_count = fail_count + 1
                    WHERE id = :id
                """),
                {"id": sub_id, "err": error_msg}
            )
            db.commit()
    except Exception as e:
        logger.error(f"Failed to mark subscription {sub_id} as invalid: {e}")


def _mark_subscription_error(sub_id: int, error_msg: str) -> None:
    """Incrementa contador de fallos y registra el error."""
    try:
        with Session(engine) as db:
            db.execute(
                text("""
                    UPDATE push_subscriptions
                    SET last_error = :err, fail_count = fail_count + 1
                    WHERE id = :id
                """),
                {"id": sub_id, "err": error_msg}
            )
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update subscription {sub_id} error: {e}")


def cleanup_expired_subscriptions(max_failures: int = 5) -> int:
    """
    Limpieza programada: marca como 'expired' suscripciones con demasiados fallos.
    Retorna cuántas se marcaron.
    """
    try:
        with Session(engine) as db:
            result = db.execute(
                text("""
                    UPDATE push_subscriptions
                    SET status = 'expired', last_error = 'Too many failures'
                    WHERE status = 'active' AND fail_count >= :max_fail
                """),
                {"max_fail": max_failures}
            )
            db.commit()
            count = result.rowcount
            if count:
                logger.info(f"Cleaned up {count} expired push subscriptions")
            return count
    except Exception as e:
        logger.error(f"Error cleaning up subscriptions: {e}")
        return 0
