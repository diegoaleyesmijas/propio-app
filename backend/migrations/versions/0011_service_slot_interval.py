"""0011_service_slot_interval

Adds per-service booking grid step (Booksy-style slot generation).
NULL = use the global fallback settings.SLOT_INTERVAL_MINUTES.

Revision ID: 0011
Revises: 2e5d9584705b
Create Date: 2026-10-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '2e5d9584705b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL = fallback global (SLOT_INTERVAL_MINUTES). Valid range 1..60 is
    # enforced both at the API layer (Pydantic) and at the DB layer (CHECK),
    # so raw SQL cannot insert 0 or negatives. NULL passes the CHECK
    # (PostgreSQL treats NULL as satisfying CHECK), keeping fallback semantics.
    op.execute("ALTER TABLE services ADD COLUMN slot_interval_minutes INTEGER NULL;")
    op.execute(
        """
        ALTER TABLE services
        ADD CONSTRAINT valid_slot_interval_minutes
        CHECK (slot_interval_minutes BETWEEN 1 AND 60);
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE services DROP CONSTRAINT IF EXISTS valid_slot_interval_minutes;")
    op.execute("ALTER TABLE services DROP COLUMN IF EXISTS slot_interval_minutes;")
