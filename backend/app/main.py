from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler as slowapi_handler
from slowapi.middleware import SlowAPIMiddleware
import logging

from app.api.public import router as public_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.core.auth import verify_admin
from app.core.limiter import limiter
from app.core.config import settings
from app.scheduler.tasks import start_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = FastAPI(
    title="Barber Booking API",
    description="Single-barber booking MVP. PostgreSQL as source of truth.",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, slowapi_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router, tags=["auth"])
app.include_router(public_router, tags=["public"])
app.include_router(admin_router, tags=["admin"], dependencies=[Depends(verify_admin)])


@app.on_event("startup")
async def on_startup():
    start_scheduler()
    logger.info("Application startup complete")


@app.get("/")
def root():
    return {"status": "ok", "service": "barber-booking-api", "version": "1.0.0"}
