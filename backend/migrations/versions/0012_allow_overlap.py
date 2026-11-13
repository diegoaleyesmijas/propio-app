"""Add allow_overlap to appointments (citas convividas - solo admin)

Admin can create appointments that coexist with an existing one in the same
time slot ("pisar" una cita). Public bookings never set this flag, so the
EXCLUDE constraint keeps protecting public flow from double bookings.

Constraint recreated as partial: overlaps are only rejected when BOTH rows
are non-overlap-allowed (i.e. normal appointments).

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'appointments',
        sa.Column('allow_overlap', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.execute("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments")
    op.execute("""
        ALTER TABLE appointments
        ADD CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (slot WITH &&)
        WHERE (status != 'cancelled' AND NOT allow_overlap);
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_overlapping_appointments")
    op.execute("""
        ALTER TABLE appointments
        ADD CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (slot WITH &&)
        WHERE (status != 'cancelled');
    """)
    op.drop_column('appointments', 'allow_overlap')
