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
