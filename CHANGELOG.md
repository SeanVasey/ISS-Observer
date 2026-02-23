# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-02-23

### Changed
- Replaced all ISS icons (hero, map marker, favicon, PWA icon) with the new simplified ISS illustration SVG across the entire codebase.
- Removed old inline SVG icons from `index.html` (hero section) and `src/main.js` (map marker) in favor of referencing the shared `iss-icon.svg` file.
- Updated favicon to a square-cropped version of the new ISS illustration.
- Added version pill badge ("v1.0") next to the app name in the header, matching the VASEY sibling app convention.
- Bumped service worker cache version to `iss-observer-v1.0`.
- Updated README with ISS icon display, additional technology badges (Node, Celestrak, Globe.gl), and version 1.0.0 references.

### Removed
- Old cosmic-themed 64x64 ISS icon (`iss-icon.svg`) and 32x32 favicon (`favicon.svg`).
- Inline SVG icon markup from `index.html` hero section and `src/main.js` map marker.
- Unused `iss_icon_simplified.svg` from root directory (moved to `public/iss-icon.svg`).

## [0.3.0] — 2026-02-22

### Added
- ISS 3D model rendered directly on the globe using Three.js custom objects (body, solar panels, glow ring) with an "ISS" label overlay.
- Globe zoom controls (+/−) positioned as an overlay on the 3D globe container so they are unambiguously associated with the globe rather than the 2D map.
- Leaflet zoom control added to the 2D map (bottom-left position) for standard map navigation.
- Subtle radial glow behind the hero brand lockup matching the VASEY sibling app style.
- Antimeridian-aware ground track segmentation prevents straight-line artifacts when the orbit crosses ±180° longitude.
- Future orbit track (90 minutes ahead) now displayed on both the 2D map and 3D globe.
- Observer location shown as a turquoise point on the 3D globe.
- Day/night terminator on the 2D map styled with semi-transparent fill and subtle border line.

### Changed
- Hero title uses clean black Bebas Neue text with a soft shadow glow instead of the previous turquoise text-stroke, matching the reSOURCERY visual identity.
- Hero eyebrow spacing and sizing refined for better balance on mobile.
- Visualization section restructured: map and globe each in their own container div for independent control placement.
- Mobile map/globe height increased from 280px to 300px for better usability; 260px on very small screens.
- Mobile visualization control buttons now flex-wrap horizontally instead of going full-width stacked.
- Ground track computation interval decreased from 60s steps to 30s steps for smoother curves.
- Both past and future tracks rendered on the 3D globe (previously only past track).
- Globe no longer uses a separate PointLight for ISS glow; replaced by the custom 3D model's built-in glow ring.

### Fixed
- Corrected globe path data shape to prevent `points.map is not a function` runtime errors.
- Prevented collapsed settings fields from leaking outside the dropdown by defaulting the panel to hidden and tightening `hidden`/transition behavior.
- Updated ISS status formatting to display coordinates, altitude, and speed on separate lines for readability.
- Ground tracks now properly segment at antimeridian crossings, eliminating the horizontal line artifact that appeared when the orbit wrapped around the map.

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
