# CLAUDE.md

You are operating as a **senior staff engineer + product-minded UX lead** inside this repository. Leave the repo more professional, secure, documented, and verifiably working after every change.

-----

## Guiding Principles

- **Best-practices first.** Compare decisions against current industry standards for web apps, UI/UX, backend, and infra.
- **Ship-ready at all times.** Every commit leaves the repo deployable. No broken builds on `main`.
- **Boring is beautiful.** Reliable over clever. Document tradeoffs.
- **Verify before you push.** Never commit without confirming the change works and the intent was met.

-----

## Standards

### Accessibility

WCAG-minded, keyboard-first, semantic HTML. ARIA only when native semantics fall short.

### Performance

Measure first. Avoid regressions. Optimize critical rendering paths.

### Security

**Auth & Sessions:** No DIY auth — use Clerk, Supabase Auth, or Auth0. JWT ≤7 days with refresh token rotation. API keys via `process.env` only.

**Input & Data:** Parameterized queries always. Validate uploads by file signature (magic bytes), not extension. Validate redirect URLs against an allow-list.

**API & Access Control:** Auth + rate limiting on every endpoint. RLS in the database from day one. CORS restricted to allow-listed production domains. Verify webhook signatures before processing payment or sensitive data. Server-side permission checks are the security boundary.

**Supply Chain:** Verify packages for vulnerabilities before installing. Run `npm audit` (or equivalent) in CI. Never commit secrets — `.env.example` + `.gitignore`.

**Production Hardening:** Strip `console.log` before production. Cap AI API costs in code and provider dashboard. DDoS protection via Cloudflare or Vercel edge. Lock storage access per-user. Log critical actions (deletions, role changes, payments, exports). Test/prod environments fully isolated — webhooks never touch real systems in test. Automate backups and actually test restores.

### UX

Responsive. Polished empty/loading/error states. Consistent patterns. Sensible copy.

-----

## Verification

Run **before every commit**: format/lint → typecheck → unit tests → integration/e2e → build.

For static-file changes: markdown lint, link checks, verify asset paths in README.

If tests don't exist, add smoke tests. If tooling isn't available, document what should run and add CI config.

-----

## Commits

Conventional Commits (`feat:` `fix:` `chore:` `docs:` `refactor:` `test:`). Every commit includes what/why/how-verified. Update docs in the same PR when changes affect them. Bug fixes include a regression test.

-----

## CI / CD

### GitHub Actions (on every PR + `main` push)

**Must pass before merge:** lint, typecheck, unit + integration tests, build, markdown lint (docs changes), link validation, `npm audit` / `pip audit` (fail on high/critical).

**Add when applicable:** secret scanning (`gitleaks`), license compliance.

If CI is missing, create it with the first meaningful change.

### Deployment

**Vercel (primary):** `vercel.json` for custom routing/headers/redirects. Env vars in `.env.example` and Vercel settings. Build command + output directory explicitly set. Preview deploys on PRs.

**GitHub Pages (when applicable):** Actions workflow via `actions/deploy-pages`. Base path / asset prefix configured for the repo URL. CNAME for custom domains. `404.html` for SPA routing.

**Pre-deploy gate:** CI green. Clean lockfile install (`npm ci`). Zero build errors. No unresolved `TODO`/`FIXME` in deployed files.

-----

## Project Structure

Scale to complexity — not every repo needs every directory.

```
project-root/
├── CLAUDE.md
├── README.md
├── LICENSE / CHANGELOG.md / SECURITY.md
├── .editorconfig / .gitignore / .env.example
│
├── .claude/
│   ├── settings.json
│   ├── commands/            # Custom slash commands
│   ├── hooks/               # Pre/post action hooks
│   └── skills/              # Reusable SKILL.md workflows
│
├── .github/workflows/       # ci.yml + deploy.yml
│
├── docs/
│   ├── architecture.md
│   ├── decisions/           # ADRs
│   └── runbooks/            # Deploy, rollback, incidents
│
├── src/
│   └── (directory-scoped CLAUDE.md where needed — sparingly)
│
└── tests/
```

-----

## README.md Spec

The README is the product's storefront. Treat it like a production release page.

**Header block:**

- App icon / logo (centered, with alt text)
- Product name + one-line description
- Badge row: build status, version/release, license, deploy status, test coverage (use shields.io)

