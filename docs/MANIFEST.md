# Repository Manifest

## Source

- `index.html` — Base HTML shell.
- `src/main.js` — App bootstrapping, state management, and UI wiring.
- `src/style.css` — VASEY/SPACE visual theme and layout.
- `src/lib/format.js` — Formatting helpers and scoring logic.
- `src/lib/orbit.js` — TLE retrieval and orbital propagation helpers.
- `src/lib/passes.js` — Pass prediction and visibility analysis.
- `public/config.js` — Optional runtime configuration for geocoding.

## Testing

- `tests/` — Node.js test runner smoke tests.

## Infrastructure

- `.github/workflows/ci.yml` — CI pipeline for linting, testing, and builds.
- `scripts/serve.mjs` — Local dev server.
- `scripts/lint.mjs` — Syntax lint (node --check).
- `scripts/build.mjs` — Static build packaging.
- `.editorconfig`, `.gitignore` — Repo hygiene.

## Documentation

- `README.md` — Product overview and setup.
- `CHANGELOG.md` — Release notes.
- `SECURITY.md` — Vulnerability reporting.
- `CODE_OF_CONDUCT.md` — Community guidelines.
- `ASSETS_LICENSE.md` — Third-party asset attribution.
- `docs/assets/iss-tracker-ui.svg` — UI preview placeholder.
