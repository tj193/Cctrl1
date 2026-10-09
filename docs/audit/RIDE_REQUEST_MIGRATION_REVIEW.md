# Ride request migration review

Revision `20261009_0002` follows the stamped baseline `20261009_0001`. It has
been authored manually. It must not be applied until a separate approval.

## Proposed schema changes

- Create PostgreSQL enum `riderequeststatus` with stored labels `PENDING`,
  `ACCEPTED`, and `DECLINED`. The Python API values remain `Pending`,
  `Accepted`, and `Declined`, matching existing SQLModel enum conventions.
- Create `ride_request` with integer primary key, required student and route
  foreign keys, required status and timezone-aware creation time, nullable
  decision time and user foreign key, and positive version defaulting to 1.
- Add a partial unique index on `(student_id, route_id)` for `PENDING` requests.
  Add `(route_id, status, created_at)` for driver inbox queries.
- Add `CHECK (capacity > 0)` to `route`.
- Add a partial unique index on active `routestudents(student_id, route_id)`
  and an occupancy index on `routestudents(route_id, status)`.

The migration reads existing capacities and active enrollment duplicates first.
It fails before DDL if either check detects incompatible data. It does not
change existing rows. Downgrade removes only the new table, enum, indexes,
and check constraint. Neither direction touches `area` or `playing_with_neon`.
The known `area.uq_area_name_city` index/constraint mismatch is intentionally
absent from this migration.

## Request and seat semantics

The database default is `PENDING`; pending and declined requests have no
enrollment row. A declined request remains as history, and a later new pending
request can be inserted for the same student and route. No automatic
resubmission is implemented. An accepted request represents a confirmed seat
only when the later service inserts an active `routestudents` row in the same
transaction. The active partial unique index prevents two active enrollments
for one student and route, while allowing cancelled history. The later request
service must also reject a new request when that student already has an active
enrollment on the route; the pending index alone does not enforce that rule.

Schema constraints alone do not enforce route ownership, driver suspension,
administrative review, or capacity under concurrent acceptance. The later
FastAPI service must, in one PostgreSQL transaction:

1. Lock the route row with `SELECT ... FOR UPDATE`.
2. Verify route status, driver ownership and eligibility, and that the request
   remains pending.
3. Count active `routestudents` rows and reject when capacity is exhausted.
4. Set the request decision and insert its active enrollment, then commit.

All acceptances for the same route must acquire that lock before counting.
The service must also flag existing requests and enrollments for review when
an admin suspends a driver; this phase adds no review fields or behavior.

## Verification and deployment gate

The verified development endpoint had baseline `20261009_0001`, no
nonpositive capacities, and no duplicate active enrollments at read-only
inspection. Values can change, so repeat these checks before an approved
upgrade. Metadata tests compile the PostgreSQL DDL but do not prove runtime
PostgreSQL behavior. The optional integration test requires a local
`postgresql+psycopg` URL in `TEST_POSTGRES_URL`, with a database name beginning
`test_`; it refuses Neon and other remote hosts.

After separate approval, confirm the development snapshot and endpoint again,
then execute only this revision with the temporary write gate removed in
`finally`:

```powershell
$env:DARBGO_ALEMBIC_WRITE_ENDPOINT = 'ep-young-frost-b4g8wmz0'
try {
    uv run --no-sync alembic -c alembic.ini upgrade 20261009_0002
} finally {
    Remove-Item Env:DARBGO_ALEMBIC_WRITE_ENDPOINT -ErrorAction SilentlyContinue
}
```

The command above is documentation only and has not been executed.
