# Report `reason` deprecation plan

## Current dependencies

| Location | Current use of `reason` | Transition impact |
| --- | --- | --- |
| `src/admin/models.py` | Required `Report.reason` column and model field | New canonical-only inserts are blocked by `NOT NULL` until a later migration |
| `src/admin/routers/admin_api.py` | `report_row()` returns `reason` as both `subject` and `description`; Admin list and recent reports call it | Must switch to real columns with labeled legacy fallbacks in Stage B |
| `src/admin/routers/reports.py` | Reads and returns the raw `Report`; status update changes status and resolver, not reason | Admin-only route still serializes reason; review response DTO before removal |
| `tests/test_admin_api.py` | Inserts a legacy report with `reason` and expects it as Admin subject | Keep this compatibility assertion until Stage B adds both legacy and canonical cases |
| `tests/test_report_schema.py` and `tests/test_report_postgres.py` | Create legacy fixtures and check the required column and preserved text | Extend tests as the transition progresses; do not remove history checks |
| `migrations/versions/20261009_0004_reports_complaints.py` | Leaves reason untouched, adds nullable canonical fields, and has no report data update | Safe schema expansion; no duplicated text is written |
| Student and Driver report frontends | Demo forms collect `type`, `subject`, and `description`; they do not read or write reason | Future owner APIs should accept these canonical fields directly |
| Admin Reports frontend | Displays `subject` and `description` supplied by Admin API; it does not access reason directly | API fallback changes can preserve UI shape without changing this UI |

Other repository uses of “reason” concern driver rejection, route disabling,
or suspension and are unrelated to `report.reason`. The current Admin report
status endpoint does not change reason; it ignores supplied notes. No
Student or Driver report creation API writes to the report table today.

## Canonical model

- `type`: validated issue category.
- `subject`: short title supplied for a new report.
- `description`: detailed explanation supplied for a new report.
- `public_resolution`: response visible to the reporter.
- `internal_notes`: private Admin content, excluded from owner DTOs.

`reason` is a temporary legacy compatibility field containing historical
report text. It receives no new business meaning. `report_id` remains the
reporter user ID and is unrelated to this deprecation.

## Stage A — Phase 3.3 schema expansion

Revision `20261009_0004` adds nullable canonical fields and leaves
`reason NOT NULL`. It neither copies reason into `subject` or `description`
nor changes current API behavior. Legacy rows retain exactly their old text
in reason and have `NULL` canonical fields. The prepared migration has not
been applied to Neon in this task.

Stage A deliberately **does not enable canonical-only writes**. A report
created with only subject and description would still violate
`reason NOT NULL`. Do not make clients send duplicate text to satisfy it.

## Stage B — later FastAPI integration

Before deploying a canonical report creation endpoint, create and review a
separate small migration to make `reason` nullable. This is the earliest safe
point to relax it: Stage A must already be applied, old Admin reads must
still tolerate reason, and the service rollout must have read paths that
handle both shapes. Keep the old field in the model as optional during the
rolling transition; do not add a database default or automatically copy
description into it.

Then update Student/Driver creation APIs to derive the reporter ID from
authentication and validate and write `type`, `subject`, and `description`.
For new reports write `reason = NULL`. Update Admin and owner read DTOs:

- New row: return the stored subject and description.
- Legacy row with no subject: return an explicitly labeled display fallback
  such as `Legacy report #<id>`; do not present reason as an invented title.
- Legacy row with no description: return reason as a **read-time** legacy
  description fallback. Do not persist that copy in description during
  normal reads.
- If both reason and a canonical description are present, use the canonical
  value and flag disagreement for later review rather than overwriting it.
- Never expose `internal_notes` through Student or Driver DTOs.

The old Admin list shape can remain `subject` and `description`, while its
values come from this explicit compatibility mapping. The existing Admin
status endpoint must retain its current behavior until its own authorized
resolution update is implemented. No Stage B API or migration is implemented
in this phase.

## Stage C — historical preservation and removal

Only after every creation path uses canonical fields, every reader supports
legacy fallbacks, and old application versions are retired, audit all
`reason` references and production data. Prepare a separate preservation
plan for historical rows. A likely safe candidate is a reviewed migration
that copies `reason` into `description` **only where description is NULL**,
then removes `reason` after row counts and content checks prove every legacy
report remains readable. The copy is temporary within the controlled
transition, not a permanent dual-write policy. Rows with conflicting
non-null reason and description require manual review; do not overwrite
either silently. Keep `subject` null for historical rows unless an authentic
title exists, and continue to label any UI fallback.

Only after that preservation has been verified should a new Alembic revision
drop reason and remove it from the SQLModel and DTOs. Do not combine removal
with revision `20261009_0004` or drop historical text beforehand.

## Risks and required regression tests

- `reason NOT NULL` blocks canonical-only inserts until the Stage B
  nullability migration; test both legacy and canonical writes around rollout.
- Old Admin responses currently duplicate reason into two response fields.
  Test legacy fallback labeling and new stored subject/description separately.
- Test all Admin list/recent/detail and status actions, including older rows.
- Test Student and Driver ownership filters and ensure `internal_notes` is
  absent from every owner response.
- Test mixed-version operation: old report reads, new canonical writes, and
  no automatic dual write to reason.
- Before Stage C, compare legacy report counts and text checksums before and
  after preservation, review rows where both fields differ, and test the
  downgrade or recovery path on isolated PostgreSQL.

Phase 3.3 covers only Stage A schema preparation, focused tests, and this
plan. The nullability migration, canonical report APIs, compatibility DTOs,
and historical backfill/removal belong to later approved work.
