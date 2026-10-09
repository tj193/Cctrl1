"""Prevent duplicate active demand for one student and journey.

Revision ID: 20261009_0005
Revises: 20261009_0004

No demand rows or existing seat constraints are changed.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0005"
down_revision: Union[str, Sequence[str], None] = "20261009_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    duplicate_groups = connection.execute(sa.text("""
        SELECT count(*) FROM (
            SELECT 1 FROM routedemand
            WHERE status = 'ACTIVE'::routedemandstatus
            GROUP BY student_id, from_area_id, to_university_id
            HAVING count(*) > 1
        ) AS duplicates
    """)).scalar_one()
    if duplicate_groups:
        raise RuntimeError(
            "Duplicate active route demand must be reviewed before migration"
        )

    op.create_index(
        "uq_routedemand_active_student_journey", "routedemand",
        ["student_id", "from_area_id", "to_university_id"], unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'::routedemandstatus"),
    )
    op.create_index(
        "ix_routedemand_origin_university_status", "routedemand",
        ["from_area_id", "to_university_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_routedemand_origin_university_status", table_name="routedemand")
    op.drop_index("uq_routedemand_active_student_journey", table_name="routedemand")
