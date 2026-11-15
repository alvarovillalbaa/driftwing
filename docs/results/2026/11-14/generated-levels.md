# Generated flight levels: local implementation

Source: [GEN-3659](https://app.notion.com/p/418a1ee8bd0680c99343ea23eb42d0dd). Local base: `b38a15859c3441807637eb96092920bb321fc48e`. Changes are uncommitted and unpublished. Historical hosted receipts remain unchanged.

## Requirement coverage

| Requirement | Local implementation | Evidence boundary |
| --- | --- | --- |
| Multiple maps without fixed scenes | Six biomes; all course rings, spires and thermals generated from canonical v2 seed/level IDs; bounded world cache | Cache-eviction/reconstruction, seed variation, ID and world-query checks. Browser appearance pending. |
| Stored levels | Map menu has generated seed IDs, fresh terrain, saved-level selector and replay; bounded levels/completions and exact write readback | Real serialized in-memory storage round trip and actual game-module callbacks in a VM. Native browser persistence pending. |
| Increasing difficulty | First completion advances once through level 50; launch 48–70 m/s, stronger gusts, tighter rings, more spires. Free-flight difficulty also grows with distance | Parameter/geometry checks and 48 control-only generated journeys. Human difficulty/fun and frame performance pending. |
| Faster, more complex play | Launch now 48 m/s at level one versus the former 34; shared spires, swept collisions, gusts and continuing free-world obstacles/thermals | Relevant flight checks and new physical collision checks. Visual collision/readability acceptance pending. |
| Tricks | Space/touch Roll, 1.05-second visible rotation, speed cost, height/distance eligibility, held-input latch, 250 points only after successful completion | Core partial/completed/held/low-height/impact checks; VM callbacks cover a touch click across substep frames and clearing it on pause. Real keyboard/touch/rendered roll pending. |
| Game-first entry | Fullscreen flight with compact map menu; saved levels and settings inside the game; website-style sections hidden | Syntax/import/HTML checks only; responsive screenshots and browser play pending. |

## Checks actually executed

Runtime: Node `v26.8.2`; package target remains Node 24, which was not run.

`node --test tests/flight.test.js tests/records.test.js tests/game-audio.test.js tests/unit/generated-levels.test.js` passed **58/58** on the final changed candidate, with zero failed/skipped/cancelled. These are T2 authored seeds, controls, memory storage and controlled DOM/audio/renderer/rAF boundaries. No browser, Canvas rendering, WebAudio output, backend, database, network or service call was exercised. The unchanged standalone audio-unit suite was not replayed; the game-module sound/lifecycle checks were relevant because its integration source changed.

The generated flight journey covers **48 combinations**: six maps × seeds 13/42 × levels 1/12/25/50. A pilot using only normal bank/pitch controls finished every course through every ring, without altering position, score or obstacle state. This finite set does not prove every seed or human playability.

New VM cases dispatch the actual new-map, next-level, pause/menu, saved-level and launch callbacks. They verify exact replay identity, advancement, retained old records and stored course readback. A short-frame case checks that a touch-roll click survives a render frame shorter than one physics substep; pause discards the queued click. A separate case confirms that releasing the steering finger preserves an independently requested roll. These remain controlled module checks, not browser acceptance.

After the HTML/guide changes, 31 game-module VM checks passed again. Separating stick release from full input clearing then passed 32 VM checks; the final combined candidate passed all 58 above. Static checks passed all five native modules, imports, 66 unique HTML IDs and referenced public assets. `git diff --check` passed.

## Failure retained and corrected

The first new unit run passed 8/9; the first combined run passed 56/57 with that same clearance failure. Its fixture placed the aircraft eight metres above the first spire, but a taller adjacent spire actually intersected its flight. For seed `v2-coast-42-1`, first-spire centre/radius were approximately `(184.38,151.95)` / `7.84`; an adjacent spire at `(186.98,160.87)` / `6.24` rose higher. The collision was correct.

The changed test retains that trajectory as an expected collision and separately flies above the highest spire with ceiling clearance. Both assertions now pass; production collision policy was not weakened. Another review clipped accumulated updraft time at swept impact, alongside position/time. No failed historical browser receipt was edited or replaced.

## Remaining work

This edition needs real desktop/narrow-touch rendering and gameplay qualification, including spire depth/readability, roll animation, responsive menus, native controls and persistent reloads. Frame rate, physical devices, audible output, Node 24, hosted source delivery and production are unverified. No dependency install, local app build/dev server/browser, CI change, commit, push or deployment was performed. Storage Guard was rechecked: 2.4 GiB free versus 34.0 GiB required, exit 2; local heavy work remains unavailable. The overall portfolio goal stays open.
