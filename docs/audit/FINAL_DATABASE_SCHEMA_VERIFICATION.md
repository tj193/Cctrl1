# DarbGo final development database schema verification

Audit date: 2026-10-09. Scope: the previously approved Neon `development`
endpoint, using read-only PostgreSQL connections and local isolated tests.
No migration, seed, application change, commit, or deployment was performed
as part of this audit.

## 1. Executive summary and decision

**READY WITH DOCUMENTED LIMITATIONS** for FastAPI implementation work.
The ten SQLModel-managed tables exist in the verified development database.
Revision `20261009_0005` is recorded, and live catalog inspection confirms
the requested foreign keys, check constraints, enums, and partial unique
indexes. Alembic's metadata comparison reports only the previously known
`area.uq_area_name_city` representation mismatch. The schema supports
implementation, but the database is empty and PostgreSQL mutation tests
could not run locally. Backend behavior and end-to-end flows are unverified.

This decision is **not** approval to apply another migration, expose APIs,
populate data, or deploy. The blockers for a usable integration environment
are listed below.

## 2. Environment and migration chain

| Result | Evidence |
| --- | --- |
| **PASS** — approved endpoint | `migrations/database.py` reads only `.env.development`, requires `postgresql+psycopg`, TLS, and endpoint ID `ep-young-frost-b4g8wmz0`. The direct read-only connection used that ID. This is the previously user-verified development endpoint; this audit did not independently query the Neon console. |
| **PASS** — read-only session | Every audit connection asserted `SHOW transaction_read_only = on`. The process did not contain `DARBGO_ALEMBIC_WRITE_ENDPOINT`. `alembic.ini` has no database URL. |
| **PASS** — one linear chain | Local Alembic history is `20261009_0001 → 0002 → 0003 → 0004 → 0005`; `heads` returned only `20261009_0005`, and `branches` returned none. |
| **PASS** — live revision | The single `alembic_version` value was `20261009_0005`. Revision alone was not treated as evidence of the schema objects. |
| **PASS** — production boundary | The connection helper refused other endpoint IDs; only the development URL was used for catalog reads. No production connection was opened. |

## 3. Managed table and column inventory

The live `public` schema contains all ten SQLModel-managed tables. There are
no missing managed tables. `alembic_version` is Alembic-owned and
`playing_with_neon` is unrelated; neither is managed by SQLModel.

| Table | Verified columns and relationships | Result |
| --- | --- | --- |
| `user` | `id` PK; `name`, `email`, `password_hash`, `role`, `status`, `created_at` required. Unique `ix_user_email`. | **PASS** |
| `driver_profile` | `id` PK; `Driver_id → user.id`, nullable `reviewed_by → user.id`; contact and document fields retained. | **PASS** |
| `area` | `id` PK; `Area_name`, `city`, `status`, `created_at` required. Live unique index on `(Area_name, city)`. | **WARNING** — index versus model constraint form, below |
| `university` | `id` PK; `University_name`, `status`, `created_at` required; `governorate` nullable. | **PASS** |
| `route` | `id` PK; `driver_id → user.id`, `from_area_id → area.id`, `to_university_id → university.id`; `capacity`, `status`, `created_at` required; `departure_time time`, `return_time time`, `price_iqd int4`, `notes text` nullable. | **PASS** |
| `routestudents` | `id` PK; `student_id → user.id`, `route_id → route.id`; `status`, `joined_at` required. | **PASS** |
| `ride_request` | `id` PK; `student_id → user.id`, `route_id → route.id`, nullable `decided_by → user.id`; enum status and `created_at timestamptz` required; `decided_at timestamptz` nullable; positive integer version. | **PASS** |
| `student_profile` | `user_id` is both PK and FK to `user.id`; nullable `area_id → area.id`, `university_id → university.id`, phone, and `preferred_arrival_time time`. | **PASS** — one row maximum per user, role still service-checked |
| `report` | Legacy `report_id → user.id`, `reason NOT NULL`, status, resolver, creation time retained. Target ID/type nullable. New category/title/detail, public/private response, route FK, and update/resolution times nullable. | **PASS** structurally; **WARNING** canonical-only writes blocked by reason |
| `routedemand` | `id` PK; required `student_id → user.id`, `from_area_id → area.id`, `to_university_id → university.id`, status and `created_at timestamptz`; `preferred_time timestamptz` nullable. | **PASS** |

`information_schema.columns` confirmed the stated live PostgreSQL types and
nullability. Alembic metadata comparison with `compare_type=True` reported
no missing, extra, or differently typed managed columns. Server-default
comparison is disabled in the Alembic configuration, so important defaults
were checked separately: `ride_request.status = 'PENDING'`,
`ride_request.created_at = now()`, and `ride_request.version = 1`.

## 4. Constraints, indexes, and enum definitions

