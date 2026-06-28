"""vector embedding tables

Revision ID: 004
Revises: 003
Create Date: 2026-06-28

Two corpora per tenant:
  corpus_a  — processed deal deck chunks (auto-indexed after analysis)
  corpus_b  — thesis documents uploaded by Admin
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1024  # matches Mistral embed-v2 / text-embedding-3-small


def upgrade() -> None:
    # Corpus B: thesis documents (Admin-uploaded)
    op.create_table(
        "thesis_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("full_text", sa.Text, nullable=True),
        sa.Column("status", sa.Enum("pending", "indexed", "failed", name="docindexstatus"), nullable=False, server_default="pending"),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_thesis_docs_tenant_id", "thesis_documents", ["tenant_id"])

    # Corpus B chunks with embeddings
    op.create_table(
        "corpus_b_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("thesis_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_corpus_b_chunks_tenant_id", "corpus_b_chunks", ["tenant_id"])
    op.create_index("ix_corpus_b_chunks_document_id", "corpus_b_chunks", ["document_id"])
    # HNSW index for fast cosine similarity search
    op.execute(
        "CREATE INDEX ix_corpus_b_chunks_embedding ON corpus_b_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # Corpus A chunks with embeddings (deal history)
    op.create_table(
        "corpus_a_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("deck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("decks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_corpus_a_chunks_tenant_id", "corpus_a_chunks", ["tenant_id"])
    op.create_index("ix_corpus_a_chunks_deal_id", "corpus_a_chunks", ["deal_id"])
    op.execute(
        "CREATE INDEX ix_corpus_a_chunks_embedding ON corpus_a_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.drop_table("corpus_a_chunks")
    op.drop_table("corpus_b_chunks")
    op.drop_table("thesis_documents")
    op.execute("DROP TYPE IF EXISTS docindexstatus")
