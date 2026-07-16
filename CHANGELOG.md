# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.2] — 2026-07-16

### Changed
- **Updated app icon (`iss-icon-ios.svg`).** Replaced the outer blurred glow with an opaque, full-bleed border plate that covers the tile edge-to-edge. iOS applies its own squircle mask to Home Screen icons, so the previous design's transparent corners could let the system light/dark background bleed through the mask edge; the full-bleed plate guarantees an opaque, consistent tile in both appearance modes. Added an inner sheen stroke and a crisp inner edge line for depth.
- Regenerated every rasterized icon from the updated SVG: `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, the `512` maskable icon, and the `16`/`32`/`96` PNG favicons.
- The transparent-background `iss-icon.svg` badge remains the **in-app logo** (hero header and map marker) where a transparent background is ideal — unchanged, since its ISS mark is identical to the one inside the app tile.
- Service worker cache bumped to `iss-observer-v1.4.2` so installed clients refetch the updated icon assets.
- Bumped version to 1.4.2 across `package.json`, `index.html` (pill + footer), the service worker cache name, and README.

## [1.4.1] — 2026-07-16

### Fixed
- **iOS Home Screen icon now works.** "Add to Home Screen" previously fell back to a page screenshot because the only `apple-touch-icon` was an SVG, which iOS ignores. Shipped a proper `180×180` PNG `apple-touch-icon` (plus `192`/`512` PWA icons, a safe-zone-padded `512` maskable icon, and `16`/`32`/`96` PNG favicons) rasterized from the new `iss-icon-ios.svg` app icon.
- **Corrected broken icon paths in `index.html`.** The favicon, apple-touch-icon, hero logo, and manifest links used `./public/…` relative paths that Vite either bundled to hashed asset URLs or dropped in production. All now use root-absolute paths (`/…`) that resolve correctly from the `public/` directory in both dev and build.

### Added
- **New app icon** `public/iss-icon-ios.svg` — a glassy rounded tile enclosing the ISS badge — now drives the browser favicon and every installed-app surface (iOS Home Screen, Android/desktop PWA install).
- `scripts/generate-icons.mjs` — reproducible icon pipeline that rasterizes the app-icon SVG (gradients + glow filters) into all required PNG sizes via headless Chromium.

### Changed
- The transparent-background `iss-icon.svg` badge is retained as the **in-app logo** (hero header and map marker) where a transparent background is ideal; the glassy tile is reserved for app-icon/favicon surfaces.
- `manifest.json` icons switched from two SVGs to PNG `any` + `maskable` entries (with the scalable SVG kept as a supplementary `any` icon).
- Service worker cache bumped to `iss-observer-v1.4.1` and now precaches every icon asset and `manifest.json`.
- Simplified the `vercel.json` SPA rewrite to an extension-based rule so all current and future static assets are served directly instead of enumerating each filename.
- Removed the unused duplicate `public/favicon.svg` (byte-identical to `iss-icon.svg`).
- Bumped version to 1.4.1 across `package.json`, `index.html` (pill + footer), the service worker cache name, and README.

## [1.4.0] — 2026-07-10

### Fixed
- **Share links now work.** Opening a shared pass URL (`?lat&lon&pass`) previously did nothing useful: the `pass` parameter was never read, and on any device that had used the app before, the locally saved location silently overwrote the shared coordinates. Share links now take precedence over the saved location, match the shared pass against fresh orbital data (±15 min tolerance for TLE drift), pin it into the visible list regardless of pagination, highlight it with a "Shared pick" badge, scroll it into view, and explain the outcome in a dismissible banner — including friendly messaging when the shared pass has already occurred. Manually changing location exits shared mode and cleans the URL so a refresh returns to normal behavior.
- Share links now carry the location name (`loc` param, capped at 80 chars, placeholder names omitted) so recipients see a real place name immediately; links without one are reverse-geocoded in the background.
- Top picks always appear in the Upcoming Passes list (prioritization already guaranteed this; the shared pass is now also pinned when it would otherwise fall outside the 25-pass display cap).
- Top picks and pass lists no longer show passes that have already ended when re-rendered long after computation.

### Added
- **Top pick actions** — each Top Pick card now has a rank badge ("Pick 1/2/3") and two actions: "View pass" jumps to the full pass card in Upcoming Passes (navigating pagination and flashing the card), and "Share" opens the native share sheet or copies the link.
- `src/lib/share.js` — extracted, pure share-link helpers (`buildShareParams`, `parseShareParams`, `findSharedPass`) with full unit-test coverage in `tests/share.test.js` (regression tests for the broken-share-link bug).
- Toast notifications (`role="status"`, `aria-live="polite"`) for copy/share/reminder feedback — previously copy feedback appeared as text inside the distant Location panel.
- Calendar reminder downloads now confirm via toast.

### Changed
- **Settings moved into a new sticky top bar.** The full-width collapsible SETTINGS panel wedged between Location and Top Picks (awkward on mobile) is gone. A slim, always-visible top bar now carries the VASEY/SPACE brand and a Settings button that opens an anchored popover (same four controls, same persistence) — reachable from anywhere on the page, closable via Escape, outside tap, or the button. The hero eyebrow moved into the bar; disclosure semantics (`aria-expanded`/`aria-controls`) retained.
- The top bar replaces the fixed `body::before` safe-area scrim: as the topmost sticky element it owns the top safe-area inset (applied once) and masks content scrolling beneath the iOS status bar with a blurred translucent surface. The standalone-mode hero padding override is no longer needed and was removed.
- Share/Reminder and card action buttons render compact and side-by-side on phones instead of stacked full-width.
- Bumped version to 1.4.0 across package.json, index.html (pill + footer), service worker cache name, and README.

### Fixed (carried from unreleased)
- Moved horizontal safe-area insets from the `#app` container into each section's own padding (`.hero`, `main`, `.app-footer`) so the hero's full-width white surface bleeds edge-to-edge in landscape on notched devices instead of exposing gray body-background strips beside it. Insets remain applied once per edge per element.
- Completed the iOS safe-area blend for the light theme: added the `mobile-web-app-capable` meta (standards-track companion to the Apple-prefixed one), aligned manifest `background_color` with the `#ffffff` top-of-page color so the launch background flows seamlessly into the status-bar region and hero, and added an `html` reset with `-webkit-text-size-adjust: 100%` and dynamic-viewport min-height.
- Centralized safe-area insets as `:root` tokens (`--safe-top/right/bottom/left`, wrapping `env(safe-area-inset-*)` with `0px` fallbacks) as the single source of truth for notch/home-indicator clearance.

