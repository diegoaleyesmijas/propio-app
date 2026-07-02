"""replace demo services with real services catalog

Revision ID: f8eaa6de7f01
Revises: 0007
Create Date: 2026-06-30 14:54:06.523373

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8eaa6de7f01'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Original 4 demo services for downgrade
ORIGINAL_SERVICES = [
    "('Corte', 15.00, 30, TRUE, '#F59E0B')",
    "('Barba', 12.00, 30, TRUE, '#10B981')",
    "('Corte + Barba', 25.00, 60, TRUE, '#8B5CF6')",
    "('Tintura', 35.00, 90, TRUE, '#78716C')",
]

# Real 22 services catalog
REAL_SERVICES = [
    # Otros (color: #A8A29E stone-400)
    "('Pagar en efectivo', 1.00, 5, TRUE, '#A8A29E')",
    # Pack Código de Caballeros (color: #8B5CF6 violet)
    "('Camuflaje de canas', 25.00, 20, TRUE, '#8B5CF6')",
    "('Pack Clásico', 19.50, 35, TRUE, '#8B5CF6')",
    "('Pack Pro', 30.00, 55, TRUE, '#8B5CF6')",
    "('Pack Gentleman', 40.00, 55, TRUE, '#8B5CF6')",
    # Corte de cabello (color: #F59E0B amber)
    "('Corte nino hasta 6', 12.50, 30, TRUE, '#F59E0B')",
    "('Corte premium con lavado', 14.99, 25, TRUE, '#F59E0B')",
    "('Corte a navaja', 15.00, 25, TRUE, '#F59E0B')",
    "('Barba + corte', 21.99, 40, TRUE, '#F59E0B')",
    "('Premium caballero', 24.99, 55, TRUE, '#F59E0B')",
    # Barbería (color: #10B981 emerald)
    "('Arreglo de barba y diseno', 13.00, 20, TRUE, '#10B981')",
    "('Afeitado premium con ritual', 14.99, 30, TRUE, '#10B981')",
    # Color del cabello (color: #EC4899 pink)
    "('Color de barba', 13.00, 30, TRUE, '#EC4899')",
    "('Tinte de cabello', 35.00, 45, TRUE, '#EC4899')",
    "('Reflejos con gorro', 50.00, 80, TRUE, '#EC4899')",
    "('Color platinado o blanco', 85.00, 150, TRUE, '#EC4899')",
    # Trabajo tecnico (color: #06B6D4 cyan)
    "('Permanente pelo corto', 50.00, 60, TRUE, '#06B6D4')",
    "('Alisado pelo corto', 55.00, 90, TRUE, '#06B6D4')",
    # Higiene Masculina (color: #14B8A6 teal)
    "('Cera nariz y oidos', 10.00, 15, TRUE, '#14B8A6')",
    "('Limpieza de cutis', 12.00, 15, TRUE, '#14B8A6')",
    "('Limpieza facial y mascarilla', 15.00, 35, TRUE, '#14B8A6')",
    # Servicio Premium (color: #78716C stone-500)
    "('A domicilio', 75.00, 50, TRUE, '#78716C')",
]

INSERT_REAL = (
    "INSERT INTO services (name, price, duration_minutes, active, hex_color) VALUES\n"
    + ",\n".join(REAL_SERVICES)
    + ";"
)

INSERT_ORIGINAL = (
    "INSERT INTO services (name, price, duration_minutes, active, hex_color) VALUES\n"
    + ",\n".join(ORIGINAL_SERVICES)
    + ";"
)


def upgrade() -> None:
    # 1. Delete all appointments first (FK references to services)
    op.execute("DELETE FROM appointments;")

    # 2. Delete demo clients
    op.execute("DELETE FROM clients WHERE is_demo = TRUE;")

    # 3. Delete all existing services
    op.execute("DELETE FROM services;")

    # 4. Insert the 22 real services
    op.execute(INSERT_REAL)


def downgrade() -> None:
    # Reverse: delete all appointments, then services, then restore originals

    # 1. Delete all appointments (FK to services)
    op.execute("DELETE FROM appointments;")

    # 2. Delete all services (the real ones)
    op.execute("DELETE FROM services;")

    # 3. Re-insert the 4 original demo services
    op.execute(INSERT_ORIGINAL)
