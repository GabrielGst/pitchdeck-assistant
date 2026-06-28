"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-28

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgvector")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_tenants_slug"),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clerk_user_id", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("analyst", "associate", "partner", "admin", name="role"), nullable=False, server_default="analyst"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("clerk_user_id", name="uq_users_clerk_user_id"),
    )
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])

    op.create_table(
        "decks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("status", sa.Enum("pending", "processing", "processed", "failed", name="deckstatus"), nullable=False, server_default="pending"),
        sa.Column("extracted_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_decks_tenant_id", "decks", ["tenant_id"])
    op.create_index("ix_decks_status", "decks", ["status"])

    op.create_table(
        "deals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("deck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("decks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_name", sa.String(500), nullable=False),
        sa.Column("stage", sa.Enum("inbox", "screening", "due_diligence", "partner_review", "invested", "passed", name="dealstage"), nullable=False, server_default="inbox"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("deck_id", name="uq_deals_deck_id"),
    )
    op.create_index("ix_deals_tenant_id", "deals", ["tenant_id"])
    op.create_index("ix_deals_stage", "deals", ["stage"])


def downgrade() -> None:
    op.drop_table("deals")
    op.drop_table("decks")
    op.drop_table("users")
    op.drop_table("tenants")
    op.execute("DROP TYPE IF EXISTS dealstage")
    op.execute("DROP TYPE IF EXISTS deckstatus")
    op.execute("DROP TYPE IF EXISTS role")
