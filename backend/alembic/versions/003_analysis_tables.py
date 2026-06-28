"""analysis tables

Revision ID: 003
Revises: 002
Create Date: 2026-06-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analysis_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("pending", "complete", "failed", name="analysisstatus"), nullable=False, server_default="pending"),
        sa.Column("memo_text", sa.Text, nullable=True),
        sa.Column("memo_edited_text", sa.Text, nullable=True),
        sa.Column("llm_model", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_analysis_results_deal_id", "analysis_results", ["deal_id"])
    op.create_index("ix_analysis_results_tenant_id", "analysis_results", ["tenant_id"])

    op.create_table(
        "scorecard_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dimension_key", sa.String(100), nullable=False),
        sa.Column("ai_score", sa.Integer, nullable=False),
        sa.Column("human_score", sa.Integer, nullable=True),  # set by inline edit in #9
        sa.Column("rationale", sa.Text, nullable=True),
        sa.Column("is_custom", sa.Boolean, nullable=False, server_default="false"),
    )
    op.create_index("ix_scorecard_scores_analysis_id", "scorecard_scores", ["analysis_id"])

    op.create_table(
        "dd_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("edited_question", sa.Text, nullable=True),  # set by inline edit in #9
        sa.Column("risk_level", sa.Enum("low", "medium", "high", name="risklevel"), nullable=False, server_default="medium"),
        sa.Column("position", sa.Integer, nullable=False),
    )
    op.create_index("ix_dd_questions_analysis_id", "dd_questions", ["analysis_id"])

    # Fine-tuning data collection tables (used in #9)
    op.create_table(
        "memo_edits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("original_text", sa.Text, nullable=False),
        sa.Column("edited_text", sa.Text, nullable=False),
        sa.Column("section", sa.String(50), nullable=False, server_default="memo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "engagement_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("section", sa.String(100), nullable=True),
        sa.Column("value", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_engagement_events_deal_id", "engagement_events", ["deal_id"])


def downgrade() -> None:
    op.drop_table("engagement_events")
    op.drop_table("memo_edits")
    op.drop_table("dd_questions")
    op.drop_table("scorecard_scores")
    op.drop_table("analysis_results")
    op.execute("DROP TYPE IF EXISTS analysisstatus")
    op.execute("DROP TYPE IF EXISTS risklevel")
