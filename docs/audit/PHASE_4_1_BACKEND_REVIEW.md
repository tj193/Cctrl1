# Phase 4.1 backend review: authentication, profiles, routes

Date: 2026-10-09. Scope: FastAPI application code and isolated local tests.
The verified development schema through `20261009_0005` was treated as
read-only context. No Alembic command, Neon write, seed, deployment, commit,
or frontend change was performed.

## Implemented contracts

All protected endpoints require `Authorization: Bearer <JWT>`. Tokens use the
existing HS256 secret, 24-hour expiry, user ID, role, and password-hash digest.
Every protected request checks signature, expiry, current user status, stored
role, and digest. Cross-role requests return 401, preserving the Admin and
Driver guard behavior. Identity for writes comes exclusively from the token.

| Method and path | Request | Response and authorization |
| --- | --- | --- |
| `POST /auth/student-register` | JSON `full_name`, `email`, `password`; optional `phone`, `area_id`, `university_id`, `preferred_arrival_time` | 201 `{id,name,email,role}`. Creates the `user` and `student_profile` rows atomically. Canonical active location IDs required when supplied. Extra fields, including `user_id` and `role`, are rejected. |
| `POST /auth/student-login` | Form `username` (email), `password` | Existing `{name,email,role}` retained and `{access_token,token_type}` added. Suspended and pending accounts cannot sign in. |
| `GET /student/profile` | Student JWT | `{user_id,name,email,phone,area_id,university_id,preferred_arrival_time}`; 404 for a legacy Student without a profile. No hash or internal fields. |
| `PUT /student/profile` | Student JWT and any subset of `phone`, `area_id`, `university_id`, `preferred_arrival_time` | Creates a missing profile or updates the current user's profile; same response as GET. Omitted fields stay unchanged, explicit null clears an optional field. Unknown fields are rejected. |
| `GET /student/areas` | Student JWT | Active canonical areas as `{id,name,city}`. |
| `GET /student/universities` | Student JWT | Active canonical universities as `{id,name,governorate}`. |
| `POST /driver/routes` | Approved, active Driver JWT; JSON `from_area_id`, `to_university_id`, `capacity`, `departure_time`, `return_time`, `price_iqd`; optional `notes` | 201 route representation. Capacity > 0, price >= 0, valid daily times, and active canonical IDs are required. Driver ID comes from JWT. |
| `GET /driver/routes`, `GET /driver/routes/{id}` | Approved, active Driver JWT | Own route representations only; another driver's ID returns 404. |
| `PATCH /driver/routes/{id}` | Approved, active Driver JWT; any subset of creation fields | Own route only. Required route fields cannot be cleared, capacity cannot fall below current active enrollment count, and location changes require active canonical IDs. Status is not writable here. |
| `PATCH /driver/routes/{id}/disable` | Approved, active Driver JWT | Sets own route status to `Disabled`; this endpoint does not reactivate routes. |
| `GET /student/routes` | Student JWT; optional `from_area_id`, `to_university_id`, `status` query | Only `Active` or `Full` routes from approved, active Drivers and active locations. `status=Disabled` returns an empty list. IDs must denote active catalog records. |
| `GET /student/routes/{id}` | Student JWT | Same visibility rule; hidden or missing route returns 404. |

The route representation is `{id,driver_name,from_area_id,origin_area,
to_university_id,destination_university,departure_time,return_time,price_iqd,
capacity,occupied_seats,available_seats,status}`. Time values are daily
wall-clock times (`HH:MM:SS`); price is integer IQD. Nullable time and price
values can appear in older Admin-created routes because the existing schema
allows them. `occupied_seats` counts only `routestudents.status = ACTIVE`;
pending ride requests and `routedemand` do not reserve seats. Available seats
are clamped to zero if legacy data already exceeds capacity. No arrival
estimate, service-day calendar, vehicle details, stops, or geographic path is
invented.
Driver route responses additionally include the editable `notes` field;
Student search and detail responses omit it.

## Existing behavior and frontend integration

- Admin login, Driver registration/login/approval, Admin route operations,
  and Admin-protected router paths retain their existing request and response
  contracts. The Student login response grows by two token keys.
- Existing Student registration and route-search pages still use local demo
  data. A later frontend phase must submit canonical numeric catalog IDs,
  call Student login using form-encoded credentials, retain the bearer token,
  and map route cards only to fields actually returned above. Custom text
  locations cannot be submitted as foreign keys.
- Existing Driver route pages still use local preview data. A later frontend
  phase must use the Driver JWT, canonical IDs and required route fields.
  The API does not accept demo stop arrays or service-day claims.
- `GET /student/routes` is Student-authenticated; no public anonymous route
  catalog was added. The Student sees only route and Driver display data.
  Driver and Admin operational fields are excluded from these DTOs.
- A suspended Driver's routes are hidden immediately by discovery filtering.
  This phase does not flag existing requests/enrollments for review or build
  acceptance logic; those workflows belong to a later phase.

## Verification

`uv run python -m pytest -q tests/test_phase_4_1_api.py
tests/test_admin_api.py tests/test_ride_request_schema.py
tests/test_route_student_profile_schema.py tests/test_report_schema.py
tests/test_waitlist_demand_schema.py` completed with **19 passed** and one
Starlette/httpx deprecation warning. These use local SQLite databases and
FastAPI TestClient, including Student registration/token/guard/profile,
location validation, Driver approval/ownership, route validation, search,
seat counts, and Admin/Driver auth regressions. No test used Neon. Existing
PostgreSQL-specific migration tests remain unrun because an isolated local
PostgreSQL test URL is unavailable; SQLite does not prove PostgreSQL enum or
concurrency behavior.

## Remaining limits and next phase

- Development `area` and `university` tables were empty at the last read-only
  audit. Real profile and route writes require separately approved canonical
  catalog data. No data was inserted in this phase.
- Route creation checks application approval and account status at request
  time; later Ride Request acceptance must recheck these conditions and lock
  the route while reserving seats. This phase creates no request or report API.
- The Admin route creation path predates this phase and permits nullable route
  detail fields. It was preserved to avoid changing existing Admin behavior.
- No PostgreSQL-backed API test or browser integration test ran. A local
  isolated PostgreSQL fixture and later frontend work are needed before an
  end-to-end readiness claim.

## Files changed in Phase 4.1

`src/admin/security.py`, `src/admin/catalog.py`,
`src/admin/routers/Authentications.py`, `src/admin/routers/student_api.py`,
`src/admin/routers/journey_api.py`, `src/admin/main.py`,
`tests/test_admin_api.py`, `tests/test_phase_4_1_api.py`, and this report.
