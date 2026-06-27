"""add is_demo columns to appointments and clients

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-26

"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add is_demo to appointments (default FALSE — existing data is NOT demo)
    op.execute("""
        ALTER TABLE appointments
        ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE
    """)
    op.create_index(op.f('ix_appointments_is_demo'), 'appointments', ['is_demo'])

    # 2. Add is_demo to clients (default FALSE — existing clients are NOT demo)
    op.execute("""
        ALTER TABLE clients
        ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE
    """)
    op.create_index(op.f('ix_clients_is_demo'), 'clients', ['is_demo'])


def downgrade() -> None:
    op.drop_index(op.f('ix_appointments_is_demo'))
    op.drop_column('appointments', 'is_demo')
    op.drop_index(op.f('ix_clients_is_demo'))
    op.drop_column('clients', 'is_demo')
