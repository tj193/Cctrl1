# Phase 3.4 waitlist and demand integrity review

## Decision

The current Student “Join waitlist” action follows **no suitable route** and
stores only browser session state. It is a route-demand signal, not a place
in a specific vehicle. Reuse `routedemand` for this Scenario A after a future
owner-scoped API and canonical location catalogue are available.

A full existing route is Scenario B. The current Student UI has no route-
specific seat-waitlist action, priority rule, cancellation process, or
promotion workflow. No `route_waitlist` table, status, or automatic seat
allocation is introduced in this MVP preparation. If approved later, it
needs a separate product decision and migration; a waitlist entry must never
reserve a seat or automatically create an accepted request/enrollment.

## Existing schema and field meanings

Read-only verification of the approved Neon development endpoint found
Alembic revision `20261009_0004`, zero `routedemand` rows, zero `area` rows,
and zero `university` rows. The existing demand table has:

| Field | Meaning and current limit |
| --- | --- |
| `id` | Primary key for an individual demand record, not a queue position |
| `student_id` | Required foreign key to `user.id`; role is not checked by the database |
| `from_area_id` | Required foreign key to canonical `area.id` |
| `to_university_id` | Required foreign key to canonical `university.id` |
| `preferred_time` | Nullable `timestamptz`; its intended meaning is not specified by current Student API, and it must not be treated as the registration form's arrival-only `TIME` without a contract decision |
| `status` | Existing `ACTIVE`, `FULFILLED`, `CANCELLED` PostgreSQL enum; no Student lifecycle endpoint currently changes it |
| `created_at` | Required timezone-aware creation timestamp; not a promised seat or service date |

The table already has student, area, and university foreign keys and a
primary key. It is not a route-specific seat queue and has no `route_id`.
The proposed migration changes neither columns nor enum labels.

## Existing implementation versus demo behavior

- Student search and no-match state use static route samples. Clicking Join
  waitlist sets a `joined` flag in `sessionStorage`; it does not insert a
  `routedemand` row. “New match” is also a demo flag, not a backend event.
- Student seat requests and confirmation in the dashboard are demo state.
  The real `ride_request` and `routestudents` tables exist, but the approved
  Driver acceptance transaction and role-scoped APIs are not implemented.
  The demo's extra Student confirmation step must not be treated as the
  database seat-reservation rule; the agreed rule reserves on Driver accept.
- Driver dashboard counts accepted demo requests and subtracts them from
  demo route capacity. Live driver route and demand APIs are unavailable.
- Admin `/admin/route-demand` groups active demand by origin and university
  and reports `len(group)` as `student_count`. Analytics returns individual
  active records with route coverage. These are demand records, not seats.
  The Admin endpoint can still show demand where a route exists; future
  service behavior must define when demand is fulfilled.
- The existing Admin route creation API does not create or fulfill demand.
  The Admin route list counts active enrollments, not demand or requests.

## Proposed revision and integrity boundaries

Revision `20261009_0005` follows `20261009_0004`. It adds only:

1. Partial unique index on
   `routedemand(student_id, from_area_id, to_university_id)` where
   `status = 'ACTIVE'`. It allows historical `CANCELLED` and `FULFILLED`
   rows and a later new active application for the same journey.
2. Index on `(from_area_id, to_university_id, status)` for Admin demand
   grouping and future search.

The upgrade checks for duplicate active student/journey groups before any
DDL and fails without rewriting data if they exist. Concurrent writes that
race the check will still be stopped by index creation or its unique rule.
The downgrade drops only these two indexes and preserves every row. No
columns, tables, enum values, previous indexes, or location data are changed.
The migration avoids `playing_with_neon` and the unrelated
`area.uq_area_name_city` mismatch. No Neon migration was executed here.

Existing `ride_request` already has a partial unique index for one pending
request per student/route. `routestudents` already has a partial unique index
for one active enrollment per student/route. `route` already has positive
capacity and nonnegative nullable price checks. `student_profile` already
has foreign keys to user, area, and university. Revision `0005` does not
recreate any of those objects.

## Future backend behavior and counts

- Derive the student ID from authenticated context for demand creation,
  cancellation, and list operations. Check the account has Student role and
  ensure area/university IDs are canonical, enabled, and appropriate.
- An active demand represents one student seeking a route between one area
  and one university. Do not count it as a pending seat request or occupied
  seat. The creation API must decide what "no suitable route" means and
  avoid recording demand as a full-route seat queue. `FULFILLED` must mean a
  separately defined demand outcome, not an accepted seat by implication.
- A Driver may see only authorized route-relevant aggregated demand, with
  minimal student information. Admin analytics require Admin authorization.
  Public aggregates should not reveal reporter identity or contact details.
- Seat availability is `route.capacity - count(active routestudents)` for
  eligible active routes, clamped for display and verified transactionally
  before acceptance. Pending ride requests and demand never reserve seats.
  Student, Driver, and Admin responses should use the same backend count
  rule rather than their separate browser demos.
- Acceptance must check Driver ownership and eligibility, lock the route
  row, verify route status, pending request, active enrollment count and
  available capacity, then update the request and insert the active
  enrollment in one transaction. A unique-index conflict must be handled
  safely. No acceptance workflow is implemented in this phase.

The database cannot enforce user role, route ownership, visibility,
cross-table capacity, or the meaning of `FULFILLED`. Those belong to
authorized FastAPI services. The partial demand index enforces only the
single-active-journey invariant.

## Canonical location and testing gate

The development location tables are empty. Frontend catalogue strings and
browser IDs are not canonical PostgreSQL foreign keys. A reviewed catalogue
mapping/import is a separate development-data task; no automatic seed or
conversion is part of this migration.

Isolated SQLite tests check existing foreign keys, active uniqueness, and
inactive history behavior. An optional PostgreSQL round-trip test uses only
an explicitly configured local `postgresql+psycopg` `test_` database and
checks preflight failure, partial uniqueness, preserved rows, and downgrade.
When that local database is unavailable the test is skipped; SQLite does not
prove PostgreSQL enum or partial-index runtime behavior.

## Migration approval checklist

- [ ] Run the isolated PostgreSQL migration test and inspect its results.
- [ ] Confirm a restorable Neon development snapshot and the verified
      endpoint; never substitute production credentials.
- [ ] Confirm `alembic_version` is exactly `20261009_0004` and inspect the
      complete `20261009_0005` script and intended indexes.
- [ ] Repeat the read-only duplicate-active-demand preflight and review any
      conflicting rows without automatic deletion or merging.
- [ ] Confirm the route-demand uniqueness rule remains the approved product
      policy and that canonical location IDs are available for future APIs.
- [ ] Obtain separate approval before any `upgrade`, then verify revision,
      indexes, and unchanged row counts; remove temporary write authorization.

This phase stops at schema preparation. It does not apply revision
`20261009_0005`, write Neon records, implement APIs, or start Phase 3.5.
