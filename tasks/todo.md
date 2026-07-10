# Task Plan

## Current Session — 2026-07-10

- [x] Fix broken share links: consume `pass` param, stop saved location from overriding URL coords, match shared pass with ±15 min TLE-drift tolerance
- [x] Pin + highlight + scroll to the shared pass; dismissible banner explains matched / already-occurred / unmatched outcomes
- [x] Extract pure share helpers to `src/lib/share.js` with regression tests in `tests/share.test.js`
- [x] Add rank badge + View pass / Share actions to Top Picks cards
- [x] Move settings from in-flow collapsible panel to sticky top bar popover (mobile fix)
- [x] Replace safe-area scrim with topbar-owned top inset; remove standalone hero override
- [x] Add toast feedback for share/copy/reminder actions
- [x] Compact side-by-side action buttons on mobile
- [x] Bump 1.4.0 everywhere; update CHANGELOG, README, MANIFEST, lessons
- [x] Verify: lint, unit tests, build, browser smoke test (share link, settings popover, mobile layout)

## Previous Session — 2026-06-11

- [x] Verify CLAUDE.md matches the canonical engineering standards (no drift found)
- [x] Run full verification suite: npm ci, lint, tests, build — all green
- [x] Fix all npm audit vulnerabilities (lodash-es, vite) via `npm audit fix`
- [x] Add horizontal safe-area insets for notched iOS devices in landscape
- [x] Bump version to 1.3.1 across all references (package.json, index.html, sw.js, README)
- [x] Update CHANGELOG.md with 1.3.1 entry
- [x] Commit, push, and open PR

## Previous Session — 2026-03-23

- [x] Replace CLAUDE.md with streamlined engineering standards
- [x] Update README with centered badges, contributing section, security link, .env.example reference
- [x] Fix hero SVG and UI preview SVG branding ("ISS Tracker" → "ISS Observer")
- [x] Add .env.example file
- [x] Bump version to 1.3.0 across all references
- [x] Update CHANGELOG.md with 1.3.0 entry
- [x] Update docs/MANIFEST.md and tasks/todo.md
- [x] Verify lint, tests, and build pass
- [x] Commit and push to feature branch

## Previous Session — 2026-02-24

- [x] Update CLAUDE.md with expanded engineering guidelines
- [x] Create tasks/ directory with todo.md and lessons.md
- [x] Fix excessive bottom spacing in the application
- [x] Verify all dependencies, lint, tests, and build pass
- [x] Update versioning and documentation (CHANGELOG, README, MANIFEST)
- [x] Push all commits to feature branch
