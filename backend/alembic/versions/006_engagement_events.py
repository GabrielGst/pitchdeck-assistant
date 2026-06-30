"""engagement events table

Revision ID: 006
Revises: 005
Create Date: 2026-06-29

Stores passive engagement signals from the analysis view for future model
training. No UI reads from this table in v1.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migration 003 created engagement_events with an old schema (JSONB value,
    # no tenant_id FK). Drop it and recreate with the correct schema.
    op.drop_index("ix_engagement_events_deal_id", "engagement_events")
    op.drop_table("engagement_events")
    op.create_table(
        "engagement_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("section", sa.String(50), nullable=True),
        sa.Column("value", sa.Float, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_engagement_events_deal_id", "engagement_events", ["deal_id"])
    op.create_index("ix_engagement_events_tenant_id", "engagement_events", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_engagement_events_tenant_id", "engagement_events")
    op.drop_index("ix_engagement_events_deal_id", "engagement_events")
    op.drop_table("engagement_events")
