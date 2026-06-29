"""corpus_a outcome label

Revision ID: 005
Revises: 004
Create Date: 2026-06-29

Adds nullable outcome column to corpus_a_chunks so terminal investment
decisions are stored alongside embeddings for future retrieval filtering.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "corpus_a_chunks",
        sa.Column(
            "outcome",
            sa.Enum("invested", "passed", name="dealstage", create_type=False),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("corpus_a_chunks", "outcome")
