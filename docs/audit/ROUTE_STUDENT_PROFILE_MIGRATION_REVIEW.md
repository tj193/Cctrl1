# Phase 3.2 route and student profile migration review

## Scope and current state

Revision `20261009_0003` follows `20261009_0002`. A read-only check of the
verified Neon development endpoint found revision `20261009_0002`, the
`ride_request` table, seven original `route` columns, and no `student_profile`.
The development `area` and `university` tables each currently contain zero
rows. No Neon writes were made for this preparation.

## Proposed schema

- Add nullable `route.departure_time TIME`, `return_time TIME`,
  `price_iqd INTEGER`, and `notes TEXT`. All legacy routes retain `NULL`.
- Add `CHECK (price_iqd >= 0)`; PostgreSQL allows `NULL` for legacy rows.
- Add route indexes on `(driver_id, status)` and
  `(from_area_id, to_university_id, status)` for route management and matching.
- Create `student_profile` with `user_id INTEGER` as both primary key and
  foreign key to `user.id`, nullable `phone`, nullable `area_id` and
  `university_id` foreign keys, and nullable `preferred_arrival_time TIME`.
  Index `(area_id, university_id)` for profile matching.

No existing columns, data, enums, or foreign keys are changed. The migration
does not touch `ride_request`, `playing_with_neon`, or the known unrelated
`area.uq_area_name_city` index mismatch. Downgrade removes only the objects
added here; it would discard newly entered route detail and profile data, so
it requires a separate data review before any future execution.

## Interface and contract findings

Student registration collects home governorate, area, university, preferred
**arrival** time, full name, email, phone, and password. This phase stores
only the profile fields needed for matching and contact. Name, email, role,
and password hash already belong to `user`; no plaintext password, gender,
seat preference, or registration notes are copied into the profile. The
current registration uses browser demo storage; no profile is backfilled from
it. No student registration/profile API exists yet.

The driver preview form requires departure time, return time, capacity, and
nonnegative IQD price, with optional notes. These should become required for
**new driver-published routes** in a later Driver API, while the database
columns remain nullable for legacy routes and the current Admin API contract.
The Admin route creation API currently accepts only area, university, driver,
and capacity; this phase leaves it unchanged.

`TIME` values are local wall-clock times for a proposed recurring schedule.
They do not identify a service date or operating days. The student demo shows
days and estimated arrival, but those are not persisted by this migration.
Do not label a route as an actual upcoming departure from these fields alone.
Match first by canonical area and university IDs. The preferred arrival time
cannot be compared reliably with a driver's departure time without a real
arrival schedule or validated travel duration; do not infer one from demo
data. A later scheduling decision is needed before time-based ranking.

## Canonical location mapping

The registration catalogue uses governorate slugs, Arabic area names, and
university display entries; its IDs are browser catalogue IDs, not database
IDs. The database uses integer `area.id` and `university.id`, with `area.city`
and `university.governorate` as text. A later API should return canonical IDs
and localized labels, and submit those IDs for profile creation. Build and
review a mapping by governorate plus normalized area name, and by university
name plus governorate. Never coerce a browser slug or demo ID into a database
foreign key. Custom `Other area` or `Other university` entries need a review
workflow rather than silent creation or renaming. The development tables are
empty, so no existing location match can currently be verified; no names were
renamed or inserted.

## Stops decision

The Driver Create Route preview contains an optional multi-select for
intermediate stops and My Routes displays a list. The selection has no
explicit ordering control, and live route publication is disabled. Student
Route Details currently shows pickup and destination information without an
ordered intermediate-stop itinerary. Therefore `route_stop` is deferred until
the product and API define stable ordering and canonical stop IDs. No GPS,
geospatial, or travel-time fields are introduced.

## Database versus service checks

The primary key enforces one profile per user. Foreign keys enforce that
referenced user, area, and university IDs exist. The route check rejects a
negative non-null price. These constraints cannot prove that a referenced
user has the `Student` role, or that the authenticated caller owns the
profile. The future FastAPI service must check both inside its authorized
profile creation/update flow, validate phone and canonical location status,
and avoid plaintext password storage. Profile creation must not change the
existing student or driver authentication paths.

## Verification and approval prerequisites

Metadata and isolated SQLite tests cover nullability, types, foreign keys,
one-to-one behavior, and the price check. The optional PostgreSQL round-trip
test accepts only a local `postgresql+psycopg` URL whose database begins with
`test_`; it is skipped unless `TEST_POSTGRES_URL` is provided. SQLite results
do not prove PostgreSQL migration behavior.

Before separately approving execution on development:

1. Run the isolated PostgreSQL round-trip test and review its result.
2. Confirm a restorable development snapshot and verify the approved endpoint.
3. Verify `alembic_version` is exactly `20261009_0002` and inspect this
   revision's `upgrade` and `downgrade` once more.
4. Recheck that no migration conflicts or location-data assumptions have
   arisen; accept that existing route detail values remain `NULL`.
5. Grant temporary Alembic write authorization only for the specific approved
   upgrade, then remove it in `finally` and verify the resulting schema.

No `upgrade` or `stamp` was executed in this phase.
