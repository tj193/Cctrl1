# DarbGo

No installation or build step is needed. For registration/login, run a local server so browser cryptography is available:

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

This remains a frontend concept. Registration/login now support local demo accounts, while homepage dialogs and route matching remain previews. No backend, booking, document upload or actual driver approval service exists. Use sample details.

The role-specific pages are grouped by feature:

```text
student/  registration, dashboard and student controller
driver/   registration, dashboard and driver controller
admin/    administration dashboard
```

Shared entry pages remain at the project root, and shared styles, scripts and assets remain under `css/`, `js/` and `assets/`.

See [registration architecture and sources](docs/registration.md) for the organized account modules, catalogue provenance, map/illustration licenses and limitations. No AI-generated images are used.

Run `node tools/check-registration.cjs` for catalogue, asset-link and account-flow regression checks. Google Fonts on the homepage uses an internet connection.
