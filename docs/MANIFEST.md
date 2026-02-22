# Repository Manifest

## Source

- `index.html` — App shell with PWA meta tags and ISS Observer UI.
- `src/main.js` — App bootstrap, state management, UI wiring, and visualization.
- `src/style.css` — Monochrome design system and responsive layout.
- `src/lib/format.js` — Formatting helpers, scoring, and brightness estimation.
- `src/lib/orbit.js` — TLE fetch/cache, orbital propagation, sun position, and sunlight detection.
- `src/lib/passes.js` — 72-hour pass prediction and visibility analysis.

## Public Assets

- `public/config.js` — Runtime configuration (Nominatim email).
- `public/manifest.json` — PWA web app manifest.
- `public/sw.js` — Service worker for offline caching.
- `public/iss-icon.svg` — Cosmic-themed ISS icon (64x64).
- `public/favicon.svg` — Browser tab icon (32x32).

## Testing

- `tests/format.test.js` — Unit tests for format helpers (Node.js native test runner).

## Infrastructure

- `vite.config.js` — Vite bundler configuration with chunk splitting.
- `vercel.json` — Vercel deployment, headers, and SPA rewrites.
- `.github/workflows/ci.yml` — CI pipeline (install → lint → test → build).
- `scripts/lint.mjs` — Syntax lint (`node --check`).
- `scripts/build.mjs` — Legacy static build packaging.
- `scripts/serve.mjs` — Legacy local dev server.
- `.editorconfig`, `.gitignore` — Repo hygiene.

## Documentation

- `CLAUDE.md` — AI assistant project context.
- `README.md` — Product overview, setup, and deployment.
- `CHANGELOG.md` — Version history.
- `SECURITY.md` — Vulnerability reporting.
- `CODE_OF_CONDUCT.md` — Community guidelines.
- `ASSETS_LICENSE.md` — Third-party asset attribution.
- `docs/assets/iss-tracker-hero.svg` — Promotional hero artwork.
- `docs/assets/iss-tracker-ui.svg` — UI preview placeholder.
