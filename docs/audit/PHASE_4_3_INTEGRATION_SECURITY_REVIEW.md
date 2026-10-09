# Phase 4.3 integration and security review

Date: 2026-10-09. Scope: source research, read-only development preview,
offline synthetic planning and existing-code verification. No production
connection, database write, migration, frontend edit, commit, push or deploy.

## Environment and outcome

The endpoint validator loaded only `.env.development`, required
`postgresql+psycopg`, TLS and endpoint ID `ep-young-frost-b4g8wmz0`, and
converted a pooled host to its direct host. The SQL session asserted
`transaction_read_only=on`; revision `20261009_0006` and nullable
`report.reason` were confirmed. All ten managed tables and unrelated
`playing_with_neon` were counted read-only; each held zero rows.
No credentials or connection strings were printed.

The live database is structurally ready for existing Phase 4.2 APIs, but is
not a complete demonstration environment. Five official university
candidates are previewed; zero verified area candidates are available.
Consequently no routes, request flows or user fixtures can be safely seeded.
The restorable state of a **current** development snapshot remains unverified.

## PostgreSQL and API test evidence

`TEST_POSTGRES_URL` is unset and `psql` is unavailable. The guarded test in
`tests/test_phase_4_2_postgres.py` would run only against loopback
`postgresql+psycopg` with database name beginning `test_`, inside its own
temporary schema. Thus simultaneous final-seat acceptance, one-success/one-
conflict behavior, PostgreSQL row locking, rollback/partial transaction
safety, foreign keys and migration round trip are **NOT TESTED** on PostgreSQL
in this phase. No mutation test targeted Neon.

Existing SQLite/FastAPI tests exercise JWT validation, suspension, role and
ownership boundaries, report privacy, route demand, request acceptance and
rollback logic. They cannot establish PostgreSQL concurrency semantics or
cross-role browser integration. The scoped local command
`.venv/Scripts/python.exe -m pytest -q tests --tb=short` completed with
**27 passed, 6 skipped, 1 dependency deprecation warning**. The two new
Phase 4.3 tests check deterministic synthetic identities and conservative,
repeatable catalogue comparison. The six skips include PostgreSQL-only tests.

## Security and data integrity findings

- Driver acceptance locks the route row and checks active enrollments; pending
  requests and demand are not reserved seats. A local PostgreSQL race test is
  still required before claiming concurrency proof.
- Student and Driver endpoints derive owner identity from JWT and filter own
  records. The owner report DTO omits private `internal_notes`; Admin review
  includes them. Isolated TestClient coverage exists, but no seeded Neon API
  end-to-end test was run.
- Synthetic plan uses only `example.test` accounts and stores no passwords,
  phone numbers or document images. It cannot accidentally create users.
- Existing UI demo identifiers such as `demo-route-1`, `101` and `201` are
  local preview keys, not PostgreSQL IDs. Never send them to API foreign keys.
- `area` metadata/live unique-index representation mismatch remains known;
  no schema change or Alembic autogeneration occurred.

## Next verification sequence

1. Supply an isolated local PostgreSQL `test_` instance, run the guarded
   concurrency/migration tests, and verify the exact test outcomes.
2. Inspect a licensed government area file and settle district-versus-pickup
   semantics; complete the catalogue preview and resolve conflicts.
3. Confirm a current, restorable Neon development snapshot.
4. Review an idempotent transactional importer/seeder and its dry run, then
   request **separate approval** for the first development import.

No first import was attempted or approved by this review.