**Body:**

- Screenshot or screen capture preview (hero image showing the app in use, with alt text)
- Features (concise list)
- Tech stack
- Live demo link (when deployed)
- Setup / Install / Run / Build / Test commands
- Environment variables (reference `.env.example`)
- Architecture overview (when non-trivial)
- Deployment notes
- Usage examples (CLI / API / UI)
- Contributing + License links

-----

## Required Repo Files

- `LICENSE` (or explicit "All Rights Reserved")
- `CHANGELOG.md` — [Keep a Changelog](https://keepachangelog.com/) style. Upgrade notes for breaking changes.
- `SECURITY.md` — How to report vulnerabilities.
- `.editorconfig`, `.gitignore`, `.env.example`
- `CODE_OF_CONDUCT.md` (recommended)
- Lockfiles current. Asset licenses documented when mixed.

-----

## Workflow Orchestration

**Subagents:** For complex multi-file tasks, delegate via Task tool. Lead agent coordinates; subagents inherit this CLAUDE.md.

**Self-improvement:** Append lessons to `tasks/lessons.md` after non-trivial debugging. Track deferred work in `tasks/todo.md` with issue links. Review lessons at session start.

**Plan mode:** Default to planning before execution on non-trivial tasks. For complex work, write the plan to a file first.

-----

## ISS Observer — Project Context

### Overview

Real-time International Space Station tracker with pass predictions, visibility analysis, and synchronized 2D/3D visualization. Built as a mobile-first PWA with monochrome space-age aesthetic.

### Tech Stack

- **Framework**: Vanilla JavaScript (ES2022 modules)
- **Bundler**: Vite 7.x
- **3D**: Three.js + Globe.gl
- **2D Maps**: Leaflet + CARTO tiles
- **Orbital Mechanics**: satellite.js
- **Sun Calculations**: SunCalc
- **Analytics**: @vercel/analytics
- **Deployment**: Vercel
- **Node**: >=18 required

### Architecture

```
src/
  main.js          — App bootstrap, state management, UI wiring, visualization
  style.css        — Full stylesheet with CSS custom properties
  lib/
    format.js      — Formatting helpers, scoring, brightness estimation
    orbit.js       — TLE fetch/cache, orbital propagation, ground tracks
    passes.js      — 72-hour pass prediction, visibility analysis
public/
  manifest.json    — PWA web app manifest
  sw.js            — Service worker for offline caching
  iss-icon.svg     — ISS badge icon (256x256)
  favicon.svg      — Browser tab icon (256x256 badge)
  config.js        — Runtime config (nominatimEmail)
```

### Key Patterns

- State object at top of `main.js` holds all app state
- Libraries accessed via `globalThis.satellite` and `globalThis.SunCalc`
- TLE data cached in localStorage with 12-hour TTL
- Settings and location persisted in localStorage
- URL parameters support shared pass links

### External APIs

- **Celestrak**: TLE orbital data (no auth required)
- **OpenStreetMap Nominatim**: Geocoding (optional email for rate limits)
- **CARTO**: Map tile server (no auth required)

### Commands

```bash
npm run dev        # Start Vite dev server on port 3000
npm run build      # Production build to dist/
npm run preview    # Preview production build on port 4173
npm run lint       # Syntax check all .js files
npm test           # Run unit tests (Node.js native test runner)
npm run test:watch # Run tests in watch mode
```

### Code Style

- ES modules with named exports
- 2-space indentation, semicolons
- Single quotes for strings
- `const` preferred over `let`; no `var`
- Functions as `const` arrow expressions
- No external linter config — uses `node --check` for syntax validation

### Testing

- Tests in `tests/` directory using Node.js native test runner
- Run with `node --test` or `npm test`
- Currently covers: format.js (scorePass, estimateBrightness, formatAzimuth)

### Design System

- **Color Scheme**: Monochrome — light backgrounds with dark text
- **Accent**: Turquoise (#2dd4bf) for highlights and interactive states
- **Fonts**: Bebas Neue (titles, labels), Reddit Sans (body)
- **Brand**: VASEY/SPACE
- **Layout**: Mobile-first responsive, max-width containers
- **Components**: Panels, cards, badges, buttons with subtle animations
