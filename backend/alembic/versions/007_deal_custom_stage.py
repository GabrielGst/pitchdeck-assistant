"""deal custom_stage column

Revision ID: 007
Revises: 006
Create Date: 2026-06-29

Allows deals to hold a custom stage key (from tenant_configs.custom_stages)
alongside the canonical DealStage enum value, which stays as partner_review.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("deals", sa.Column("custom_stage", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("deals", "custom_stage")
