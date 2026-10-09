"""Run the local API with the verified Neon development configuration only.

This launcher does not migrate or seed the database. API requests can write, so
start it for an approved live demonstration only after the import approval gate.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import dotenv_values
from migrations.database import DEVELOPMENT_ENV, VERIFIED_ENDPOINT_ID, direct_development_url


def main() -> None:
    url = direct_development_url()
    values = dotenv_values(DEVELOPMENT_ENV, interpolate=False)
    jwt_secret = values.get("JWT_SECRET")
    if not jwt_secret or len(jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET in .env.development must contain at least 32 characters")
    os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
    os.environ["JWT_SECRET"] = jwt_secret
    if values.get("ADMIN_CORS_ORIGINS"):
        os.environ["ADMIN_CORS_ORIGINS"] = values["ADMIN_CORS_ORIGINS"]

    import uvicorn

    print(f"Starting local API on verified development endpoint {VERIFIED_ENDPOINT_ID}")
    uvicorn.run("src.admin.main:app", host="127.0.0.1", port=8001, reload=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid printing SQLAlchemy or URL diagnostics that might contain secrets.
        print(f"Development API start refused: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
