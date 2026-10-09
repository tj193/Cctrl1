"""Additive nationwide catalogue hierarchy proposal; no data transformation.

Revision ID: 20261009_0007
Revises: 20261009_0006
Unapplied. Existing area, university, profile and route IDs remain unchanged.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261009_0007"
down_revision: Union[str, Sequence[str], None] = "20261009_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "governorate",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("catalogue_key", sa.String(160), nullable=False),
        sa.Column("name_ar", sa.String(120), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_date", sa.Date(), nullable=True),
        sa.Column("verification_status", sa.String(32), nullable=False),
    )
    op.create_index("ix_governorate_catalogue_key", "governorate", ["catalogue_key"], unique=True)
    op.create_index("ix_governorate_name_ar", "governorate", ["name_ar"], unique=True)

    op.create_table(
        "catalogue_location",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("catalogue_key", sa.String(200), nullable=False),
        sa.Column("governorate_id", sa.Integer(), sa.ForeignKey("governorate.id"), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("catalogue_location.id"), nullable=True),
        sa.Column("level", sa.String(24), nullable=False),
        sa.Column("name_ar", sa.String(120), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_date", sa.Date(), nullable=True),
        sa.Column("verification_status", sa.String(32), nullable=False),
        sa.Column("pickup_eligible", sa.Boolean(), nullable=False),
        sa.CheckConstraint("level IN ('district', 'subdistrict', 'neighborhood', 'pickup_area')",
                           name="ck_catalogue_location_level"),
    )
    op.create_index("ix_catalogue_location_catalogue_key", "catalogue_location",
                    ["catalogue_key"], unique=True)
    op.create_index("ix_catalogue_location_governorate_parent_level", "catalogue_location",
                    ["governorate_id", "parent_id", "level"])

    op.add_column("area", sa.Column("catalogue_location_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_area_catalogue_location", "area", "catalogue_location",
                          ["catalogue_location_id"], ["id"])
    op.create_index("ix_area_catalogue_location_id", "area", ["catalogue_location_id"], unique=True)

    op.add_column("university", sa.Column("governorate_id", sa.Integer(), nullable=True))
    op.add_column("university", sa.Column("institution_kind", sa.String(16), nullable=True))
    op.add_column("university", sa.Column("catalogue_key", sa.String(160), nullable=True))
    op.add_column("university", sa.Column("source_url", sa.Text(), nullable=True))
    op.add_column("university", sa.Column("source_date", sa.Date(), nullable=True))
    op.add_column("university", sa.Column("verification_status", sa.String(32), nullable=True))
    op.create_foreign_key("fk_university_governorate", "university", "governorate",
                          ["governorate_id"], ["id"])
    op.create_index("ix_university_governorate_id", "university", ["governorate_id"])
    op.create_index("ix_university_catalogue_key", "university", ["catalogue_key"], unique=True)
    op.create_check_constraint("ck_university_institution_kind", "university",
                               "institution_kind IN ('public', 'private') OR institution_kind IS NULL")


def downgrade() -> None:
    connection = op.get_bind()
    counts = (
        connection.execute(sa.text("SELECT count(*) FROM area WHERE catalogue_location_id IS NOT NULL")).scalar_one(),
        connection.execute(sa.text(
            "SELECT count(*) FROM university WHERE governorate_id IS NOT NULL "
            "OR catalogue_key IS NOT NULL OR institution_kind IS NOT NULL "
            "OR source_url IS NOT NULL OR source_date IS NOT NULL "
            "OR verification_status IS NOT NULL"
        )).scalar_one(),
        connection.execute(sa.text("SELECT count(*) FROM governorate")).scalar_one(),
        connection.execute(sa.text("SELECT count(*) FROM catalogue_location")).scalar_one(),
    )
    if any(counts):
        raise RuntimeError("Catalogue data exists; downgrade refused to prevent data loss")

    op.drop_constraint("ck_university_institution_kind", "university", type_="check")
    op.drop_index("ix_university_catalogue_key", table_name="university")
    op.drop_index("ix_university_governorate_id", table_name="university")
    op.drop_constraint("fk_university_governorate", "university", type_="foreignkey")
    for column in ("verification_status", "source_date", "source_url", "catalogue_key",
                   "institution_kind", "governorate_id"):
        op.drop_column("university", column)
    op.drop_index("ix_area_catalogue_location_id", table_name="area")
    op.drop_constraint("fk_area_catalogue_location", "area", type_="foreignkey")
    op.drop_column("area", "catalogue_location_id")
    op.drop_index("ix_catalogue_location_governorate_parent_level", table_name="catalogue_location")
    op.drop_index("ix_catalogue_location_catalogue_key", table_name="catalogue_location")
    op.drop_table("catalogue_location")
    op.drop_index("ix_governorate_name_ar", table_name="governorate")
    op.drop_index("ix_governorate_catalogue_key", table_name="governorate")
    op.drop_table("governorate")