| Result | Live object and catalog definition |
| --- | --- |
| **PASS** | `uq_ride_request_pending_student_route`: unique `(student_id, route_id)` only `WHERE status = 'PENDING'::riderequeststatus`. Declined history is not permanently excluded. |
| **PASS** | `uq_routestudents_active_student_route`: unique `(student_id, route_id)` only `WHERE status = 'ACTIVE'::routestudentstatus`. Cancelled history is permitted. |
| **PASS** | `ck_route_capacity_positive`: `CHECK ((capacity > 0))`. |
| **PASS** | `ck_route_price_iqd_nonnegative`: `CHECK ((price_iqd >= 0))`; nullable legacy price remains allowed. |
| **PASS** | `ck_ride_request_version_positive`: `CHECK ((version > 0))`. |
| **PASS** | `uq_routedemand_active_student_journey`: unique `(student_id, from_area_id, to_university_id)` only `WHERE status = 'ACTIVE'::routedemandstatus`. Cancelled and fulfilled history is permitted. |
| **PASS** | `ix_routedemand_origin_university_status`: btree `(from_area_id, to_university_id, status)`. These two `routedemand` indexes from revision `0005` were verified in `pg_indexes`, not inferred from history. |
| **PASS** | `ix_routestudents_route_status`, `ix_ride_request_route_status_created_at`, `ix_route_driver_status`, `ix_route_origin_university_status`, `ix_student_profile_area_university`, `ix_report_reporter_created_at`, `ix_report_status_created_at`, and `ix_report_related_route_id` exist. |
| **PASS** | `fk_report_related_route`, all three `fk_ride_request_*` foreign keys, all three `fk_student_profile_*` foreign keys, and inherited route, enrollment, demand, reporter, target, and resolver foreign keys reference the intended table/column. |

The live enum labels are `riderequeststatus = PENDING, ACCEPTED, DECLINED`;
`routestudentstatus = ACTIVE, CANCELLED`;
`routedemandstatus = ACTIVE, FULFILLED, CANCELLED`;
`routestatus = ACTIVE, DISABLED, FULL`;
`reportstatus = PENDING, INVESTIGATING, RESOLVED, DISMISSED`;
`userrole = ADMIN, STUDENT, DRIVER`;
`status = ACTIVE, SUSPENDED, PENDING`;
`applicationstatus = PENDING, APPROVED, REJECTED`;
`universitystatus = ACTIVE, DISABLED`. These match the SQLModel enum member
names; user-facing Python values use title case in several models.

## 5. Migration-by-migration findings

| Revision | Finding |
| --- | --- |
| `20261009_0001` | **PASS** — empty baseline recorded, with no business-table DDL. |
| `20261009_0002` | **PASS** — live `ride_request` table, request enum/defaults, active-enrollment index, and capacity check match the reviewed migration. **NOT TESTED** — concurrent Driver acceptance behavior is a future service transaction. |
| `20261009_0003` | **PASS** — four nullable route detail columns, nonnegative price check, profile PK/FKs, and supporting indexes exist. **WARNING** — time-of-day fields do not define operating days or an actual arrival estimate. |
| `20261009_0004` | **PASS** — eight nullable report columns, nullable targets, related-route FK, and indexes exist; `reason` remains required and the status enum is unchanged. The migration contains no reason-to-description backfill. **NOT TESTED** — no historical reports are present to demonstrate preservation with real data. |
| `20261009_0005` | **PASS** — both exact demand index names, columns, uniqueness and predicate were verified live. No route-specific seat-waitlist table was created. |

## 6. Development data inventory and test results

Read-only `count(*)` returned **0 rows** for each managed table:
`user`, `driver_profile`, `area`, `university`, `route`, `routestudents`,
`ride_request`, `student_profile`, `report`, and `routedemand`. The unrelated
`playing_with_neon` table also has 0 rows. Role grouping returned no user
accounts. There are no usable Student, Driver, Route, canonical location,
request, enrollment, report, or demand records for live flow testing.

| Result | Evidence and limit |
| --- | --- |
| **PASS** | 16 isolated model/SQLite tests across revisions `0002`–`0005`. They cover structure, local foreign keys, selected uniqueness/check behavior and compatibility, but do not prove PostgreSQL runtime behavior. |
| **PASS** | Existing Admin API regression: 1 test passed using local SQLite/TestClient. One library deprecation warning occurred; it was not a test failure. |
| **SKIPPED / NOT TESTED** | Four local PostgreSQL tests for upgrade/downgrade, partial indexes, enum behavior, and failure safeguards were skipped because `TEST_POSTGRES_URL` is not configured and the Docker daemon is unavailable. No mutation test ran on Neon. |
| **NOT TESTED** | End-to-end Student registration, authenticated profile writes, Driver acceptance concurrency, report privacy, demand lifecycle, and actual route search: no APIs/data or PostgreSQL test environment currently support these flows. |

