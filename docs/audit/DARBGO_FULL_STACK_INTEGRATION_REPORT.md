# DarbGo development integration: approval gate report

Historical pre-import review. For the completed development import and live verification, see `DARBGO_MVP_LIVE_VERIFICATION.md`.

Date: 2026-10-09. Classification: **BLOCKED — ACTION REQUIRED** for the complete live demonstration. Local integration code is prepared, but Neon development has not been seeded and no live cross-role end-to-end run has occurred. The user explicitly declined development writes until recovery is verified and a final import approval is given.

## 1. Environment, schema, and recovery

- Git branch: `tj`. The checkout already contained numerous uncommitted and untracked Phase 1–4 changes before this task; none were committed, pushed, merged, or deployed.
- The connection helper reads only the ignored `.env.development`, requires `postgresql+psycopg`, TLS, and endpoint ID `ep-young-frost-b4g8wmz0`; it switches a pooled hostname to that same endpoint's direct hostname. The live comparison used this helper in a transaction asserting `transaction_read_only=on`. No production URL or credential was read by this comparison or printed.
- Neon development is at exactly `20261009_0006`. No migration was executed. Unapproved `20261009_0007` remains unapplied; the checked-in catalogue fits the existing `area` and `university` tables.
- The older manual snapshot predates the current schema. A **fresh restorable recovery point at revision `20261009_0006` has not been confirmed**. The user confirmed there is no newer snapshot and declined development writes. The older snapshot was left unchanged.
- `pg_dump` is not available in the current local shell. No software was installed. A short Neon point-in-time restore window is not a durable substitute for a verified recovery point throughout implementation. Neon's current [branching documentation](https://neon.com/docs/get-started-with-neon/workflow-primer) describes data-inclusive branches as isolated copies of schema and data; its [snapshot documentation](https://neon.com/blog/three-ways-to-use-your-snapshots) describes restorable read-only snapshots. A **data-inclusive branch cloned from the current development branch** may be a no-install recovery option that preserves the older snapshot, subject to the actual account's branch quota and a read-only verification of revision, endpoint, schema, and row counts. No such clone has been created or verified; no Neon Console access or project entitlement was assumed. Do not treat this proposal as a confirmed backup.
- The published [Free plan description](https://neon.com/blog/neon-free-plan-1-gb-per-project) mentions ten branches and a six-hour instant restore window, but the user's actual plan, free slots, and restore setting have not been verified. No plan change or old snapshot deletion is proposed.
- Local PostgreSQL concurrency testing remains unavailable; no final-seat race result can be claimed.

## 2. Reference catalogue dry run

`tools/import_existing_catalogue.py --development` read the checked-in project catalogue and compared it with verified development in read-only mode.

| Table | Existing | Exact matches | Proposed inserts | Proposed updates | Conflicts / duplicates |
| --- | ---: | ---: | ---: | ---: | --- |
| `area` | 0 | 0 | 270 | 0 | 0 |
| `university` | 0 | 0 | 166 | 0 | 0 |

The source has 19 governorate display choices, represented through `area.city` and `university.governorate`; no governorate table or migration is needed. Source relationships, empty lists, exact/normalized duplicates, generated-versus-source university equality, and global university-name uniqueness were reviewed in `EXISTING_CATALOGUE_REUSE_REVIEW.md`. PostgreSQL assigns integer IDs; browser slugs and demo IDs are never inserted as foreign keys. The importer is idempotent, insert-only, and guarded by endpoint/revision/count checks and a single transaction. Its write path has **not** been run or locally tested against PostgreSQL.

## 3. Synthetic fixture dry run

`tools/seed_development_demo.py` prepares deterministic fictional records and resolves all area/university IDs from exact Arabic name and governorate pairs. It reports **54 proposed rows** after the catalogue exists:

| Table | Planned inserts |
| --- | ---: |
| `user` | 18: one Admin, five Drivers, twelve Students |
| `driver_profile` | 5 |
| `student_profile` | 12 |
| `route` | 4 |
| `ride_request` | 7: three Pending, two Accepted, two Declined |
| `routestudents` | 2 active enrollments matching Accepted requests |
| `report` | 3 |
| `routedemand` | 3 unmatched journeys |

Three Drivers are approved and active, one is pending, and one approved Driver is suspended. Only active approved Drivers own the four routes. Fictional `.test` emails and non-dialable `DEMO-*` contact/document placeholders are used; no real identities or document images are included. Passwords are prompted locally only for a separately approved seed, hashed with the existing helper, and never printed or stored by the script. The fixture transaction refuses a preexisting nonfixture Admin, incomplete fixture, missing or ambiguous catalogue choices, or a revision mismatch. Repeat runs recognize the full fixture and propose zero inserts.

Because the catalogue is not imported yet, the seed's direct development preview correctly stopped on missing canonical area keys. The 54 rows are the exact reviewed *planned* fixture after the 436 catalogue rows are imported; they are not existing Neon records. No seed write was attempted.

## 4. Local frontend and backend preparation

- Added public read-only active area/university endpoints for registration before authentication.
- Student registration now sends canonical integer IDs to FastAPI; the original Iraq map, governorate → area → university flow, and Arabic labels remain. The university list now includes all 166 choices regardless of home governorate. Free-text `Other` choices remain visible but submission explains that the backend cannot save them yet.
- Shared login now uses Student/Driver JWT endpoints. Browser-only account login is limited to explicit `?demo=1`. Live Student screens read profile, routes, requests, accepted rides, and route demand from authenticated APIs. They use the server's seat counts and show no fabricated notifications. Student reports use owner APIs and show only public resolutions.
- Live Driver screens read routes, incoming requests, active enrollments, and own reports from authenticated APIs. Route create/update/disable and request accept/decline call the existing endpoints. Unsupported Driver opportunities and profile editing are identified as unavailable. Existing Admin pages, logo, and routes were not redesigned; Admin report review now retrieves full report details and writes public resolution and private notes separately through the existing review API. Dynamic report text is escaped before insertion into the Admin table and detail panel.
- All live mutating controls disable during a request and refresh relevant data after success. Session failures clear tokens and return to login. The backend, not browser storage, controls identity, approval, ownership, and seat state.

Connected local pages: Student registration, shared login, Student journey/routes/requests/waitlist/upcoming/reports, and Driver dashboard/routes/create/requests/students/reports/profile/opportunities (unsupported message). Admin pages were already API-connected and were not changed here. This is code integration, **not** a verified live three-role demonstration.

## 5. Verification

- Isolated Python suite: **40 passed, 6 skipped**, one dependency deprecation warning. The six skips include PostgreSQL-only checks. Run the full suite again after the approval phase.
- Offline catalogue and fixture plan unit tests: **6 passed**.
- New public catalogue API test: **1 passed** against isolated SQLite. A full local `TestClient` scenario with isolated SQLite also passed: Student registration and JWT login, pending Driver rejection, Admin approval, Driver route creation, Student discovery, two pending ride requests without seat reservation, duplicate request rejection, first acceptance, second acceptance rejection when full, ownership checks, Admin and Driver occupancy, public report resolution visibility and private note protection, and route demand.
- Syntax checks passed for changed JavaScript and Python files; `git diff --check` found no patch whitespace errors. The fixture script's default offline plan still proposes exactly 54 rows and does not connect to a database.
- Browser checks on the local static server: registration map and governorate selection loaded; after choosing Baghdad, the UI displayed **166 of 166** universities; the login page displayed a clear API-unavailable error; Student and Driver protected pages returned to login without tokens. No registration or booking form was submitted.
- **Not executed:** seeded Neon API scenario, real browser cross-role flow, network-failure recovery on every page, local PostgreSQL row-lock race test, and transactional importer against local PostgreSQL. Admin approval and public/private report visibility were tested only through isolated SQLite APIs. Do not label them as verified in Neon or a live browser.

## 6. Risks and remaining work

1. Resolve recovery without deleting the older snapshot or changing plans: either verify a current restorable snapshot or, if the actual Neon project has a free branch slot, manually create a **data-inclusive** recovery branch from the current `development` branch and verify its revision and schema through its own endpoint. A schema-only branch is insufficient. No clone has been created in this task.
2. Once recovery is independently verified, present **one final approval request** covering the reviewed **270 area + 166 university** insert transaction and **54 fictional fixture rows**. The user has explicitly withheld this approval for now. After approval, rerun read-only previews before any write and verify counts/IDs after each transaction.
3. Obtain runtime passwords securely for the preconfigured fixture accounts only at the separately approved execution time. Verify all role states, foreign keys, seat counts and rerun idempotence preview.
4. Start FastAPI with an explicitly selected development URL; never let its general `.env` loading choose production. Perform the full 17-step scenario and negative cases in a local browser against development, recording each actual result.
5. Obtain an isolated local PostgreSQL test database and run the final-seat concurrency test. Until then row-level locking exists in code but race safety is not proven by PostgreSQL test evidence.
6. Review any frontend presentation gaps discovered in browser testing. The live Student dashboard uses simpler API-driven cards and does not yet reproduce every decorative demo journey element; the original Iraq registration map remains intact.

Security notes: no Neon writes or migrations were performed in this task; no secrets were printed or committed. `playing_with_neon` was not touched. Any future cleanup must first identify exactly the `phase43-*@example.test` fixture users and their dependent fixture rows, confirm no nonfixture records refer to those IDs, and delete dependents before users in one separately approved transaction. Never run a broad wildcard delete or remove real records.

## 7. Changed files in this task

Backend: `src/admin/main.py`, `src/admin/routers/public_catalogue.py`.

Frontend: `student/register.html`, `student/registration.js`, `login.html`, `js/auth/login.js`, `student/api.js`, `student/dashboard.js`, `student/live-dashboard.js`, `student/dashboard.html`, `student/routes.html`, `student/requests.html`, `student/waitlist.html`, `student/upcoming.html`, `student/reports.html`, `student/reports.js`, `student/reports-service.js`, `driver/app.js`, `driver/live-app.js`, the eight Driver HTML screens that load it, `admin/front-end/adminReports.html`, `admin/JS-file/main.js`, and `admin/JS-file/reportService.js`.

Preparation/tests: `tools/seed_development_demo.py`, `tests/test_demo_seed_plan.py`, `tests/test_demo_seed_sqlite.py`, `tests/test_local_cross_role_scenario.py`, `tests/test_phase_4_1_api.py`, this report.

## 8. Demo execution after approval

Use the project's Python environment, set `DATABASE_URL` explicitly from `.env.development` for the API process, and provide a local `JWT_SECRET` without committing it. Run FastAPI at port 8000 and the static frontend at port 5174. Authenticate with the seed credentials entered locally at execution time. Do not use a production URL or manually paste secrets into browser query strings. Exact commands and final verification results will be added after the approval gate.
