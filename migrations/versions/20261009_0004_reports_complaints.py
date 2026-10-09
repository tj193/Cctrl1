"""Extend reports for owner tracking and private/public resolution details.

Revision ID: 20261009_0004
Revises: 20261009_0003

All new fields are nullable so existing reports are not fabricated or rewritten.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0004"
down_revision: Union[str, Sequence[str], None] = "20261009_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("report", "target_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column(
        "report", "target_type",
        existing_type=sa.Enum("ADMIN", "STUDENT", "DRIVER", name="userrole"),
        nullable=True,
    )
    op.add_column("report", sa.Column("type", sa.String(32), nullable=True))
    op.add_column("report", sa.Column("subject", sa.String(120), nullable=True))
    op.add_column("report", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("report", sa.Column("public_resolution", sa.Text(), nullable=True))
    op.add_column("report", sa.Column("internal_notes", sa.Text(), nullable=True))
    op.add_column("report", sa.Column("related_route_id", sa.Integer(), nullable=True))
    op.add_column(
        "report", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "report", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_report_related_route", "report", "route", ["related_route_id"], ["id"]
    )
    op.create_index(
        "ix_report_reporter_created_at", "report", ["report_id", "created_at"]
    )
    op.create_index("ix_report_status_created_at", "report", ["status", "created_at"])
    op.create_index("ix_report_related_route_id", "report", ["related_route_id"])


def downgrade() -> None:
    connection = op.get_bind()
    rows_requiring_review = connection.execute(sa.text("""
        SELECT count(*) FROM report WHERE
            target_id IS NULL OR target_type IS NULL OR
            type IS NOT NULL OR subject IS NOT NULL OR description IS NOT NULL OR
            public_resolution IS NOT NULL OR internal_notes IS NOT NULL OR
            related_route_id IS NOT NULL OR updated_at IS NOT NULL OR
            resolved_at IS NOT NULL
    """)).scalar_one()
    if rows_requiring_review:
        raise RuntimeError(
            "Report data needs manual review before reverting revision 20261009_0004"
        )

    op.drop_index("ix_report_related_route_id", table_name="report")
    op.drop_index("ix_report_status_created_at", table_name="report")
    op.drop_index("ix_report_reporter_created_at", table_name="report")
    op.drop_constraint("fk_report_related_route", "report", type_="foreignkey")
    op.drop_column("report", "resolved_at")
    op.drop_column("report", "updated_at")
    op.drop_column("report", "related_route_id")
    op.drop_column("report", "internal_notes")
    op.drop_column("report", "public_resolution")
    op.drop_column("report", "description")
    op.drop_column("report", "subject")
    op.drop_column("report", "type")
    op.alter_column(
        "report", "target_type",
        existing_type=sa.Enum("ADMIN", "STUDENT", "DRIVER", name="userrole"),
        nullable=False,
    )
    op.alter_column("report", "target_id", existing_type=sa.Integer(), nullable=False)
