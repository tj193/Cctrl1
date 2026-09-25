# Registration architecture

The site remains a dependency-free HTML/CSS/JavaScript project. Public HTML routes stay at the root so existing bookmarks and links continue to work.

## Structure

- `student/`: student registration, dashboard and registration controller.
- `driver/`: driver registration, dashboard and registration controller.
- `admin/`: administration dashboard.
- `register.html`: shared student/driver role selection.
- `login.html`: shared account login.
- `js/auth/`: shared account storage, login and dashboard session scripts.
- `js/components/governorate-map.js`: interactive map selection.
- `js/data/`: offline governorate, area, university and map data. No runtime API dependency.
- `css/auth/onboarding.css`: role selection and student wizard layout, including mobile rules.
- `css/auth/forms.css`: shared styles for login, driver form and dashboards.
- `assets/maps/`: licensed original map; derived interactive geometry is in `js/data/iraq-map.js`.
- `assets/illustrations/`: externally sourced illustration. No AI-generated images are used.
- `reference-data/universities-source.json`: the single reviewed university source catalogue used by the preparation script. `reference-data/SOURCES.md` records provenance and refresh steps. This folder is not a database and never receives user submissions.
- `tools/`: catalogue preparation and regression checks.

## Behaviour

1. Choose one of 19 governorates through the map or the searchable bilingual list.
2. Choose a suggested area or enter an area manually. Search and select a public/private university; an explicit other-campus option covers missing or out-of-province campuses. Choose an arrival time (not pickup time).
3. Supply account details. Validate required fields, Iraqi mobile format, email and matching passwords.

Back navigation preserves entered values. Changing governorate resets dependent area and university selections. Arrival time and account details remain intact. University filtering resets a selection if it is no longer in the filtered list, so an invisible stale option is never submitted.

## Driver applications

The driver form posts to `POST /auth/driver-register` on the FastAPI server. The earlier `POST /auth/driver-applications` path also remains available. The server stores a pending user and driver profile in its configured database, then the page shows the application number and entered WhatsApp number in a confirmation card. Admins can review the application at `admin/front-end/adminApproval.html`; approval activates the driver account. After approving or rejecting an application, the admin page offers a prefilled WhatsApp link for the driver's number. The admin must send the message manually. The shared login page uses `POST /auth/driver-login`, stores the driver token for the session, and checks approval through `GET /auth/driver-me`. Duplicate email, phone, plate, license number, and national ID submissions are rejected.

Run the API and static site at the same time. The API must be connected to the intended development database. This change does not create tables or migrate an existing database. Driver document upload is still unavailable; the form collects license and national ID numbers only.

## Local demo boundary

Student registration still uses browser storage. The shared login also accepts pre-provisioned student accounts from the configured database through `POST /auth/student-login`; these accounts have no saved area, university, or arrival preference until a separate profile flow is implemented. There is no email verification, booking service, or document upload. Do not deploy the browser account store as production authentication.

New student demo accounts use salted PBKDF2 password verifiers instead of storing plaintext passwords. Multiple demo accounts coexist, duplicate email/phone is rejected, and session profiles exclude password material. Original `darbgoUser` accounts remain readable and are migrated after successful login. Browser storage and client-side role checks are only prototype behaviour, not a security boundary. Driver status is checked by the API.

Existing browser demo accounts are not migrated into the database. Existing user data is not cleared.

## Data and visual sources

Reviewed on 2026-09-22. University names are grouped by main campus/governorate; this is a curated snapshot, not a live official registry of every satellite faculty or newly licensed institution.

- Federal public universities: https://mohesr.gov.iq/ar/home/public_universities (all five pages), cross-checked with https://studyiniraq.mohesr.gov.iq/.
- Federal private universities and colleges: official 2025–2026 directory, https://mohesr.gov.iq/ar/assets/img/uploaded_files/241120250.pdf. Includes listed provincial branches. The standalone private medical institute is outside the university/college scope.
- Kurdistan universities: https://gov.krd/mohe-en/publications/universities/ and https://lfu.edu.krd/univesity/.
- Areas are curated suggestions of familiar districts, neighborhoods and towns, not an exhaustive address gazetteer. Manual entry is always available.
- Map: https://commons.wikimedia.org/wiki/File:Iraqi_Governorates.svg. Original by Rafy; derivative contributors include Lolekek and أنون. CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/. Adaptations: simplified metadata, recolored boundaries, interactive labels and selection. The derived map retains CC BY-SA 3.0. Source geometry includes Halabja.
- Illustration: Storyset / Freepik, https://storyset.com/illustration/bus-stop/rafiki. Free for use with attribution under https://storyset.com/terms. Visible attribution is included on the role page.
- UX references: Uber's concise account entry and separation of rider/driver flows, https://www.uber.com/ and https://auth.uber.com/; Duolingo's visible progression, https://blog.duolingo.com/new-duolingo-home-screen-design/. No logos or protected UI assets were copied from these references.
- Canva was searched for existing Darb project references; no matching design was returned. No Canva design was created or changed.

## Run and check

```bash
python -m http.server 5174 --bind 127.0.0.1
node tools/check-registration.cjs
python tools/prepare-registration-data.py
```

Use localhost for the account demo so Web Crypto is available. Map and catalogue rendering are local and work without external API requests.
