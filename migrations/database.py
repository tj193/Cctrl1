"""Resolve the verified Neon development endpoint for Alembic only."""

from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.exc import ArgumentError
from sqlalchemy.engine import URL, make_url


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEVELOPMENT_ENV = PROJECT_ROOT / ".env.development"
VERIFIED_ENDPOINT_ID = "ep-young-frost-b4g8wmz0"


def direct_development_url() -> URL:
    """Return a direct psycopg URL after validating the local dev endpoint.

    This function never reads .env, DATABASE_URL from the process, or an
    Alembic config URL. It must fail closed if the development file is absent,
    invalid, or points at any endpoint other than the verified one.
    """

    if not DEVELOPMENT_ENV.is_file():
        raise RuntimeError("Missing .env.development; migration connection refused")

    raw_url = dotenv_values(DEVELOPMENT_ENV, interpolate=False).get("DATABASE_URL")
    if not raw_url:
        raise RuntimeError("Missing DATABASE_URL in .env.development")

    try:
        url = make_url(raw_url)
    except (ArgumentError, TypeError, ValueError):
        raise RuntimeError("Invalid development database URL") from None

    host = (url.host or "").lower()
    endpoint_label, separator, remainder = host.partition(".")
    endpoint_id = endpoint_label.removesuffix("-pooler")
    if (
        url.drivername != "postgresql+psycopg"
        or not separator
        or not host.endswith(".neon.tech")
        or endpoint_id != VERIFIED_ENDPOINT_ID
        or url.query.get("sslmode") != "require"
        or not url.username
        or not url.password
        or not url.database
    ):
        raise RuntimeError("Unverified Neon development endpoint; migration refused")

    # Neon adds -pooler to the endpoint label for pooled connections. Alembic
    # uses that same verified endpoint through its direct hostname instead.
    direct_host = f"{endpoint_id}.{remainder}"
    return url.set(host=direct_host)
