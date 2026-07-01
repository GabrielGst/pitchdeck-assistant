"""add deal_documents, chat_messages, partner_memo

Revision ID: 009
Revises: 008
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "009"
down_revision: str = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deal_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column(
            "document_type",
            sa.Enum("supplementary", "financial", "legal", "other", name="documenttype"),
            nullable=False,
            server_default="supplementary",
        ),
        sa.Column("extracted_text", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_deal_documents_deal_id", "deal_documents", ["deal_id"])
    op.create_index("ix_deal_documents_tenant_id", "deal_documents", ["tenant_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("deal_id", UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "role",
            sa.Enum("user", "assistant", name="chatrole"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("context_ref", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_deal_id", "chat_messages", ["deal_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])

    op.add_column("analysis_results", sa.Column("partner_memo", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("analysis_results", "partner_memo")
    op.drop_table("chat_messages")
    op.drop_table("deal_documents")
    op.execute("DROP TYPE IF EXISTS chatrole")
    op.execute("DROP TYPE IF EXISTS documenttype")
