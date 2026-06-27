"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-06-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist;')
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;')

    # 2. Services
    op.create_table(
        'services',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('duration_minutes', sa.Integer, nullable=False),
        sa.Column('active', sa.Boolean, server_default=sa.text('TRUE'), nullable=False),
    )

    # 3. Clients
    op.create_table(
        'clients',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('phone', sa.String(20), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('email', sa.String(150), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 4. Appointments
    op.create_table(
        'appointments',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('token_uuid', postgresql.UUID, server_default=sa.text('gen_random_uuid()'), nullable=False, unique=True, index=True),
        sa.Column('service_id', sa.Integer, sa.ForeignKey('services.id'), nullable=False),
        sa.Column('client_id', sa.Integer, sa.ForeignKey('clients.id'), nullable=True),
        sa.Column('customer_name', sa.String(150), nullable=False),
        sa.Column('customer_email', sa.String(150), nullable=True),
        sa.Column('customer_phone', sa.String(20), nullable=False),
        sa.Column('slot', postgresql.TSTZRANGE, nullable=False),
        sa.Column('status', sa.String(20), server_default='booked', nullable=False),
        sa.Column('notification_status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('review_requested', sa.Boolean, server_default=sa.text('FALSE'), nullable=False),
        sa.Column('recall_sent', sa.Boolean, server_default=sa.text('FALSE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )

    # 5. EXCLUDE constraint (no overlapping appointments)
    op.execute("""
        ALTER TABLE appointments
        ADD CONSTRAINT no_overlapping_appointments
        EXCLUDE USING GIST (slot WITH &&)
        WHERE (status != 'cancelled');
    """)

    # 6. Check constraints
    op.execute("""
        ALTER TABLE appointments
        ADD CONSTRAINT valid_status
        CHECK (status IN ('booked', 'cancelled', 'completed'));
    """)
    op.execute("""
        ALTER TABLE appointments
        ADD CONSTRAINT valid_notification_status
        CHECK (notification_status IN ('pending', 'sent', 'skipped_no_email', 'failed'));
    """)

    # 7. Trigger function and trigger for clients.updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)
    op.execute("""
        CREATE TRIGGER update_clients_updated_at
        BEFORE UPDATE ON clients
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
    """)

    # 8. Seed default services
    op.execute("""
        INSERT INTO services (name, price, duration_minutes, active) VALUES
            ('Corte', 15.00, 30, TRUE),
            ('Barba', 12.00, 30, TRUE),
            ('Corte + Barba', 25.00, 60, TRUE),
            ('Tintura', 35.00, 90, TRUE);
    """)


def downgrade() -> None:
    op.execute('DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;')
    op.execute('DROP FUNCTION IF EXISTS update_updated_at_column();')
    op.drop_table('appointments')
    op.drop_table('clients')
    op.drop_table('services')
