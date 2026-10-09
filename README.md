# DarbGo

DarbGo is a university transportation application with Student, Driver, and Admin roles. Its frontend is static HTML/CSS/JavaScript; its API is FastAPI with SQLModel, PostgreSQL, JWT authentication, and Alembic.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `register.html`, `login.html` | Public entry pages |
| `student/`, `driver/`, `admin/` | Role-specific pages and controllers |
| `css/`, `js/`, `assets/` | Shared styles, scripts, map, logo, mascot, and illustrations |
| `src/admin/` | FastAPI application, models, security, and routers |
| `migrations/` | Alembic configuration and revision history |
| `reference-data/`, `data/reference/` | Curated product catalogue and separate research candidates |
| `tools/`, `tests/` | Guarded development utilities and isolated tests |
| `demo-video/` | Optional presentation project; not required to run the app |

## Local development

Install Python 3.11 or newer, [uv](https://docs.astral.sh/uv/), and Node.js for the frontend check scripts. From the repository root:

```powershell
uv sync --dev
```

Create an ignored `.env.development` locally. Put the Neon **development** connection URL under `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters in that file. Use `postgresql+psycopg://` with `sslmode=require`; do not use a production connection or commit this file. `.env.example` lists the variable names. The guarded launcher validates the approved development endpoint before starting the API.

In separate terminals, run:

```powershell
uv run --no-sync python tools/run_development_api.py
```

```powershell
uv run --no-sync python -m http.server 5174 --bind 127.0.0.1
```

Open `http://127.0.0.1:5174/login.html`; Admin has a separate page at `http://127.0.0.1:5174/admin/front-end/login.html`. Check the API at `http://127.0.0.1:8001/health`. Start the API only against the intended development branch. Starting it does not migrate or seed data, but UI actions may write to development.

## Checks

```powershell
uv run --no-sync python -m pytest -q tests
node tools/check-registration.cjs
node tools/check-paths.cjs
```

Python tests use isolated test databases. PostgreSQL-only concurrency tests require a separate loopback `test_` database and are skipped without `TEST_POSTGRES_URL`. Never point tests at Neon.

The optional Student and Driver browser checks require Playwright from the `demo-video/` package and a working Chromium/Edge installation. After installing that package's pinned dependencies, make its modules visible to the root scripts:

```powershell
npm ci --prefix demo-video
$env:NODE_PATH = (Resolve-Path demo-video/node_modules).Path
node tools/check-student-dashboard.cjs
node tools/check-driver-dashboard.cjs
```

## Database and demo accounts

The verified development schema is at `20261009_0006`. Revision `20261009_0007` is a proposal and must not be applied automatically. Alembic loads `.env.development` explicitly and defaults to a read-only connection. Review every migration and obtain separate approval before any write operation. Keep production and the backup branch untouched.

The original registration catalogue contains 19 governorates, 270 areas, and 166 institutions. The guarded importer and fixture seeder are under `tools/`; neither should be run in write mode as part of routine setup. Fixture account identities are defined in `tools/phase43_synthetic_plan.py`. Generated role passwords are kept only in the ignored `.artifacts/demo-credentials.json`; never add them to documentation or Git.

For architecture, API routes, security boundaries, migration policy, and known limitations, read [the team handoff](docs/PROJECT_HANDOFF.md). Catalogue provenance is in [reference-data/SOURCES.md](reference-data/SOURCES.md).
