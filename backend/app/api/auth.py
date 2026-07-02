"""Auth endpoints (login). No auth required — validates credentials against settings."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.core.config import settings
from app.core.auth import create_access_token
from app.core.limiter import limiter

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/admin/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def admin_login(request: Request, payload: LoginRequest):
    """Authenticate with username + password, returns a JWT token valid for 24h."""
    if (
        payload.username != settings.ADMIN_USERNAME
        or payload.password != settings.ADMIN_PASSWORD
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token()
    return LoginResponse(access_token=token)
