# Lessons Learned

Accumulated patterns from corrections and mistakes. Review at session start.

## CSS Safe Area Handling

- **Pattern**: Don't stack `env(safe-area-inset-*)` on multiple nested elements. Apply the safe area inset once, on the outermost element that touches the edge (e.g., the footer for bottom inset, the hero for top inset).
- **Why**: Stacking body padding + container padding + footer padding creates excessive whitespace on all devices, not just notched ones.
- **Refinement (PR #35)**: "Outermost element" must not be a shared container when its children paint distinct full-width backgrounds. Horizontal insets on `#app` inset the hero's white surface away from the screen edge in landscape, exposing the gray body background beside it. Fold the inset into each section's own padding instead (`calc(5vw + var(--safe-left))` on `.hero`/`main`, plain inset on `.app-footer`) so backgrounds bleed edge-to-edge while content clears the notch. Still applied once per edge per element — never stacked.

## URL Params vs Saved State Precedence

- **Pattern**: When a feature writes URL parameters (share links, deep links), every parameter written must be consumed on load, and explicit URL state must take precedence over persisted local state (localStorage). Add a regression test for the parse path.
- **Why**: The original share link wrote a `pass` param nothing ever read, and `init()` loaded the saved location *after* URL hydration — so share links silently showed the recipient's own saved location. The half of the feature that writes state is easy to demo; the half that consumes it is the part that breaks silently.
- **Corollary**: Leaving shared mode (user picks their own location) should clean the share params via `history.replaceState` so a refresh doesn't resurrect stale context.

## Sticky Positioning Inside Overflow Containers

- **Pattern**: `position: sticky` fails silently inside any ancestor with `overflow` other than `visible` (e.g. `#app { overflow-x: hidden }`). Put sticky bars outside such containers (body level).
- **Why**: The ancestor becomes the scrollport for stickiness; since it doesn't scroll vertically itself, the element never sticks.

## Version Synchronization

- **Pattern**: When bumping the version, update all locations in a single commit: `package.json`, `index.html` version pill, `sw.js` cache name, `README.md` badge, and `CHANGELOG.md`.
- **Why**: Inconsistent versions across files cause confusion and can break cache invalidation in the service worker.