## [1.3.2] — 2026-06-12

### Fixed
- Corrected `theme-color` meta and manifest `theme_color` from `#111827` (the ink/text token) to `#ffffff` (`--bg-pure`, the hero background) so the status-bar region renders as a seamless continuation of the app background in installed PWA mode and Safari tab tinting, instead of a dark band over the light UI.
- Changed `apple-mobile-web-app-status-bar-style` from `black-translucent` to `default` — the app is light-themed, so the white status-bar text rendered by `black-translucent` was invisible against the white hero in iOS standalone mode.
- Added `min-height: 100dvh` on `body` (with `100vh` fallback) so the app shell fills the dynamic viewport on mobile browsers.

### Changed
- Bumped version to 1.3.2 across package.json, index.html, service worker cache name, and README so installed PWAs pick up the corrected head metadata.

## [1.3.1] — 2026-06-11

### Fixed
- Added horizontal safe-area insets (`env(safe-area-inset-left/right)`) on the app container so content clears the sensor housing on notched iOS devices in landscape orientation. Top and bottom insets were already handled on the hero and footer.

### Security
- Resolved all `npm audit` findings (1 moderate, 4 high): updated `lodash-es` (transitive via globe.gl — code injection and prototype pollution advisories) and `vite` (dev server file-read advisories). Lockfile refreshed; zero known vulnerabilities remain.

### Changed
- Bumped version to 1.3.1 across package.json, index.html, service worker cache name, and README.

## [1.3.0] — 2026-03-23

### Changed
- Replaced CLAUDE.md with streamlined engineering standards: consolidated security guidance (auth, input validation, API access control, supply chain, production hardening), refined CI/CD section with deployment checklists, updated project structure template, and added README spec with badge/imagery requirements.
- Overhauled README with centered badge row using HTML anchor tags, improved alt text on all images, added Contributing and Security sections, and referenced `.env.example`.
- Fixed hero SVG and UI preview SVG branding — changed "ISS Tracker" to "ISS Observer" for consistency with the v0.2.0 rename.
- Added `.env.example` documenting the environment variable pattern for the project.
- Bumped version to 1.3.0 across package.json, index.html, service worker, and README badges.

## [1.2.0] — 2026-02-24

### Changed
- Replaced CLAUDE.md with expanded engineering guidelines covering workflow orchestration, verification protocols, commit hygiene, CI requirements, and repository completeness standards.
- Added `tasks/` directory with `todo.md` (active task plan) and `lessons.md` (accumulated patterns from corrections) for session-based task tracking.

### Fixed
- Removed excessive bottom spacing caused by stacked padding on `body`, `#app`, and `.footer`. Safe area inset for notched screens is now applied only on the footer (the outermost bottom element), eliminating the large empty area below content.
- Removed duplicate JSDoc comment block on `getSunSubPoint` in `orbit.js`.

## [1.1.0] — 2026-02-23

### Changed
- Replaced ISS icon and favicon with new badge-style design featuring Earth horizon, orbital arc with glow, diamond-shaped sparkle stars, golden truss joints, and refined ISS structure details.
- Updated icon dimensions to square aspect ratio (256x256) across hero section and map marker.
- Synchronized service worker cache version with app version.
- Ensured all version references are consistent across package.json, index.html, service worker, and README.

### Fixed
- Installed missing Vite dev dependency (node_modules were absent, causing CI build failures).

## [1.0.1] — 2026-02-23

### Changed
- Reduced excessive top spacing on mobile — removed double safe-area padding from body and hero, compacted hero section (eyebrow, subhead, status items) across all breakpoints including PWA standalone mode.
- Location panel is now more compact with a visible current-location display showing the resolved city name and coordinates.
- "Use my location" button now performs reverse geocoding via Nominatim to display the actual city/region name instead of the generic "My location" label.

### Fixed
- 3D globe sizing now uses `requestAnimationFrame` to defer layout measurement, preventing zero-dimension initialization when the container hasn't been laid out yet.
- Globe initial point of view is set to the observer's coordinates on startup so the globe immediately shows a relevant view.
- Window resize handler for globe uses safe dimension check to avoid setting zero width/height.

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
