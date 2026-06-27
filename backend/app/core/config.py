import secrets
from pydantic import model_validator
from pydantic_settings import BaseSettings
from datetime import time
from zoneinfo import ZoneInfo

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/barberapp"
    APP_ENV: str = "development"
    
    # Business timezone (all local times refer to this)
    TIMEZONE: str = "Europe/Madrid"
    
    # Business hours per weekday (0=Monday … 6=Sunday). Empty list = closed.
    # Each tuple is (open, close) in local time.
    BUSINESS_HOURS: dict[int, list[tuple[time, time]]] = {
        0: [(time(10, 0), time(14, 0)), (time(16, 30), time(20, 30))],
        1: [(time(10, 0), time(14, 0)), (time(16, 30), time(20, 30))],
        2: [(time(10, 0), time(14, 0)), (time(16, 30), time(20, 30))],
        3: [(time(10, 0), time(14, 0)), (time(16, 30), time(20, 30))],
        4: [(time(10, 15), time(15, 30))],
        5: [],
        6: [],
    }
    SLOT_INTERVAL_MINUTES: int = 30
    
    # Cancellation rule (hours before appointment)
    CANCELLATION_WINDOW_HOURS: int = 24
    
    # Rate limit for POST /book (requests per minute per IP)
    RATE_LIMIT_BOOK: str = "5/minute"

    # Allowed CORS origins (comma-separated). Use "*" for development only.
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:8000"

    # Admin login credentials (for JWT-based auth)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = ""  # ⚠️ NO DEFAULT — must be set via .env or env var. App fails if empty.

    # JWT secret. If not set via env var, generates a random one (invalidates tokens on restart).
    JWT_SECRET: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # SMTP for transactional email. Empty HOST = log-only mode (dev default).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "Código de Caballeros Salon <barberia@ejemplo.com>"

    # Frontend URL for email links (e.g. "https://barberia.dominio.com")
    FRONTEND_URL: str = "http://localhost:5173"

    # Reminder window (hours before appointment to send)
    REMINDER_WINDOW_HOURS: int = 4

    # Reset demo guard — in production, RESET_DEMO_ALLOWED must be true to use /admin/reset-demo
    RESET_DEMO_ALLOWED: bool = False

    # Google Business Profile - Place ID for reviews link
    # Ej: "ChIJN1t_tDeuEmsRUsoyG83frY4" (buscar en https://developers.google.com/maps/documentation/places/web-service/place-id)
    GOOGLE_PLACE_ID: str = ""
    GOOGLE_MAPS_API_KEY: str = ""

    # Web Push (VAPID) — notificaciones push reales en móvil
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIM_EMAIL: str = "admin@codigodecaballeros.site"
    # Endpoint que muestra la notificación push al admin (se abre al tocarla)
    ADMIN_PANEL_URL: str = "https://codigodecaballeros.site/admin.html"

    @model_validator(mode='after')
    def _require_admin_password(self):
        if not self.ADMIN_PASSWORD:
            raise ValueError(
                "ADMIN_PASSWORD is required. "
                "Set it via .env file or ADMIN_PASSWORD environment variable."
            )
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra env vars like VITE_API_URL

settings = Settings()
TZ = ZoneInfo(settings.TIMEZONE)
