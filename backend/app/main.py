from fastapi import FastAPI, Depends, Request, Response
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

# C2: Disable Swagger docs, ReDoc, and OpenAPI schema in production
_docs_disabled = settings.APP_ENV == "production"
app = FastAPI(
    title="Barber Booking API",
    description="Single-barber booking MVP. PostgreSQL as source of truth.",
    version="1.0.0",
    docs_url=None if _docs_disabled else "/docs",
    redoc_url=None if _docs_disabled else "/redoc",
    openapi_url=None if _docs_disabled else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, slowapi_handler)

# C6: Strip whitespace from each origin to avoid CORS preflight failures
# when .env has spaces after commas (e.g. "http://a.com, http://b.com")
_cors_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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


# C6: Catch-all OPTIONS handler — ensures preflight requests return 200
# with proper CORS headers even if no route explicitly handles OPTIONS.
@app.options("/{full_path:path}")
async def preflight_handler(request: Request, full_path: str):
    return Response(status_code=200)
