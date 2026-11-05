# Driftwing

An original browser airplane game where wind changes flight. Product intent is the parent Notion entry quoted in `docs/spec.md`; gameplay details are implementation choices.

- Read `docs/spec.md` and `docs/flight-contract.md` before editing. `public/src/flight.js` owns physics/course rules; `renderer.js` owns the projected world; `game.js` owns browser interaction and lifecycle.
- Use native JavaScript modules and original Canvas/SVG geometry. No runtime dependencies, external textures, tracking, backend, accounts, paid services or CI workflows are required.
- Wind must affect the actual trajectory, not only the graphics or HUD. Physics, collision, course progression and score must use one authoritative state. Rendering must not mutate it.
- Preserve keyboard and touch controls, visible pause/restart, focus states, instructions, reduced-motion camera and automatic pause on tab hide or lost focus. Clear held input when paused.
- Store only bounded game preferences/records under this app's key. Corrupt or unavailable storage must not prevent play. Never clear unrelated browser storage.
- Use `apply_patch`. Preserve other work. The active user goal authorizes a separate personal GitHub repository and Vercel publication; new browser checks still require the user's explicit approval under their supplied AGENTS.md section 7.
- Run focused source/mechanics checks and `git diff --check`. No dependency installs or local app builds after the failed Storage Guard preflight. Hosted static validation is allowed by the publication goal.
- Keep exact source, publication, gameplay and browser proof boundaries in `docs/results/`. No native/store release, scientific flight simulation or real-world aviation claim is implied.
- Alvaro's standing approval and 5 November "Do all the work" continuation
  authorize the four focused journeys in `docs/proposals/gameplay-browser-checks.md`,
  isolated temporary public CI tooling/profiles, and source publication. The
  existing 64 mechanics/audio/VM checks are closed; do not repeat them without
  a changed input or concrete concern. Browser results must remain distinct.
- Pause refreshes the HUD synchronously after clearing held input. Verify actual
  user controls, earned records and native interruptions without seeding scores
  or replacing browser APIs. Local Storage Guard now reports 9.4 GiB against
  34 GiB required, so builds/installs/browser execution stay on disposable CI.
- The first CI wrapper failed before producing gameplay results. Preserve its
  raw receipt and unverified X11/scratch cleanup. Its wrapper repair uses a
  task-owned error log; keep all four journeys and the aggregate budget intact.
- The second setup stalled on optional font downloads. Preserve its incomplete
  stream flags and cleanup uncertainty. Further setup must verify preinstalled
  system tools/shared libraries and install only the pinned browser; no apt/sudo
  fallback or reduction of gameplay assertions is part of this packet.
- The third attempt reached gameplay but did not observe native tab hiding and
  focus loss. Preserve that failure and its one-signal cleanup uncertainty.
  A replacement focus profile must retain the actual visibility/focus assertions
  and use only fresh task-owned browsers; never attach to the user's browser.
