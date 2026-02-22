# ISS Observer — VASEY/SPACE

## Project Overview
Real-time International Space Station tracker with pass predictions, visibility analysis, and synchronized 2D/3D visualization. Built as a mobile-first PWA with monochrome space-age aesthetic.

## Tech Stack
- **Framework**: Vanilla JavaScript (ES2022 modules)
- **Bundler**: Vite 7.x
- **3D**: Three.js + Globe.gl
- **2D Maps**: Leaflet + CARTO tiles
- **Orbital Mechanics**: satellite.js
- **Sun Calculations**: SunCalc
- **Deployment**: Vercel
- **Node**: >=18 required

## Architecture

### Source Structure
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
  iss-icon.svg     — Cosmic-themed ISS icon (64x64)
  favicon.svg      — Browser tab icon (32x32)
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

## Commands
```bash
npm run dev        # Start Vite dev server on port 3000
npm run build      # Production build to dist/
npm run preview    # Preview production build on port 4173
npm run lint       # Syntax check all .js files
npm test           # Run unit tests (Node.js native test runner)
npm run test:watch # Run tests in watch mode
```

## Code Style
- ES modules with named exports
- No semicolons optional (project uses semicolons)
- 2-space indentation
- Single quotes for strings
- `const` preferred over `let`; no `var`
- Functions as `const` arrow expressions
- No external linter config — uses `node --check` for syntax validation

## Testing
- Tests in `tests/` directory using Node.js native test runner
- Run with `node --test` or `npm test`
- Currently covers: format.js (scorePass, estimateBrightness, formatAzimuth)

## Design System
- **Color Scheme**: Monochrome — light backgrounds with dark text
- **Fonts**: Bebas Neue (titles, labels), Reddit Sans (body)
- **Brand**: VASEY/SPACE
- **Layout**: Mobile-first responsive, max-width containers
- **Components**: Panels, cards, badges, buttons with subtle animations
