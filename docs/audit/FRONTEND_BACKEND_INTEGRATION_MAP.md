# Frontend to backend integration map

Prepared 2026-10-09. No frontend was modified. Every browser request below
must send its role-specific JWT. IDs from API catalogues replace local demo
keys; the backend remains the authority for ownership and seat state.

| UI and current source | Target API / mapping | Unsupported or gated fields |
| --- | --- | --- |
| Student registration and account (`student/registration.js`, `student/dashboard.js`) | `POST /auth/student-register`, `POST /auth/student-login`; `GET`/`PUT /student/profile`. Derive current user from JWT, not browser `loggedInUser`. | Existing dashboard is driven by `DarbStudentDemo` and session storage; it is not a live account dashboard. |
| Student area/university selection (`student/dashboard-data.js`) | `GET /student/areas`, `GET /student/universities`; option `value` is returned integer `id`, label is name. | Demo numeric keys are unrelated to DB IDs. Residential neighborhood coverage has not been verified. |
| Student route search/cards (`student/dashboard.js`) | `GET /student/routes?from_area_id=…&to_university_id=…` and `GET /student/routes/{id}`. Map driver name, origin, university, departure/return time, IQD price, capacity, occupied/available seats and status from response. | No invented arrival estimate, service-day schedule, intermediate stops or geographic polyline. |
| Student requests and waitlist | `POST /student/ride-requests` with canonical `route_id`; `GET /student/ride-requests`. For no route, `POST`/`GET /student/route-demand` with canonical area/university IDs. | No route-specific queue or Student cancel endpoint. Pending requests do not reserve seats; full route acceptance returns conflict. |
| Student reports (`student/reports-service.js`) | `POST`/`GET /student/reports`, `GET /student/reports/{id}`; send `type`, `subject`, `description`, optional real route/target ID. Show `public_resolution` only. | Current reports are session-storage demo data. Never expose `internal_notes` or trust client reporter ID. |
| Driver session and registration (`driver/session.js`, `driver/registration.js`) | `POST /auth/driver-register`, `POST /auth/driver-login`, `GET /auth/driver-me`. | Approval and active account are server-enforced; no browser status override. |
| Driver routes (`driver/app.js`, `driver/demo-data.js`) | `POST`/`GET /driver/routes`, `GET`/`PATCH /driver/routes/{id}`, `PATCH /driver/routes/{id}/disable`. Resolve canonical area/university IDs from catalogue. | Current live mode still says APIs are missing; that UI text is stale. Stops and operating days have no current route schema. |
| Driver requests/students (`driver/app.js`) | `GET /driver/ride-requests`, `POST /driver/ride-requests/{id}/accept` or `/decline`, `GET /driver/routes/{id}/enrollments`. Refresh authoritative seats after decisions. | Current actions run only in isolated `?demo=1` state. No Driver demand-opportunities endpoint. |
| Driver reports (`driver/app.js`) | `POST`/`GET /driver/reports`, `GET /driver/reports/{id}`. | Demo reports are browser-only and not visible to Admin. |
| Admin dashboard, approvals, catalogue, reports (`admin/JS-file/main.js`, `admin/JS-file/reportService.js`) | Existing `/admin/*` APIs and `DarbGoAdminApi` bearer client. Keep Admin ID and status semantics from API; report review uses `PATCH /admin/reports/{id}/review`. | Legacy `PATCH /admin/reports/{id}/status` remains for compatibility. WhatsApp link opening is manual and does not prove a message was sent. |

Integration should retain explicit demo mode until live fetch/error/loading states
are implemented per page. No demo state should be silently synced into the
database. The catalogue endpoints should serve reviewed local records, not
make external source calls per page load.
