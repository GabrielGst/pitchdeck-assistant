"""add triage JSONB column to deals

Revision ID: 007
Revises: 006
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "008"
down_revision: str = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("deals", sa.Column("triage", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("deals", "triage")
