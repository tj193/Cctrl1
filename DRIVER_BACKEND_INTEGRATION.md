# Driver frontend integration plan

## Current audit and scope

The Driver pages previously contained hardcoded KPI values, a hardcoded route, fictional students and requests, hardcoded opportunities, and a hardcoded profile. Most navigation links used `href="#"`; View, Edit, Pause, Accept, and Reject buttons had no handlers. `create_route.html` had an unhandled form submit. Only `driver/session.js` used a Driver read API. `driver/registration.js` used the real registration API.

The redesigned Driver pages share `driver/driver.css` and `driver/app.js`. Live mode uses only `GET /auth/driver-me` with `driverToken`. It returns `name`, `email`, and approved `status`. No operational metrics or records are invented. Temporary network failures show Retry without erasing the token. A 401 or 403 removes the token and returns to login. Registration remains on its existing API and validation flow.

`?demo=1` enables clearly labeled fictional Driver-only preview data. It requires the normal Driver session first. Changes are kept in `sessionStorage.darbgoDriverDemo`, never sent to an API, never represented as real bookings, and never copied into Student or Admin state. Logout clears this preview. This lets a reviewer navigate between Driver pages and inspect a coherent local demonstration.

## Existing API contracts retained

| Endpoint | Current scope | Driver use now |
| --- | --- | --- |
| `POST /auth/driver-register` | Public registration | Existing `registration.js`, unchanged |
| `POST /auth/driver-login` | Approved Driver | Existing login flow, unchanged |
| `GET /auth/driver-me` | Authenticated Driver | Session and trusted name, email, approval |
| `GET /admin/routes`, `POST /admin/routes`, `PATCH /admin/routes/{id}/status` | Admin only | No Driver calls |
| `GET /admin/route-demand` | Admin only | No Driver calls |
| `GET /admin/areas`, `GET /admin/universities` | Admin only | No Driver calls |
| `GET /admin/reports` | Admin only | No Driver calls |

The current `Route` model stores driver, area, university, capacity, status, and creation time. It does not store stops, departure/return time, price, or notes. The current `RouteDemand` model stores student, area, university, preferred time, and status. The Admin demand aggregation groups active demand by `area_id` and `university_id`; `route_exists` means an active route covers that pair. The Student Journey dashboard currently uses a separate browser demo, so its waitlist and requests do not create backend Driver requests or Admin demand.

## Required Driver APIs

These are proposed future contracts, not endpoints called by the frontend today. All IDs must be stable database IDs and all requests must use the authenticated Driver principal. The server must never trust `driver_id` or ownership supplied by a browser.

| Feature | Proposed contract | Required response / rule |
| --- | --- | --- |
| Profile | `GET /driver/me` | Driver ID, name, email, phone, vehicle type/model/plate, optional vehicle capacity, application status, document verification status, account status as distinct fields. Exclude license and national ID values unless specifically needed. |
| Canonical locations | `GET /driver/areas`, `GET /driver/universities` | Active IDs and names, same underlying Area and University rows as Admin and Student. |
| Routes | `GET /driver/routes`, `GET /driver/routes/{id}` | Only owned routes, with area/university IDs and names, status, times, stops, price, capacity, confirmed enrollment count, available seats, next service date if scheduled. |
| Create route | `POST /driver/routes` | Validated canonical IDs, distinct stop IDs, departure/return time, positive capacity, nonnegative integer price in IQD, notes. Return persisted route and ID. |
| Update route | `PATCH /driver/routes/{id}` | Ownership check, version/concurrency check, capacity at least active confirmed enrollment, persisted fields in response. |
| Pause/reactivate | `PATCH /driver/routes/{id}/status` | Validate allowed transition and current request state. Return persisted status. |
| Requests | `GET /driver/requests`, `GET /driver/requests/{id}` | Requests for owned routes only, student identity appropriate to Driver, request time/date, current status and version. |
| Accept/decline | `POST /driver/requests/{id}/decision` | Body `{ "decision": "accept|decline", "version": <current_version> }`. Return persisted request, enrollment, and seat availability. Reject duplicate, processed, stale, full, suspended, and unowned requests. |
| Enrollments | `GET /driver/students?route_id=...` | Confirmed active enrollments only, minimal student name, pickup area, university, optional permitted contact. |
| Demand | `GET /driver/route-demand` | Same aggregation source and active-demand semantics as Admin, with canonical IDs, count, preferred time range where real, and coverage. Aggregate waitlist only after a verified deduplication rule. |
| Reports | `GET /driver/reports`, `POST /driver/reports`, `GET /driver/reports/{id}` | Owner-only reports with type, subject, description, optional owned route reference, status, public resolution, and timestamps. Never expose other users' reports or internal notes. |

## State and capacity rules

- A student submission creates a `Pending` request. Driver review may transition it to `Accepted` or `Declined` once. Do not count `Pending` or `Declined` as occupied seats.
- Accepting must atomically lock or otherwise serialize the request and route capacity, check current ownership/status/capacity, prevent duplicate active enrollment, create or activate one enrollment, and return the new authoritative availability. A stale client must receive a conflict response and refresh.
- Declining changes request status without changing occupancy. The Student request view must receive the persisted result.
- A route can be paused/reactivated only through a server-authorized state transition. Capacity cannot fall below active enrollment. Changes must appear in Student discovery and Admin route management from the same route row.
- Demand records and ride requests have different meanings. Avoid counting both as one waiting student unless the backend defines and enforces deduplication. Creating a route from demand preselects validated IDs; it does not fulfill demand until the backend applies a confirmed business rule.
- Report statuses should use the existing `Pending`, `Investigating`, `Resolved`, `Dismissed` values. Admin internal notes and any public resolution need separate storage and authorization.

## Cross-role compatibility matrix

| Driver feature | Source and Driver state | Student counterpart | Admin counterpart | Current / next phase |
| --- | --- | --- | --- | --- |
| Registration | `POST /auth/driver-register`; pending until approved | None | Approval/rejection | Existing flow retained |
| Route creation and management | Owned Route rows; Active/Disabled/Full | Route search and availability | Route management | Driver UI demo; Driver APIs and additional route fields needed |
| Join requests | Request and enrollment rows; Pending → Accepted/Declined | Submit and track | Authorized monitoring | Driver UI demo; lifecycle and atomic decision APIs needed |
| Seats | Route capacity minus confirmed active enrollment | Availability | Occupancy | Preview calculation; authoritative backend count needed |
| Waitlist demand | Active demand grouped by area/university | Waitlist | Demand analytics | Admin aggregation exists; Driver-scoped read and Student persistence needed |
| Reports | Owner report rows and public resolution | Own reports | Investigate/resolve | Driver UI demo; owner APIs and Admin integration needed |
| Notifications | Persisted Driver event feed | Student updates | Operational alerts | No Driver feed yet; no fabricated notification count |

## Security and rollout

Enforce role and resource ownership server-side on every Driver endpoint. Filter report/enrollment/request responses by the authenticated user. Return only necessary personal fields. Audit decisions and status changes. Use optimistic versions or equivalent concurrency handling for seat decisions and route edits. Test authorization, duplicate decisions, route capacity races, Student and Admin views, and report privacy before enabling live buttons. Keep the existing public registration and authentication payloads unchanged.
