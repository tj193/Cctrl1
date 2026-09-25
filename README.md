# DarbGo

The static site needs no build step. Run a local server so student demo cryptography is available:

```bash
python -m http.server 5174 --bind 127.0.0.1
```

Open `http://127.0.0.1:5174/register.html` for role selection or `student/register.html` for the three-step student flow. The homepage can still be opened directly.

- `index.html`: page markup, tab content, and dialog templates.
- `css/variables.css`: DarbGo design tokens and Iraqi-inspired accent colours.
- `css/global.css`: page styles, Iraq map, route finder, cards, and animations.
- `css/responsive.css`: responsive rules for desktop, tablet, and mobile.
- `js/main.js`: navigation, tabs, dialogs, FAQ animation, counters, motion control, and route matching preview.
- `assets/logo/darbgo-logo.png`: original logo.

This is the improved HTML, CSS, and JavaScript DarbGo concept. It includes a
stylised Iraq map, local university-route examples, IQD pricing, a working route
finder preview, clearer mobile navigation, and stronger accessible labels.
There are no React, JSX, Vite, npm, or runtime framework dependencies.

Student accounts remain a browser-only demo. Driver applications now use the FastAPI service in `src/admin/`: the driver submits an application, an admin approves or rejects it, and approved drivers can sign in. The API and database must be configured and running for that flow. Document upload, booking, and route matching remain unavailable or previews.

For local driver testing, install the Python dependencies from `pyproject.toml`, configure `DATABASE_URL` and `JWT_SECRET` from `.env.example`, and run the API on port 8000:

```bash
uvicorn src.admin.main:app --reload --port 8000
```

Run the static site on port 5174. `ADMIN_CORS_ORIGINS` must include the site's origin when they run on different origins. Do not use a production database for local tests.

The role-specific pages are grouped by feature:

```text
student/  registration, dashboard and student controller
driver/   registration, dashboard and driver controller
admin/    administration dashboard
```

Shared entry pages remain at the project root, and shared styles, scripts and assets remain under `css/`, `js/` and `assets/`.

See [registration architecture and sources](docs/registration.md) for the organized account modules, catalogue provenance, map/illustration licenses and limitations. No AI-generated images are used.

Run `node tools/check-registration.cjs` for catalogue, asset-link and account-flow regression checks. Google Fonts on the homepage uses an internet connection.
