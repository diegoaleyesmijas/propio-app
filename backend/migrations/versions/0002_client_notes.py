"""client notes + dismissed_notifications

Revision ID: 0002
Revises: 0001_initial
Create Date: 2026-06-16 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add notes column to clients
    op.execute('ALTER TABLE clients ADD COLUMN notes TEXT;')

    # 2. Create dismissed_notifications table
    op.execute("""
        CREATE TABLE dismissed_notifications (
            appointment_id INTEGER PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
            dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
    """)


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS dismissed_notifications;')
    op.execute('ALTER TABLE clients DROP COLUMN IF EXISTS notes;')
