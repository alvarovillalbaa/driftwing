# Flight module contract

All modules are native ESM. Coordinates are metres: x right, y altitude, z forward. Inputs are normalized to -1..1: `bank` positive turns right, `pitch` positive raises the nose. Time is seconds; roll/pitch are radians and velocities are metres/second.

`public/src/flight.js` exports:

```js
COURSES // array of course objects below
getCourse(id) // known course; safe fallback to the first
createFlight(courseId, mode = 'course') // new state, status 'flying'
stepFlight(state, controls, dt) // returns the next state; does not mutate inputs
sampleWind(course, x, y, z, time) // { x, y, z, label }
terrainHeight(course, x, z) // ground altitude used by physics and renderer
```

Course shape:

```js
{
 id, name, subtitle, difficulty, description,
 colors: { sky, horizon, sea, land, accent },
 start: { x, y, z },
 gates: [{ x, y, z, radius }],
 thermals: [{ x, z, radius, strength, base, top }],
 wind: { x, z, gust },
 bounds: { halfWidth, ceiling }, limitSeconds
}
```

State always includes:

```js
{
 courseId, mode, status, // 'flying' | 'finished' | 'crashed'
 x, y, z, vx, vy, vz, roll, pitch, airspeed, time,
 score, gateIndex, passed, missed, streak, bestStreak, updraftSeconds,
 wind: { x, y, z, label },
 lastEvent: null // or { id, type, text }; id changes for each discrete event
}
```

`stepFlight` accepts only finite bounded dt and subdivides integration for stable results; no giant catch-up step. Status after finishing/crashing is terminal. A gate is scored at most once on crossing its z plane, including a crossing between frames. Final rings and the finish threshold must be reachable. Missing a ring is distinct from crashing. Free-flight does not end at the course finish or a course time limit and does not write a course record.

`public/src/renderer.js` exports `createRenderer(canvas)`, returning:

```js
{
 resize(width, height, pixelRatio),
 render(state, course, { steadyCamera, preview = false }),
 destroy()
}
```

The renderer owns canvas dimensions and drawing only. Use `terrainHeight` for scenery/ground consistency, display the next gate distinctly, visualize actual thermal fields and keep the plane visible. It may project 3D geometry through a 2D canvas; it must not claim a WebGL or scientific simulation backend.

Root-owned `game.js` will provide the DOM shell, controls, state machine, animation-frame timing, sound, HUD and records. Renderer/core owners should message root before changing this contract. Keep sources and controls independent of browser-only globals so mechanics can be checked with Node.

## Sound and browser lifecycle

`audio.js` returns `setEnabled(next)`, `update(airspeed, wind, flying)`,
`chime(type)` and `destroy()`. Sound is optional and enabled only from user
actions. `setEnabled` records intent and invokes AudioContext resume before its
first asynchronous suspension. A newer intent owns resume outcomes; old failures
cannot disable the current graph. Partial initialization failures release the
graph so another user action can retry. Its boolean result describes the current
request, not a promise that an older request still owns UI feedback.

The game saves sound intent and updates its label/pressed state synchronously.
A shared request generation and flight number guard asynchronous startup/toggle
results before they change preferences, notices or activity. A current failure
turns sound off without ending the flight. Activity uses the current mode and
visibility, so a delayed success cannot resume sound in a paused flight.

Inactive updates mute the master output, including already scheduled tones;
the wind envelope retains its existing fade. Pass tones require active flight.
The synchronous finish cue follows the transition to the result screen and may
play there when enabled and running. Menu, sound-off, hide and blur mute it.
Terminal page departure disposes the graph and renderer, invalidates pending
sound results and prevents queued frames from drawing again. Disposal is
idempotent and handles close rejection. A back/forward-cache departure instead
keeps resources available and the flight paused on return.

These contracts have authored module/VM checks. Native user activation, WebAudio
output and browser cache/lifecycle behavior still await browser-check approval
and actual gameplay acceptance; see the [sound receipt](results/2026/10-28/sound-ownership.md).
