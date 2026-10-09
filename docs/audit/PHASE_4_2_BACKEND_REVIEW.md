# Phase 4.2 backend review: requests, seats, reports, demand

Date: 2026-10-09. Scope: local FastAPI code, one **prepared but unapplied**
Alembic revision, and isolated tests. Neon production and development were
not used for writes. No frontend, deployment, commit, push, seed, or Alembic
upgrade/downgrade/stamp was performed.

## Implemented and locally tested behavior

All new endpoints require a valid role-specific bearer JWT. Request and
report ownership comes from the token. The service returns FastAPI JSON
errors with a stable `detail` string; 401 denotes absent/invalid or wrong-role
credentials, 403 denotes an unapproved Driver, 404 hides another owner's
record, 409 denotes a lifecycle or capacity conflict, and 422 denotes an
invalid request body or canonical ID.

| Method and path | Request / query | Response and rule |
| --- | --- | --- |
| `POST /student/ride-requests` | JSON `{route_id}` | 201 `{id,route_id,status,created_at,decided_at}`. Route must be active, discoverable, and have a seat at submission time. No enrollment is created. Duplicate pending request or active enrollment returns 409. |
| `GET /student/ride-requests`, `GET /student/ride-requests/{id}` | Student JWT | Current student's requests only; another student's ID returns 404. |
| `GET /driver/ride-requests` | Optional `route_id`, `status` | Requests on the Driver's own routes only; each item adds `student_id` and `student_name`. |
| `GET /driver/ride-requests/{id}` | Driver JWT | Own-route request details only. |
| `POST /driver/ride-requests/{id}/accept` | Driver JWT, no body | `Pending → Accepted`; in one transaction, lock route, reload request, lock/recheck Driver approval and account, count active enrollments, check uniqueness/capacity, update decision/version, insert active enrollment, commit. Full or stale state returns 409. |
| `POST /driver/ride-requests/{id}/decline` | Driver JWT, no body | `Pending → Declined`, with decision time, Driver identity and version update. No seat record. |
| `GET /driver/routes/{id}/enrollments` | Driver JWT | Own-route `{route_id,capacity,occupied_seats,available_seats,students}`; students contain ID, name and enrollment time only. |
| `POST /student/reports`, `POST /driver/reports` | JSON `{type,subject,description,related_route_id?,target_id?}` | Canonical report with `reason=NULL`. Route and optional target must be associated with the reporter. Student/Driver category sets follow their existing forms. No caller-supplied reporter ID. **Blocked on Neon until revision 0006 is applied.** |
| `GET /student/reports`, `GET /student/reports/{id}`, `GET /driver/reports`, `GET /driver/reports/{id}` | Owner JWT | Own reports only. Response includes canonical fields, status, public resolution and a `legacy_fallback` marker. `internal_notes` and `reason` are never returned. |
| `GET /admin/reports/{id}` | Admin JWT | Full review view, including `reason`, `internal_notes`, resolver identity and timestamps. |
| `PATCH /admin/reports/{id}/review` | JSON `{status?,public_resolution?,internal_notes?}` | Admin-only. Valid transitions: Pending → Investigating/Resolved/Dismissed; Investigating → Resolved/Dismissed. Terminal status cannot move backward. Updates `updated_at`; terminal decisions set `resolved_at` and `resolved_by`. |
| `POST /student/route-demand` | JSON `{from_area_id,to_university_id,preferred_time?}` | 201 owner-scoped demand. IDs must be active canonical records. `preferred_time`, if supplied, must contain a timezone. Duplicate active journey returns 409. |
| `GET /student/route-demand`, `GET /student/route-demand/{id}` | Student JWT | Own demand records only. |
| `POST /student/route-demand/{id}/cancel` | Student JWT | `Active → Cancelled` only; subsequent active demand for the same journey may be created. No automatic fulfillment. |

The existing `/admin/reports` and recent-report response shape remains
compatible. Canonical reports use stored subject and description. Legacy
reports use a clearly labeled `Legacy report #<id>` display subject and the
stored `reason` as a read-time description fallback. Existing Admin status
endpoint remains available and now updates resolver/time consistently.
The older Admin-only `/reports/{id}/status` ignores any client-supplied
`admin_id` and uses the authenticated Admin identity.

## Seat integrity and Admin review

All seat counts use only `routestudents.status = ACTIVE`. Pending requests
and route demand do not occupy seats. `available_seats` is capacity minus
this count, clamped to zero in read DTOs. Driver capacity changes and both
Admin route-status paths lock the route row before modifying status or
capacity-related eligibility. The only application path that inserts active
enrollments is the Driver acceptance transaction. Existing Admin route
creation inserts no enrollments and still requires positive capacity and an
approved active Driver; it now also requires active area/university IDs.

