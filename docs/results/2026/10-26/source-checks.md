# Source and mechanics checks — 26 October 2026

The [product contract](../../../spec.md) preserves the source's airplane/wind requirement separately from the implementation choices. Native browser modules, original Canvas/SVG geometry and device-local records require no database or provider credentials.

Focused checks executed without a dependency installation, dev server or local application build:

- `node scripts/check.mjs` passed: five native modules, JavaScript syntax, existing module imports, 59 unique DOM IDs and referenced public assets.
- `node --test tests/flight.test.js tests/records.test.js` passed all **17** tests. Mechanics cover real wind displacement/lift, pitch/bank response, between-frame gate interpolation, single awards/misses, finish/terminal state, shared-ground and flight-boundary collision, free flight, bounded invalid/large time steps and render-frame partition independence.
- A simple feedback pilot completed all seven rings on each of the three authored courses in simulated time. This establishes reachability under the model, not manual browser playability.
- Records checks cover malformed/unavailable storage, bounded stored data, completed-course eligibility, immutable updates and score/time tie handling. They do not establish actual browser persistence.

Separate source review covers rendering/state ownership and browser lifecycle. Source inspection found and corrected a menu HUD timer mismatch and preserved the renderer/audio on a browser back/forward-cache restore. These are source-level corrections until checked in the actual browser.

Storage Guard measured 17.7 GiB free versus 34 GiB required. No local package install, native/app build or test database was created. Static checks do not establish rendered appearance, touch/keyboard behavior, sound, browser interruption handling, performance or hosted publication. New browser checks require the owner's explicit approval under their supplied AGENTS.md section 7.
