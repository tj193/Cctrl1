"""Read-only check of the configured admin database connection."""

from sqlalchemy import inspect, text
from sqlmodel import SQLModel

from src.admin.DataBase import engine


def main() -> None:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            inspector = inspect(connection)
            tables = set(inspector.get_table_names(schema="public"))
            expected = {"user", "area", "university", "driver_profile", "route", "routestudents", "routedemand", "report"}
            print("Database connection: OK")
            print("Expected tables present:", ", ".join(sorted(tables & expected)))
            if missing := expected - tables:
                print("Expected tables missing:", ", ".join(sorted(missing)))
                raise SystemExit(1)
            for name in sorted(expected):
                actual_columns = {column["name"] for column in inspector.get_columns(name, schema="public")}
                model_columns = set(SQLModel.metadata.tables[name].columns.keys())
                if missing_columns := model_columns - actual_columns:
                    print(f"Missing columns in {name}:", ", ".join(sorted(missing_columns)))
                    raise SystemExit(1)
            print("Model columns: compatible")
    except Exception as error:
        print(f"Database check failed: {type(error).__name__}")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
