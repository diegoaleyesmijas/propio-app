"""add hex_color to services

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add hex_color column to services table
    op.add_column(
        'services',
        sa.Column('hex_color', sa.String(7), nullable=True)
    )

    # Seed colors for known services (case-insensitive matching)
    op.execute("""
        UPDATE services SET hex_color = '#F59E0B' WHERE LOWER(name) = 'corte'
    """)
    op.execute("""
        UPDATE services SET hex_color = '#10B981' WHERE LOWER(name) = 'barba'
    """)
    op.execute("""
        UPDATE services SET hex_color = '#8B5CF6' WHERE LOWER(name) = 'corte + barba'
    """)

    # For any other existing service without a color, assign the default stone color
    op.execute("""
        UPDATE services SET hex_color = '#78716C' WHERE hex_color IS NULL
    """)


def downgrade() -> None:
    op.drop_column('services', 'hex_color')
