"""Record the existing development schema as the migration starting point.

This empty baseline assumes the eight SQLModel-managed tables already exist.
It does not create a fresh database and does not manage playing_with_neon.

Revision ID: 20261009_0001
Revises:
Create Date: 2026-10-09
"""

from typing import Sequence, Union


revision: str = "20261009_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Existing schema is already present; no DDL or data changes."""


def downgrade() -> None:
    """There is no pre-baseline schema to restore; no DDL or data changes."""
