# DarbGo team handoff

This document describes the current implementation. Start with the root `README.md` for installation and local commands. Verify database state before making any migration or seed decision; the counts below are the last recorded development check, not a live query performed by this documentation update.

`docs/audit/` contains historical phase reports. They record decisions and test evidence at their original dates, but many describe earlier schemas or frontend states; use this handoff and current source for day-to-day work.

## Runtime and ownership

- The public pages are at the repository root. Student, Driver, and Admin pages remain in their existing folders so relative links and assets continue to work.
- `src.admin.main:app` registers the FastAPI routers. `src/admin/models.py` owns SQLModel tables; `src/admin/security.py` validates JWT signature, expiration, role, and account status. The server derives Student/Driver identity from the token, never a browser-supplied owner ID.
- `student/api.js`, `driver/live-app.js`, and `admin/JS-file/apiClient.js` connect the role pages to the API on port `8001` during local development. Browser demo data is used only in explicit preview modes and is not authoritative live state.
- `js/data/iraq-catalogue.js` and `reference-data/universities-source.json` are the project-provided registration catalogue. `tools/prepare-registration-data.py` regenerates the browser catalogue. `tools/import_existing_catalogue.py` maps reviewed Arabic names to canonical PostgreSQL IDs; browser/demo IDs must never be used as database foreign keys.

## API overview

| Role | Main paths | Boundary |
| --- | --- | --- |
| Public | `/auth/student-register`, `/auth/student-login`, `/auth/driver-register`, `/auth/driver-login`, public catalogue endpoints | Students can sign in after registration; Drivers require Admin approval. |
| Student | `/student/profile`, `/student/areas`, `/student/universities`, `/student/routes`, `/student/ride-requests`, `/student/route-demand`, `/student/reports` | Own profile, requests, demand and reports only. Search uses canonical IDs. |
| Driver | `/auth/driver-me`, `/driver/routes`, `/driver/ride-requests`, `/driver/reports` | Active approved Driver and owned routes/requests/reports only. |
| Admin | `/auth/login`, `/admin/driver-applications`, `/admin/drivers`, `/admin/routes`, `/admin/students`, `/admin/reports`, `/admin/route-demand` | Admin JWT required; review and management endpoints enforce server authorization. |

The exact methods, request schemas, and response models are defined beside each router in `src/admin/routers/`. FastAPI serves the interactive OpenAPI reference at `/docs` when the local API runs. Do not use Admin endpoints as a substitute for Student or Driver ownership checks.

## Core rules

- Ride requests move from `Pending` to `Accepted` or `Declined`. A pending request does not reserve a seat. Only an accepted request with an active `routestudents` enrollment occupies capacity. Driver acceptance locks the route and checks ownership, approval, status, duplicates, and remaining capacity in one transaction.
- Route discovery reports occupied and available seats from active enrollments. It does not count pending requests or route demand. Suspended Drivers cannot publish or accept new requests; review the affected existing routes and enrollments before changing suspension policy.
- Reports use `type`, `subject`, and `description` for new content. `public_resolution` is visible to the owner; `internal_notes` is Admin-only. `report_id` is the legacy column name for the reporter user ID. Historical `reason` text remains for compatibility and must not be deleted or copied blindly. Revision `0006` made `reason` nullable for canonical writes. Removing `reason` requires a separate historical preservation review.
- Route demand is not a seat booking. Student and Driver owner endpoints must filter by authenticated identity. WhatsApp links open an editable message; they do not prove delivery or change status.

## Database and catalogue

- `migrations/database.py` reads **only** `.env.development` for migration operations, checks the verified Neon development endpoint ID, requires `postgresql+psycopg` and TLS, and chooses its direct endpoint. `migrations/env.py` defaults online operations to read-only unless an explicit verified write gate is supplied. Do not run `upgrade`, `stamp`, or `downgrade` as part of normal setup.
- The recorded development revision is `20261009_0006`. The ten managed tables are `user`, `driver_profile`, `student_profile`, `area`, `university`, `route`, `ride_request`, `routestudents`, `report`, and `routedemand`. `playing_with_neon` is unrelated and excluded from Alembic autogeneration.
- `20261009_0001` is the empty baseline. Revisions `0002` through `0006` add request/seat integrity, route/profile fields, report fields, active demand integrity, and nullable legacy report reason. The checked-in `0007` is an **unapplied proposal** for a broader location hierarchy; the existing project catalogue fits the current `area` and `university` tables. Never use `alembic upgrade head` without reviewing this distinction.
- The catalogue contains 19 governorates, 270 area choices, and 166 university/college choices. It is project curated, not a complete government registry. Area names must be resolved with governorate context. The import tooling is guarded, transactional, and idempotent; its default is dry run. `data/reference/` holds a separate candidate research set, not the approved live import source.
- The last recorded development check after the approved import found 270 areas, 166 universities, 18 fictional users, 5 Driver profiles, 12 Student profiles, 4 routes, 7 requests, 3 active enrollments, 3 reports, and 3 demand rows. Recheck before relying on these counts. Fixture identities are in `tools/phase43_synthetic_plan.py`; ignored local role passwords are in `.artifacts/demo-credentials.json`.

## Security and operations

- Keep `.env`, `.env.development`, `.env.backup`, `.artifacts/`, and test credentials out of Git. Never print connection URLs, passwords, JWTs, or identity documents. The general FastAPI module still calls `load_dotenv()`, so use `tools/run_development_api.py` for the verified development branch instead of launching `uvicorn` directly with an ambiguous environment.
- Never run integration or mutation tests against Neon. `tests/` use isolated SQLite or a separately configured loopback PostgreSQL `test_` database. The PostgreSQL final-seat concurrency case remains unverified when that test database is absent; SQLite cannot prove row-lock behavior.
- The last live HTTP smoke verified role logins, token/role rejection, Driver approval, request acceptance, seat counts, full-route refusal, and report privacy on development. It was not a full authenticated browser run. Future frontend checks must distinguish rendered UI from API and database evidence.
- The application does not store a geographic route polyline, operating days, arrival estimate, or complete vehicle detail for Student cards. The live dashboard must show an unavailable state rather than inventing these values. Notifications and some operational Admin controls remain unsupported by the API. Do not present demo records as live records.
- Historical reports previously flagged possible exposed credentials in Git history. Confirm rotation before production use. Review document-field exposure, login rate limits, browser text escaping, and Driver suspension effects before deployment.

## Visual assets and attribution

The original DarbGo logo and Daro mascot stay under `assets/`; the Iraq registration map stays under `assets/maps/` and `js/data/`. The map derives from [Iraqi Governorates](https://commons.wikimedia.org/wiki/File:Iraqi_Governorates.svg) by Rafy and contributors, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The role-page illustration is from [Storyset / Freepik](https://storyset.com/illustration/bus-stop/rafiki) with visible attribution. University catalogue sources and review scope are retained in `reference-data/SOURCES.md`.