A suspended or unapproved Driver is hidden from Student route discovery and
cannot accept requests. Admin route list items now expose a derived
`requires_review` flag and counts of pending requests and active enrollments
on affected routes. This flags existing items for Admin attention without
silently changing their statuses or enrollment rows. There is no persisted
review state in the current schema; a durable review workflow would require
a separately approved design.

## PostgreSQL-specific unverified behavior

Acceptance uses PostgreSQL `SELECT ... FOR UPDATE` on the route row. Two
concurrent acceptance transactions for the final seat should serialize,
then the second should observe the committed active enrollment and receive
409. Partial unique indexes remain defense against duplicate student/route
records, not the capacity mechanism. The dedicated concurrency test uses
only an explicitly configured local `postgresql+psycopg` database whose
name starts with `test_` and host is loopback. It creates and removes its
own temporary schema. `TEST_POSTGRES_URL` was unset, so concurrency and
PostgreSQL transaction behavior are **NOT TESTED**. SQLite TestClient tests
show local flow and rollback behavior only.

## Report migration gate

Prepared revision `20261009_0006`, after `20261009_0005`, changes only
`report.reason` from `NOT NULL` to nullable. It does not copy text, create
tables, alter enums, or touch unrelated columns. Existing historical values
remain unchanged. The downgrade checks for any NULL reason and refuses to
restore `NOT NULL` while canonical reports exist; it never fabricates or
deletes content. The SQLModel field is optional to match the intended
schema. The report creation API checks live column nullability and responds
503 before writing when the migration has not been applied. The legacy
Admin reads remain available.

The reviewed upgrade DDL is `ALTER TABLE report ALTER COLUMN reason DROP NOT NULL`.
The guarded downgrade, after its NULL count preflight, is
`ALTER TABLE report ALTER COLUMN reason SET NOT NULL`. The known
`area.uq_area_name_city` metadata/index mismatch is absent from revision
`0006`.

Revision `0006` was manually reviewed and checked by an AST test. Its
isolated PostgreSQL round-trip test is prepared but **NOT TESTED** because
`TEST_POSTGRES_URL` is unset. It must be reviewed and approved separately,
then applied only to the verified development branch before canonical
report creation is enabled there. No migration was executed in this task.

## Demand policy and deferred decisions

“No suitable route” means no `Active` or `Full` route for the same canonical
area/university pair from an approved, active Driver with active locations.
A full existing route is not converted into route demand: the request returns
409 because route-specific seat waitlisting has no approved policy or table.
Demand is a journey interest record, never a seat queue or reservation.
Creating a route does not automatically mark prior demand `Fulfilled`.
The existing Admin aggregate and analytics continue to count only active
demand records.

Student pending-request cancellation remains unavailable because the approved
`ride_request` enum has only Pending, Accepted and Declined. Treating cancel
as decline would misstate the Driver's decision. A separate product decision
and migration are required before adding cancellation. Existing accepted
enrollments are not silently cancelled when a Driver is suspended.

## Tests and integration blockers

The isolated SQLite/FastAPI suite covers creation, duplicate prevention,
ownership, acceptance, decline, full route, active-only occupancy, rollback
on enrollment insert failure, account suspension, legacy report fallback,
owner privacy, Admin resolution, demand duplicates/cancellation and existing
Phase 4.1/Admin regressions. `uv run python -m pytest -q tests --tb=short`
finished with **25 passed, 6 skipped, 1 dependency deprecation warning**.
PostgreSQL-specific tests are skipped when no guarded
local test database is configured; no mutation test targets Neon.
An unscoped repository-root pytest invocation attempted to collect vendored
dependency tests under `demo-video/python-deps` and failed during collection;
the project test command deliberately targets `tests/`.

Before frontend integration: review/apply revision `0006` on the verified
development branch, load separately approved canonical location records,
run local PostgreSQL concurrency and migration tests, and map the existing
demo UI fields only to supported API responses. No frontend code was changed.

## Files changed in Phase 4.2

`src/admin/models.py`, `src/admin/main.py`,
`src/admin/routers/ride_request_api.py`, `report_api.py`,
`route_demand_api.py`, `journey_api.py`, `admin_api.py`, `router.py`,
`reports.py`, `migrations/versions/20261009_0006_report_reason_nullable.py`,
`tests/test_phase_4_2_api.py`, `tests/test_phase_4_2_postgres.py`,
`tests/test_report_reason_postgres.py`, `tests/test_report_schema.py`,
`tests/test_admin_api.py`, and this report.
