"""Add sort_order to services (orden personalizado del barbero)

The barber chooses the display order of services; the same order applies
to the admin panel list and the public booking page.

Revision ID: 0013
Revises: 0012
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'services',
        sa.Column('sort_order', sa.Integer(), nullable=True),
    )
    # Backfill: keep the current display order (by id)
    op.execute("UPDATE services SET sort_order = id WHERE sort_order IS NULL")
    op.execute("CREATE INDEX idx_services_sort_order ON services (sort_order)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_services_sort_order")
    op.drop_column('services', 'sort_order')
