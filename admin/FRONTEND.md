# DarbGo Admin frontend

The admin UI remains vanilla HTML, CSS, and JavaScript. `front-end/` contains each existing page and the new route demand page. `JS-file/layout.js` builds the common navigation in place, with no network template dependency. `JS-file/apiClient.js` owns the API origin and provides a shared request method and a compatibility Fetch adapter for existing page code. The existing request paths and payloads remain unchanged.

For the local in-app browser, run `node admin/dev-server.cjs` from the repository root instead of a plain static server on port 5500. The server serves static files and forwards only `/auth/`, `/admin/` API paths, and `/health` to the existing API on port 8000. This keeps browser requests on one origin when direct access to port 8000 is blocked. Stop any existing server on port 5500 before starting it.

## Data sources

| View | Current source | Meaning |
| --- | --- | --- |
| Overview KPIs | `GET /admin/dashboard/metrics` | Current account, route, application, and report counts |
| Overview attention | `GET /admin/dashboard/recent-approvals`, `GET /admin/dashboard/recent-reports` | Current pending work |
| Requests activity | `GET /admin/route-demand/analytics` | Active demand requests with creation timestamps; local calendar day bucketing |
| Most requested routes | `GET /admin/route-demand/analytics` | Active demand grouped by area and university; `route_exists` means a current active route exists for the pair |
| Seat occupancy | `GET /admin/routes` | Active enrollment count versus route capacity; invalid/zero capacity excluded |
| Demand analytics charts and tables | `GET /admin/route-demand/analytics` | Same filtered active demand dataset for charts and tables |
| Route demand opportunities | `GET /admin/route-demand` | Active demand groups, not confirmed bookings |

`created_at` values without an offset are interpreted as UTC because the current model creates those timestamps in UTC; the UI groups them by the viewer's local calendar day. Preferred travel times use the supplied offset when present. The backend should include offsets consistently in both fields to remove ambiguity.

Chart.js is loaded from the pinned CDN URL on the overview and analytics pages. If the library is blocked, a readable data list is shown. No fabricated records are inserted in the real dashboard. The optional localhost preview uses `sessionStorage.adminPreview = "1"` and disables real data and actions; it does not supply fixtures.

## API contracts still used

`POST /auth/login`; `GET /admin/driver-applications`; `PATCH /admin/driver-applications/{id}/status`; `GET /admin/available-drivers`; `POST /admin/routes`; `GET /admin/drivers`; `PATCH /admin/drivers/{id}/status`; `GET /admin/reports`; `PATCH /admin/reports/{id}/status`; `GET /admin/routes`; `PATCH /admin/routes/{id}/status`; `GET /admin/students`; `PATCH /admin/students/{id}/status`; `GET /admin/universities`; `GET /admin/areas`; `GET /admin/me`; `PUT /admin/me`; `POST /admin/me/password`; `POST /admin/admins`.

## Backend integration gaps

- `GET /admin/route-demand/analytics` returns active demand only. It cannot produce a truthful full request status distribution or historical status trends. Expose lifecycle status and timestamped transitions for such a chart.
- Reports currently expose `reporter_role`, but no report type or severity. The UI filters by reporter role and supported status values.
- Student phone is currently `null` in the admin student response; phone search can only match when the server supplies a value.
- Route capacity comes from the server. Available seats and bars are display calculations and are never sent as authoritative state.
- Existing backend status handlers accept `notes` but do not persist those notes for student, driver, route, or report actions. The UI sends the existing payload unchanged.
- University and area creation modals have no wired endpoints and remain hidden. Operational settings remain disabled until server storage exists.
- The API router uses `require_admin`. Frontend token presence is only a navigation convenience, not authorization proof. Recheck deployment configuration and authorization tests before production use.

## Verification boundary

Syntax checks and browser runs with in-memory response fixtures can verify rendering, filters, navigation, modal controls, and viewport layout. They do not verify production authentication, database writes, real document access, or WhatsApp delivery. Approval messaging remains manual through a link or clipboard copy.
