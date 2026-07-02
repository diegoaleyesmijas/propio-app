from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import date, datetime
import re


class ServiceOut(BaseModel):
    id: int
    name: str
    price: float
    duration_minutes: int
    hex_color: Optional[str] = None
    description: Optional[str] = None


class ServiceCreate(BaseModel):
    name: str
    price: float
    duration_minutes: int
    hex_color: Optional[str] = None

    @field_validator('hex_color')
    @classmethod
    def validate_hex_color(cls, v):
        if v is not None:
            if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
                raise ValueError('hex_color must be in format #RRGGBB')
        return v


class SlotsQuery(BaseModel):
    service_id: int
    date: date


class BookingCreate(BaseModel):
    service_id: int
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: str
    start_time: datetime
    is_first_time: Optional[bool] = None

    @field_validator('customer_name', 'customer_phone', mode='before')
    @classmethod
    def strip_html_tags(cls, v):
        """Sanitize against stored XSS: strip HTML/script tags and whitespace."""
        if v is None:
            return ""
        v = str(v).strip()
        v = re.sub(r'<[^>]*>', '', v)
        return v.strip()


class BookingOut(BaseModel):
    token_uuid: str
    service_name: str
    start_time: datetime
    end_time: datetime
    customer_name: str
    status: str
    is_first_booking: bool = False
    is_first_time: Optional[bool] = None
    google_place_id: Optional[str] = None


class AdminBookingCreate(BaseModel):
    service_id: int
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: str
    start_time: datetime
    is_first_time: Optional[bool] = None
    is_demo: Optional[bool] = None

    @field_validator('customer_name', 'customer_phone', mode='before')
    @classmethod
    def strip_html_tags(cls, v):
        """Sanitize against stored XSS: strip HTML/script tags and whitespace."""
        if v is None:
            return ""
        v = str(v).strip()
        v = re.sub(r'<[^>]*>', '', v)
        return v.strip()


class ResetDemoRequest(BaseModel):
    confirm: bool = False


class ResetDemoResponse(BaseModel):
    ok: bool
    deleted_appointments: int
    deleted_clients: int


class CancelOut(BaseModel):
    detail: str


# ── Push notifications ──

class PushSubscriptionIn(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class PushSubscriptionOut(BaseModel):
    id: int
    endpoint: str
    status: str
    created_at: datetime
