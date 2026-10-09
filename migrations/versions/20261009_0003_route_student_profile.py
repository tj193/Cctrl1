"""Add optional route schedule details and canonical student profiles.

Revision ID: 20261009_0003
Revises: 20261009_0002

Legacy routes retain NULL in every new column. No records are backfilled.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0003"
down_revision: Union[str, Sequence[str], None] = "20261009_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("route", sa.Column("departure_time", sa.Time(), nullable=True))
    op.add_column("route", sa.Column("return_time", sa.Time(), nullable=True))
    op.add_column("route", sa.Column("price_iqd", sa.Integer(), nullable=True))
    op.add_column("route", sa.Column("notes", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_route_price_iqd_nonnegative", "route", "price_iqd >= 0"
    )
    op.create_index("ix_route_driver_status", "route", ["driver_id", "status"])
    op.create_index(
        "ix_route_origin_university_status", "route",
        ["from_area_id", "to_university_id", "status"],
    )

    op.create_table(
        "student_profile",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("university_id", sa.Integer(), nullable=True),
        sa.Column("preferred_arrival_time", sa.Time(), nullable=True),
        sa.PrimaryKeyConstraint("user_id", name="pk_student_profile"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], name="fk_student_profile_user"),
        sa.ForeignKeyConstraint(["area_id"], ["area.id"], name="fk_student_profile_area"),
        sa.ForeignKeyConstraint(
            ["university_id"], ["university.id"], name="fk_student_profile_university"
        ),
    )
    op.create_index(
        "ix_student_profile_area_university", "student_profile",
        ["area_id", "university_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_profile_area_university", table_name="student_profile")
    op.drop_table("student_profile")
    op.drop_index("ix_route_origin_university_status", table_name="route")
    op.drop_index("ix_route_driver_status", table_name="route")
    op.drop_constraint("ck_route_price_iqd_nonnegative", "route", type_="check")
    op.drop_column("route", "notes")
    op.drop_column("route", "price_iqd")
    op.drop_column("route", "return_time")
    op.drop_column("route", "departure_time")
