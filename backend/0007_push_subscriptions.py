"""add push_subscriptions table for Web Push notifications

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TIMESTAMP

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent VARCHAR(500),
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            last_error VARCHAR(500),
            fail_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_status
            ON push_subscriptions(status);

        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
            ON push_subscriptions(endpoint);
    """)


def downgrade() -> None:
    op.execute("""
        DROP TABLE IF EXISTS push_subscriptions;
    """)
