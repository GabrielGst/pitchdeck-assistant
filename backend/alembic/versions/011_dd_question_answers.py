"""Add answer field to dd_questions

Revision ID: 011
Revises: 010
Create Date: 2026-07-01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: str = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dd_questions", sa.Column("answer", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("dd_questions", "answer")
