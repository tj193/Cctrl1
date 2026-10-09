# Phase 3.3 reports and complaints migration review

## Current schema and compatibility

Revision `20261009_0004` follows the applied development revision
`20261009_0003`. Read-only inspection found the existing `report` fields:
`id`, `report_id`, `target_id`, `target_type`, `reason`, `status`,
`resolved_by`, and `created_at`. The development table had zero rows during
inspection; this does not justify fabricating values for future or other
environments. The existing reporter, target, and resolver foreign keys remain.
`report_id` retains its name and is the owner user ID. `reason` remains
required and unchanged in this revision solely for compatibility with the
current Admin API and existing rows. It is not a separate long-term report
field. The staged removal plan is in `REPORT_REASON_DEPRECATION_PLAN.md`.

The existing Admin list maps `reason` to both subject and description. Its
status endpoint currently saves status and `resolved_by`, but ignores the
client's notes. This preparation does not change those API responses or
write behavior. The Student and Driver report screens currently save demo
reports in browser storage; they have no owner-scoped backend APIs.

## Proposed schema

- Add nullable `type VARCHAR(32)`, `subject VARCHAR(120)`, and
  `description TEXT`.
- Add nullable `public_resolution TEXT` and `internal_notes TEXT` as
  separate fields.
- Add nullable `related_route_id INTEGER` referencing `route.id`.
- Add nullable timezone-aware `updated_at` and `resolved_at` timestamps.
- Relax `target_id` and `target_type` to nullable for general support and
  route-only reports. The existing target foreign key remains.
- Add indexes on `(report_id, created_at)`, `(status, created_at)`, and
  `related_route_id` for owner lists, Admin queues, and route context.

All new columns default to `NULL`. In particular, neither `subject` nor
`description` is populated from `reason` by this migration. There is no
backfill, duplicate text storage, or fake resolution.
Existing PostgreSQL `userrole` and `reportstatus` enum labels are unchanged.
The revision does not modify `ride_request`, `student_profile`, `route`,
`area`, or `playing_with_neon`. Its only relationship to `route` is the new
foreign key from `report.related_route_id`. The known
`area.uq_area_name_city` mismatch is excluded. No migration ran on Neon.

## Category and target decision

The Student form offers `safety`, `driver`, `route`, `service`, and `other`.
The Driver form offers `route`, `student`, `account`, and `other`. A nullable
validated string is safer than a new PostgreSQL enum because these lists
already differ and historical rows have no category. A later FastAPI
validator should accept a reviewed union of these values; a pickup issue can
use `route` until the product approves a distinct category. `type` describes
the issue, while `target_type` continues to describe an optional **user**
target through the existing `UserRole` enum.

For user complaints, set `target_id` and `target_type` together after
checking that the referenced user's actual role matches. For general
support, both can be `NULL`. For route or pickup issues, use
`related_route_id`; a user target is optional. No historical target values
are changed. Cross-table role consistency and coherent target combinations
belong to the future service, not this migration.

## Ownership, privacy, and status rules for future APIs

- Derive `report_id` from the authenticated user. Ignore client-supplied
  reporter IDs. Student and Driver list/detail queries must filter by that
  ID; Admin review requires Admin authorization.
- Student and Driver response DTOs must never contain `internal_notes`.
  The existing raw `/reports` router is Admin-protected; do not reuse its
  `Report` response model for owner-facing endpoints.
- Keep current statuses `PENDING`, `INVESTIGATING`, `RESOLVED`, and
  `DISMISSED`. A new report starts pending. Review may move it to
  investigating; the current Admin API also permits direct resolution or
  dismissal from pending. Do not reopen a terminal report without an
  explicit product rule.
- On each persisted change, set `updated_at`. On resolution or dismissal,
  set `resolved_at` and `resolved_by` in the same transaction. A public
  response belongs in `public_resolution`; private analysis belongs in
  `internal_notes`. Legacy rows may leave these timestamps and fields null.
- Opening a WhatsApp link is a manual action and does not prove delivery.
  No message-sent column or automated messaging behavior is added.

The database enforces reporter and route existence, but not owner visibility,
target role consistency, Admin authorization, or valid status transitions.

## Legacy reason transition gate

The current `reason NOT NULL` constraint means a future report containing
only canonical `subject` and `description` **cannot yet be inserted**. Do not
solve this by copying description into reason on every new report. Before
enabling the canonical FastAPI write path, prepare a separately reviewed
migration that makes `reason` nullable and update the SQLModel field to match.
Keep legacy Admin reads working during that rollout. Later, return actual
subject/description for new rows; for old rows, label a subject fallback as
legacy and use `reason` only as a read-time description fallback. Historical
text stays in `reason` until a separate verified preservation/backfill plan
allows removal. No Stage B or Stage C code is part of this revision.

## Downgrade and test gate

The downgrade first checks for nullable targets or any non-null values in
the new columns. If found, it stops before DDL so newly entered report
information is not silently discarded. Only after a separate data review
could such a downgrade be planned. With no data requiring review, it removes
the new indexes, foreign key, columns, and nullable relaxations only.

Metadata and isolated SQLite tests cover model compatibility, foreign keys,
nullable fields, status values, timestamps, and separate public/private
content. An optional local PostgreSQL test exercises upgrade, downgrade,
constraints, and the downgrade guard. It accepts only a local
`postgresql+psycopg` URL whose database name begins with `test_`; without
`TEST_POSTGRES_URL`, it is skipped. SQLite does not prove PostgreSQL enum or
migration behavior.

Before approving any future upgrade, run that PostgreSQL test, confirm a
restorable development snapshot, reverify the approved development endpoint,
check that `alembic_version` is exactly `20261009_0003`, inspect the exact
revision and DDL, and repeat a read-only report data/schema check. A separate
approval is required to execute `20261009_0004` on development. The
temporary Alembic write gate must be removed in `finally` after that future
operation.
