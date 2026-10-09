# DarbGo MVP live development verification

Date: 2026-10-09. Git branch: `tj`.

## Completed

- `.env.backup` is Git-ignored. Read-only verification found distinct Neon endpoints and branch IDs, revision `20261009_0006`, identical public schema fingerprints, and matching pre-import row counts. No restore operation was performed.
- The catalogue preview proposed exactly 270 areas and 166 universities, with zero conflicts. The guarded import inserted them into `development`; the repeat preview proposed zero inserts.
- The guarded fixture import inserted 54 fictional rows: 18 users, 5 Driver profiles, 12 Student profiles, 4 routes, 7 ride requests, 2 enrollments, 3 reports, and 3 route demands. Generated role passwords are kept only in ignored `.artifacts/demo-credentials.json`.
- FastAPI ran against the verified development endpoint. Local port 8000 refused binding; the API and frontend clients now use 8001. The static frontend uses 5174.
- Live HTTP smoke passed for all three role logins, invalid-token and role guards, Admin Driver approval, suspended Driver denial, Driver request acceptance, cross-role seat counts, full-route rejection, and report privacy.
- The live smoke intentionally approved one pending Driver and accepted one pending request. Final read-only checks found development counts: `area` 270, `university` 166, `user` 18, `driver_profile` 5, `student_profile` 12, `route` 4, `ride_request` 7, `routestudents` 3, `report` 3, `routedemand` 3. Request statuses: 2 Pending, 3 Accepted, 2 Declined. Seat and owner relationships passed. Backup revision, schema, and original empty business tables remained unchanged.
- Focused isolated tests: 18 passed. Earlier full suite: 40 passed, 6 skipped. Browser smoke showed the registration map and 166 university choices; an invalid login reached the API and showed an authentication error.

## Remaining limits

- A simultaneous final-seat test on isolated PostgreSQL remains unverified.
- The full authenticated browser journey was not automated; passwords were kept out of browser tool calls. The equivalent live HTTP workflow passed.
- The live Student content is simpler than the prior demo artwork, while the existing page shell and registration map remain.

## Local run

From the repository root:

```powershell
$env:PYTHONPATH='C:\Users\lenovo\Cctrl1\.venv\Lib\site-packages'
& 'C:\Users\lenovo\AppData\Local\Programs\Python\Python313\python.exe' tools/run_development_api.py
```

In another terminal:

```powershell
& 'C:\Users\lenovo\AppData\Local\Programs\Python\Python313\python.exe' -m http.server 5174 --bind 127.0.0.1
```

Open `http://127.0.0.1:5174/login.html`. Fictional emails are in `tools/phase43_synthetic_plan.py`; role passwords are in ignored `.artifacts/demo-credentials.json`. No production, backup branch, or existing snapshot write occurred. Migration `20261009_0007` was not applied. No commit, push, or deployment occurred.
