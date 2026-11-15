# Driftwing product contract

Last updated: 2026-11-14

## Current iteration

[GEN-3659](https://app.notion.com/p/418a1ee8bd0680c99343ea23eb42d0dd) asks for generated maps instead of three fixed scenes, stored levels, increasing difficulty, faster opening, more obstacles/gusts/tricks and a game-first entry screen. The old implementation choices below are retained as history and are superseded where they conflict.

The local implementation generates all ring, rock-spire and thermal positions from a versioned biome/seed/level identity. Six biomes have distinct terrain/palettes. Replaying an identity reconstructs the same map. Course difficulty rises from level 1 through 50, with launch speeds 48–70 m/s (previously 34), narrower rings, stronger gusts and denser obstacles. Gate-to-gate corridors remain navigable. Free flight generates a bounded moving world beyond the finish and increases speed, gusts and obstacle density with distance.

Space / touch Roll starts a 1.05-second barrel roll when the aircraft has sufficient height, ceiling clearance and forward distance. It costs speed and earns 250 points only on completion without impact. Held input cannot repeat the roll; each new roll requires another 200 m. Rendering uses the same rock-spire geometry and world query as collision mechanics, with an arcade clearance margin. First completion advances the campaign once; crashes and free flights never advance it.

The fullscreen game menu includes six map choices, fresh terrain and saved-level replay. Browser-local storage keeps the latest 80 level IDs, 80 completion IDs and 100 valid records under the existing key. Existing historical record entries are not compared with seeded course identities. Exact readback is required before reporting a write saved. See [the implementation receipt](results/2026/11-14/generated-levels.md) for observed evidence and the remaining browser/publication limits.

## Original brief and release choices

Source: [Alvaro's personal project queue](https://app.notion.com/p/311a1ee8bd06805caa21c5306dd315ac), fetched on 26 October 2026. Its New list says exactly **“(game) airplane with wind currents”**. No platform restriction, status marker or prerequisite is attached to this entry. The parent's unrelated three omitted embeds do not expand this brief.

The source requirement is a playable airplane game in which wind currents matter. The user delegated implementation and publication of each distinct project to a separate personal `alvarovillalbaa` GitHub repository and Vercel and/or Supabase where needed. Current personal repository names/descriptions and bounded SIDE source searches found no corresponding flight game; this is a scoped duplicate check, not a global absence claim.

Implementation choices:

- Name: Driftwing. A browser arcade glider game with a projected 3D world, original procedural scenery and no external art or data.
- Bank and pitch with arrows/WASD or a touch stick. Pass flight gates while crosswinds, gusts and updrafts alter movement. This is an arcade model, not an aviation simulator.
- Three deliberately authored courses with different wind conditions, plus an endless free-flight mode. Explain controls and the current wind; show score, gate progress, altitude and airspeed from actual simulation state.
- Provide a clear start, pause/resume, restart and completion/crash flow. Reset inputs on interruptions and never simulate minutes of catch-up after a hidden tab.
- Keep device-local course records and preferences, tolerate unavailable/corrupt storage, and disclose that scores do not sync to another device. No account or database is needed for this game.
- Support narrow touch screens, keyboard focus, a stable-camera option and optional sound started only by user action. Do not imply full assistive-technology or device acceptance from static checks.

Acceptance must establish working controls, wind-driven motion, actual gate scoring and end states, interruption handling, local-record behavior and the published desktop/mobile experience. Pure mechanics checks, rendered UI, hosted publication and browser play are separate evidence.

Storage Guard measured 17.7 GiB free against 34 GiB required on this turn. No local install, environment or app build is authorized through that failure. Author small source files and use hosted static validation; do not resolve it by deleting unrelated data.
