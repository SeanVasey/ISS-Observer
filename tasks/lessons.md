# Lessons Learned

Accumulated patterns from corrections and mistakes. Review at session start.

## CSS Safe Area Handling

- **Pattern**: Don't stack `env(safe-area-inset-*)` on multiple nested elements. Apply the safe area inset once, on the outermost element that touches the edge (e.g., the footer for bottom inset, the hero for top inset).
- **Why**: Stacking body padding + container padding + footer padding creates excessive whitespace on all devices, not just notched ones.

## Version Synchronization

- **Pattern**: When bumping the version, update all locations in a single commit: `package.json`, `index.html` version pill, `sw.js` cache name, `README.md` badge, and `CHANGELOG.md`.
- **Why**: Inconsistent versions across files cause confusion and can break cache invalidation in the service worker.
