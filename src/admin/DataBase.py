import os
from sqlmodel import SQLModel, create_engine, Session
from .models import *

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://neondb_owner:npg_z6oJDuKwd4fR@ep-rapid-unit-b4ff712b.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

engine = create_engine(DATABASE_URL, echo=True)

def create_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session