Recommend a separately approved **development-only** canonical Iraq
location import with reviewed ID/name mapping, followed by synthetic test
accounts, routes, requests, and reports containing no real student details.
Do not use browser demo IDs as PostgreSQL foreign keys. Define cleanup and
ownership of that fixture set before loading it. No such data was inserted
during this audit.

## 7. Drift, dangerous operations, and deferred decisions

**WARNING — known `area` mismatch.** Live PostgreSQL has a unique index
`uq_area_name_city` on `(Area_name, city)` with no associated unique
constraint. SQLModel declares a `UniqueConstraint` with that name. Alembic
read-only comparison proposed `remove_index` followed by `add_constraint`.
The uniqueness property exists, so this is representation drift, not proof
that duplicate areas are allowed. Never accept these autogenerated operations
without an explicit, separately reviewed migration. No other differences
were reported by the configured comparison; that tool does not establish
semantic equivalence for every server default or runtime behavior.

**WARNING — scheduling.** `route.departure_time` and `return_time` are
nullable daily wall-clock times. There is no service date, operating-day
model, scheduled arrival or validated travel time. The UI's “upcoming” and
estimated-arrival claims cannot be derived from this schema alone.
`routedemand.preferred_time` is a timestamp, while the Student profile uses
an arrival-only `TIME`; the later API must define the relationship rather
than silently coerce one into the other.

**WARNING — demand versus seat waitlist.** `routedemand` records unmatched-
route interest, not a place on a full route. No `route_waitlist` exists.
Route-specific waitlist policy and automation are deferred; waitlist entries
must never be counted as occupied seats.

## 8. Security and integrity work by ownership

### A. Database issues before specific backend write paths

- **BLOCKER for canonical report inserts:** `report.reason NOT NULL` still
  rejects rows containing only `subject` and `description`. A separate,
  reviewed nullability migration and matching model change must precede that
  write path. Follow `REPORT_REASON_DEPRECATION_PLAN.md`; never permanently
  copy description into reason.
- **WARNING for integration fixtures:** empty `area` and `university` tables
  prevent meaningful canonical profile/route writes until a separately
  approved location import or fixture plan exists.
- **NOT TESTED:** PostgreSQL-specific upgrade/downgrade and failure behavior
  on an isolated local `test_` database. Run those tests before treating the
  schema as release-ready.

### B. FastAPI implementation requirements

- **BLOCKER for Student-owned APIs:** `/auth/student-login` returns identity
  fields but no JWT; `security.py` has Admin and Driver guards but no Student
  guard. Implement a Student token/guard before owner-scoped profile, request,
  demand, or report endpoints. Derive student ID from the token, not body IDs.
- **BLOCKER for seat safety:** acceptance must verify Driver ownership and
  eligibility, lock the route row, verify active status and pending request,
  count active `routestudents`, reject full routes, update request and create
  enrollment in one transaction, and handle unique-index conflicts. The
  database's partial indexes do **not** prevent different students from
  concurrently overbooking without the route lock.
- **WARNING:** enforce Student role for `student_profile.user_id`, Driver
  role for `route.driver_id`, canonical location status, target user role,
  status transitions, and object-level read/update permissions in services.
  Foreign keys only prove referenced IDs exist.
- **WARNING:** owner report DTOs must never include `internal_notes`.
  Admin review must authorize the caller and maintain `updated_at`,
  `resolved_at`, and `resolved_by`; a WhatsApp link is not message delivery.
- **WARNING:** use one backend occupancy definition for Student, Driver,
  and Admin. Count active enrollments only; pending requests and demand do
  not reserve seats. Derive demand owners from authenticated context and
  expose aggregates without unnecessary personal data.

### C. Optional/deferred product features

- Route-specific seat waitlist, ordered intermediate stops, real service
  calendar/arrival predictions, and automatic matching are **deferred**.
  Their policy and API contracts need approval before another migration.
- Historical report `reason` removal is a later staged data-preservation
  task. Existing empty development data cannot validate historical cases.

## 9. Prioritized next actions

1. **P0 — FastAPI design gate:** implement Student JWT authentication and
   authorized ownership checks before exposing Student write/read APIs.
2. **P0 — seat integrity:** implement and test route-row locking plus atomic
   request acceptance/enrollment with concurrent PostgreSQL tests.
3. **P0 for report writes:** review and apply a separate `reason`-nullable
   migration before enabling canonical-only report creation.
4. **P1 — verification infrastructure:** provide an isolated local `test_`
   PostgreSQL database and run all four skipped migration tests.
5. **P1 — development data:** approve a canonical location mapping/import
   and synthetic role/route fixtures, then verify end-to-end flows without
   real student data.
6. **P2 — drift and product scope:** document/resolve the `area` index form
   only when a change is justified; decide schedules, ordered stops, and a
   route-specific seat waitlist separately.

The next phase may start with backend implementation under these documented
limits. It must not be described as operationally complete or release-ready
until the blockers and untested behaviors above are resolved.
