import os

from sqlalchemy import create_engine
from sqlmodel import Session

from . import models  # Register the existing SQLModel tables.


def database_url() -> str:
    value = os.getenv("DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("DATABASE_URL is required. Set it in the server environment.")
    return value


engine = create_engine(database_url(), pool_pre_ping=True, echo=False)


def get_session():
    with Session(engine) as session:
        yield session
