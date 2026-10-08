# Reports & Support frontend contract

## Current modes

- Student reports use an isolated browser-session demo provider (`reports-service.js`). This is not a server submission, and its records are not visible in Admin.
- Admin reports use the existing authenticated `GET /admin/reports` and `PATCH /admin/reports/{id}/status` endpoints. The status update body is `{ "status": "resolved|dismissed", "notes": "..." }`.
- The current Admin PATCH handler saves the status and resolver ID, but does not persist `notes`. The UI states this explicitly after a successful response.
- The current Admin list returns `id`, `reporter_name`, `reporter_role`, `reported_target_name`, `subject`, `description`, `created_at`, and `status`. It does not return a reporter phone or public resolution. WhatsApp is therefore unavailable on current live rows; Copy Message remains available.

## Required server contracts

All student endpoints must use the authenticated principal; never accept a client-supplied reporter ID as proof of ownership.

- `POST /student/reports`: accepts type, subject, description, and optionally stable `route_id` or `driver_id` after the server validates the relationship. Returns a persistent report ID, timestamp, and status. The server must derive reporter ID from the authenticated account.
- `GET /student/reports`: returns only the authenticated student's reports, including ID, subject, creation time, and status.
- `GET /student/reports/{id}`: enforces ownership and returns the submitted fields, current status, and optional `public_resolution`. Never expose admin-only notes.
- Admin report response: include an authorized `reporter_phone` field when that contact exists. It must come from the reporter account, not the report payload.
- Admin status update: persist `notes` as an internal administrative note if the UI is to promise saved resolution details. Provide a separate optional public-facing resolution field if students should read it.
- Optional `status_history`: return actual timestamped transitions to the owner. The UI displays this only when supplied.

The student and admin views can show the same report only after these ownership-safe endpoints are implemented. Demo reports cannot be synchronized with Admin or considered submitted.
