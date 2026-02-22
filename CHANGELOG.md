# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Corrected globe path data shape to prevent `points.map is not a function` runtime errors.
- Made the settings menu collapse/expand state fully synchronized via `aria-expanded`, `hidden`, and CSS fallback class.
- Updated ISS status formatting to display coordinates, altitude, and speed on separate lines for readability.

## [0.2.0] — 2026-02-22

### Added
- Progressive Web App support with service worker (`sw.js`) and web app manifest.
- Cosmic-themed monochrome ISS SVG icons with orbit rings and star elements.
- Countdown timer showing time until next ISS pass.
- User location marker displayed on the 2D map.
- iOS home screen support with `apple-mobile-web-app` meta tags and safe area insets.
- Enter key support on location search field.
- TLE fetch retry logic (3 attempts with 2-second backoff).
- Coordinate validation (latitude -90 to 90, longitude -180 to 180).
- Geolocation error differentiation (permission denied vs. timeout).
- `prefers-reduced-motion` and `prefers-contrast: high` media query support.
- `CLAUDE.md` project architecture documentation.

### Changed
- Complete visual redesign to monochrome light-background / dark-text space-age aesthetic.
- Renamed from "ISS Tracker" to "ISS Observer".
- Hero section matches VASEY sibling app header style (Bebas Neue eyebrow, Sora headings).
- Switched map tiles from CARTO dark to CARTO light for monochrome consistency.
- Globe background color changed to match light theme.
- Next pass display now prioritizes visible passes.
- Visibility status shows "Visible pass approaching" when within 1 hour.
- Share and reminder buttons use smaller button variant.
- Visible passes highlighted with left accent border.

### Fixed
- **Critical**: Implemented `sunPos` and `isSatSunlit` functions manually — these were called via `satellite.sunPos()` and `satellite.isSunlit()` which do not exist in satellite.js v5.0.0 (added in v6), causing runtime crashes.
- Future track polyline was created but never updated in the render loop.
- All `localStorage` calls now wrapped in try/catch for private browsing compatibility.
- `beforeunload` listener clears the update interval to prevent memory leaks.
- URL parameter hydration validates parsed coordinates before applying.
- Vercel rewrite rules updated to exclude PWA assets (`sw.js`, `manifest.json`) from SPA fallback.
- CI workflow now includes `npm ci` step required for Vite builds.

### Security
- Resolved lodash-es prototype pollution vulnerability (GHSA-xxjr-mmjv-4gpg).
- Resolved preact JSON VNode injection vulnerability (GHSA-36hm-qxxp-pg3m).
- Updated vite to latest patch.

## [0.1.0] — 2026-02-01

### Added
- Initial ISS Tracker web experience with real-time telemetry, pass predictions, and dual 2D/3D visualization.
- Reminder and sharing controls for upcoming passes.
- CI workflow, linting, and unit tests.
- Promotional hero artwork and README header badges.
- Migrated to Vite bundler for reliable dependency management.
