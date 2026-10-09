"""Add ride requests and database constraints for seat integrity.

Revision ID: 20261009_0002
Revises: 20261009_0001

The service must still serialize acceptance on the route row and enforce
authorization and capacity in one transaction. This migration does not do so.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20261009_0002"
down_revision: Union[str, Sequence[str], None] = "20261009_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


request_status = postgresql.ENUM(
    "PENDING", "ACCEPTED", "DECLINED", name="riderequeststatus", create_type=False
)


def upgrade() -> None:
    connection = op.get_bind()
    invalid_capacities = connection.execute(
        sa.text("SELECT count(*) FROM route WHERE capacity <= 0")
    ).scalar_one()
    if invalid_capacities:
        raise RuntimeError("Existing route capacities must be positive before migration")

    duplicate_enrollments = connection.execute(
        sa.text("""
            SELECT count(*) FROM (
                SELECT 1 FROM routestudents
                WHERE status = 'ACTIVE'::routestudentstatus
                GROUP BY student_id, route_id HAVING count(*) > 1
            ) AS duplicates
        """)
    ).scalar_one()
    if duplicate_enrollments:
        raise RuntimeError("Duplicate active enrollments must be reviewed before migration")

    postgresql.ENUM(
        "PENDING", "ACCEPTED", "DECLINED", name="riderequeststatus"
    ).create(connection, checkfirst=False)
    op.create_table(
        "ride_request",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("route_id", sa.Integer(), nullable=False),
        sa.Column("status", request_status, nullable=False,
                  server_default=sa.text("'PENDING'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.CheckConstraint("version > 0", name="ck_ride_request_version_positive"),
        sa.ForeignKeyConstraint(["student_id"], ["user.id"], name="fk_ride_request_student"),
        sa.ForeignKeyConstraint(["route_id"], ["route.id"], name="fk_ride_request_route"),
        sa.ForeignKeyConstraint(["decided_by"], ["user.id"], name="fk_ride_request_decider"),
    )
    op.create_index(
        "uq_ride_request_pending_student_route", "ride_request",
        ["student_id", "route_id"], unique=True,
        postgresql_where=sa.text("status = 'PENDING'::riderequeststatus"),
    )
    op.create_index(
        "ix_ride_request_route_status_created_at", "ride_request",
        ["route_id", "status", "created_at"],
    )
    op.create_check_constraint("ck_route_capacity_positive", "route", "capacity > 0")
    op.create_index(
        "uq_routestudents_active_student_route", "routestudents",
        ["student_id", "route_id"], unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'::routestudentstatus"),
    )
    op.create_index(
        "ix_routestudents_route_status", "routestudents", ["route_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_routestudents_route_status", table_name="routestudents")
    op.drop_index("uq_routestudents_active_student_route", table_name="routestudents")
    op.drop_constraint("ck_route_capacity_positive", "route", type_="check")
    op.drop_index("ix_ride_request_route_status_created_at", table_name="ride_request")
    op.drop_index("uq_ride_request_pending_student_route", table_name="ride_request")
    op.drop_table("ride_request")
    postgresql.ENUM(name="riderequeststatus").drop(op.get_bind(), checkfirst=False)
