"""holidays, seasonal_schedules, time_blocks

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Holidays
    op.create_table(
        'holidays',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('holiday_date', sa.Date(), nullable=False, index=True),
        sa.Column('name_es', sa.String(200), nullable=False),
        sa.Column('name_en', sa.String(200), nullable=True),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_unique_constraint('uq_holidays_date', 'holidays', ['holiday_date'])

    # 2. Seasonal schedules
    op.create_table(
        'seasonal_schedules',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('season_start', sa.Date(), nullable=False),
        sa.Column('season_end', sa.Date(), nullable=False),
        sa.Column('business_hours', sa.Text(), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('TRUE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 3. Time blocks
    op.create_table(
        'time_blocks',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('block_date', sa.Date(), nullable=False, index=True),
        sa.Column('start_time', sa.String(5), nullable=True),
        sa.Column('end_time', sa.String(5), nullable=True),
        sa.Column('reason', sa.String(300), nullable=True),
        sa.Column('block_type', sa.String(20),
                  server_default='time_range', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 4. Seed default holidays for Spain + Andalusia 2026 (most important ones)
    op.execute("""
        INSERT INTO holidays (holiday_date, name_es, name_en, year) VALUES
            ('2026-01-01', 'Año Nuevo', 'New Year', 2026),
            ('2026-01-06', 'Día de Reyes', 'Epiphany', 2026),
            ('2026-02-28', 'Día de Andalucía', 'Andalusia Day', 2026),
            ('2026-04-03', 'Viernes Santo', 'Good Friday', 2026),
            ('2026-05-01', 'Día del Trabajo', 'Labour Day', 2026),
            ('2026-08-15', 'Asunción de la Virgen', 'Assumption Day', 2026),
            ('2026-10-12', 'Fiesta Nacional de España', 'National Day of Spain', 2026),
            ('2026-11-01', 'Todos los Santos', 'All Saints Day', 2026),
            ('2026-12-06', 'Día de la Constitución', 'Constitution Day', 2026),
            ('2026-12-08', 'Inmaculada Concepción', 'Immaculate Conception', 2026),
            ('2026-12-25', 'Navidad', 'Christmas Day', 2026)
    """)


def downgrade() -> None:
    op.drop_table('time_blocks')
    op.drop_table('seasonal_schedules')
    op.drop_table('holidays')
