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
