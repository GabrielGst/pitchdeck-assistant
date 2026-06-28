"""pipeline transitions and tenant config

Revision ID: 002
Revises: 001
Create Date: 2026-06-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Pipeline stage transitions — every deal movement is recorded
    op.create_table(
        "pipeline_transitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_stage", sa.Enum("inbox", "screening", "due_diligence", "partner_review", "invested", "passed", name="dealstage", create_type=False), nullable=True),
        sa.Column("to_stage", sa.Enum("inbox", "screening", "due_diligence", "partner_review", "invested", "passed", name="dealstage", create_type=False), nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pipeline_transitions_deal_id", "pipeline_transitions", ["deal_id"])
    op.create_index("ix_pipeline_transitions_tenant_id", "pipeline_transitions", ["tenant_id"])

    # Tenant configuration — stage display names, custom stages, custom scorecard dims
    op.create_table(
        "tenant_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stage_labels", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("custom_stages", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("custom_scorecard_dims", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("tenant_configs")
    op.drop_table("pipeline_transitions")
