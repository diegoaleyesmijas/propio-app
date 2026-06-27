"""add performance indexes

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(op.f('ix_appointments_client_id'), 'appointments', ['client_id'])
    op.create_index(op.f('ix_appointments_status'), 'appointments', ['status'])
    op.create_index(op.f('ix_appointments_service_id'), 'appointments', ['service_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_appointments_client_id'))
    op.drop_index(op.f('ix_appointments_status'))
    op.drop_index(op.f('ix_appointments_service_id'))
