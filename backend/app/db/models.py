from datetime import datetime, date as date_type
from typing import Optional, List
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field, Relationship, Column, DateTime, text
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TSTZRANGE

class Service(SQLModel, table=True):
    __tablename__ = "services"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    price: float
    duration_minutes: int
    active: bool = Field(default=True)
    hex_color: Optional[str] = Field(default=None, max_length=7)
    
    appointments: List["Appointment"] = Relationship(back_populates="service")

class Client(SQLModel, table=True):
    __tablename__ = "clients"
    id: Optional[int] = Field(default=None, primary_key=True)
    phone: str = Field(unique=True, index=True)
    name: str
    email: Optional[str] = None
    notes: Optional[str] = Field(default=None, nullable=True)
    is_demo: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    appointments: List["Appointment"] = Relationship(back_populates="client")

class Appointment(SQLModel, table=True):
    __tablename__ = "appointments"
    id: Optional[int] = Field(default=None, primary_key=True)
    token_uuid: UUID = Field(default_factory=uuid4, unique=True, index=True)
    service_id: int = Field(foreign_key="services.id")
    client_id: Optional[int] = Field(default=None, foreign_key="clients.id")
    
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: str
    
    # We bind to the column created by the migration. Python side
    # we expose start/end helpers; the raw range is accessed via SQL when needed.
    slot: Optional[str] = Field(
        default=None,
        sa_column=Column(TSTZRANGE, nullable=False),
    )
    
    status: str = Field(default="booked")
    notification_status: str = Field(default="pending")
    is_demo: bool = Field(default=False)
    
    review_requested: bool = Field(default=False)
    recall_sent: bool = Field(default=False)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    service: Optional[Service] = Relationship(back_populates="appointments")
    client: Optional[Client] = Relationship(back_populates="appointments")


class Holiday(SQLModel, table=True):
    """Días festivos. Si un día está aquí, no hay disponibilidad."""
    __tablename__ = "holidays"
    id: Optional[int] = Field(default=None, primary_key=True)
    holiday_date: date_type = Field(index=True, nullable=False)
    name_es: str = Field(max_length=200, nullable=False)
    name_en: Optional[str] = Field(max_length=200, default=None)
    year: int = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SeasonalSchedule(SQLModel, table=True):
    """Temporadas con horarios distintos (verano/invierno).
    business_hours es un JSON con el mismo formato que config.BUSINESS_HOURS:
    {"0": [["10:00","14:00"],["17:00","21:00"]], "5": [], "6": []}
    """
    __tablename__ = "seasonal_schedules"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, nullable=False)
    season_start: date_type = Field(nullable=False)
    season_end: date_type = Field(nullable=False)
    business_hours: str = Field(nullable=False)  # JSON string
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TimeBlock(SQLModel, table=True):
    """Bloqueo manual de disponibilidad: día completo o franja horaria."""
    __tablename__ = "time_blocks"
    id: Optional[int] = Field(default=None, primary_key=True)
    block_date: date_type = Field(index=True, nullable=False)
    start_time: Optional[str] = Field(default=None, max_length=5)  # "10:00", null si full_day
    end_time: Optional[str] = Field(default=None, max_length=5)    # "14:00", null si full_day
    reason: Optional[str] = Field(default=None, max_length=300)
    block_type: str = Field(default="time_range")  # 'full_day' | 'time_range'
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PushSubscription(SQLModel, table=True):
    """Suscripciones Web Push para notificaciones al admin."""
    __tablename__ = "push_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    endpoint: str = Field(unique=True, index=True, nullable=False)
    p256dh: str = Field(nullable=False)
    auth: str = Field(nullable=False)
    user_agent: Optional[str] = Field(default=None, max_length=500)
    # Preparado para multi-admin futuro: admin_id: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: datetime = Field(default_factory=datetime.utcnow)
    # Trazabilidad: estado y errores
    status: str = Field(default="active")  # 'active' | 'invalid' | 'expired'
    last_error: Optional[str] = Field(default=None, max_length=500)
    fail_count: int = Field(default=0)
