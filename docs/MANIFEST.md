# Repository Manifest

## Source

- `index.html` — App shell with PWA meta tags and ISS Observer UI.
- `src/main.js` — App bootstrap, state management, UI wiring, and visualization.
- `src/style.css` — Monochrome design system and responsive layout.
- `src/lib/format.js` — Formatting helpers, scoring, and brightness estimation.
- `src/lib/orbit.js` — TLE fetch/cache, orbital propagation, sun position, and sunlight detection.
- `src/lib/passes.js` — 72-hour pass prediction and visibility analysis.
- `src/lib/share.js` — Share link build/parse helpers and shared-pass matching.

## Public Assets

- `public/config.js` — Runtime configuration (Nominatim email).
- `public/manifest.json` — PWA web app manifest.
- `public/sw.js` — Service worker for offline caching.
- `public/iss-icon.svg` — Transparent-background ISS badge, used as the in-app logo (hero header, map marker).
- `public/iss-icon-ios.svg` — Full-bleed app-icon tile (1024×1024) enclosing the ISS badge; source for the favicon and all rasterized app-icon PNGs.
- `public/apple-touch-icon.png` — 180×180 iOS Home Screen icon (rasterized from `iss-icon-ios.svg`).
- `public/icon-192.png`, `public/icon-512.png` — PWA install icons (`purpose: any`).
- `public/icon-maskable-512.png` — 512×512 safe-zone-padded maskable PWA icon.
- `public/favicon-16.png`, `public/favicon-32.png`, `public/favicon-96.png` — PNG favicons.

## Testing

- `tests/format.test.js` — Unit tests for format helpers (Node.js native test runner).
- `tests/share.test.js` — Unit tests for share link helpers and shared-pass matching.

## Infrastructure

- `vite.config.js` — Vite bundler configuration with chunk splitting.
- `vercel.json` — Vercel deployment, headers, and SPA rewrites.
- `.github/workflows/ci.yml` — CI pipeline (install → lint → test → build).
- `scripts/lint.mjs` — Syntax lint (`node --check`).
- `scripts/generate-icons.mjs` — Rasterizes `public/iss-icon-ios.svg` into all app-icon/favicon PNG sizes via headless Chromium.
- `scripts/build.mjs` — Legacy static build packaging.
- `scripts/serve.mjs` — Legacy local dev server.
- `.editorconfig`, `.gitignore`, `.env.example` — Repo hygiene.

## Task Tracking

- `tasks/todo.md` — Active task plan with checkable items, updated per session.
- `tasks/lessons.md` — Accumulated patterns from corrections and mistakes.

## Documentation

- `CLAUDE.md` — AI assistant engineering guidelines and project context.
- `README.md` — Product overview, setup, and deployment.
- `CHANGELOG.md` — Version history.
- `SECURITY.md` — Vulnerability reporting.
- `CODE_OF_CONDUCT.md` — Community guidelines.
- `ASSETS_LICENSE.md` — Third-party asset attribution.
- `docs/assets/iss-tracker-hero.svg` — Promotional hero artwork.
- `docs/assets/iss-tracker-ui.svg` — UI preview placeholder.
