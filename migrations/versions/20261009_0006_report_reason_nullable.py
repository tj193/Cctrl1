"""Allow canonical report content without duplicating the legacy reason.

Revision ID: 20261009_0006
Revises: 20261009_0005

Only the nullability of report.reason changes. Existing values are retained.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0006"
down_revision: Union[str, Sequence[str], None] = "20261009_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("report", "reason", existing_type=sa.String(),
                    existing_nullable=False, nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    missing = connection.execute(sa.text(
        "SELECT count(*) FROM report WHERE reason IS NULL"
    )).scalar_one()
    if missing:
        raise RuntimeError(
            "Cannot restore report.reason NOT NULL while canonical reports have NULL reason"
        )
    op.alter_column("report", "reason", existing_type=sa.String(),
                    existing_nullable=True, nullable=False)
