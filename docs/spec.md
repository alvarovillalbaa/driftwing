# Driftwing product contract

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
