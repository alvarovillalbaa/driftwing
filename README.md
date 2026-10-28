# Driftwing

A little airplane. A wide-open sky. An original browser flight game where wind currents move the aircraft.

[Play Driftwing](https://driftwing-alvaro.vercel.app) · [Source](https://github.com/alvarovillalbaa/driftwing)

Source intent and implementation choices are recorded in [the product contract](docs/spec.md); the module boundary is in [the flight contract](docs/flight-contract.md).

The app uses native JavaScript modules and original Canvas/SVG geometry. There are no runtime dependencies, accounts, analytics, external assets or backend services. Course records and preferences stay on the current browser/device. This is an arcade game rather than a real-world aviation simulation.

Run `npm run check` for focused source checks and `npm test` for flight mechanics, records and authored sound/lifecycle boundary checks. No install is needed. Serve `public/` through a static HTTP server for play only after the applicable browser/dev-server authorization. A local filesystem URL does not support native module loading reliably.

Vercel runs the same source checks and serves `public/`. The original release passed 17 mechanics/record tests and hosted static validation; the game and its assets returned successfully over HTTP. Desktop/mobile browser play is pending the owner's explicit approval, so source and publication evidence do not establish rendered appearance, manual playability, touch, sound or performance. See the [publication receipt](docs/results/2026/10-26/publication.md) and [focused check results](docs/results/2026/10-26/source-checks.md).

Sound choices now update immediately while browser audio starts. Older audio
results cannot replace a newer choice or flight; pausing and sound-off also mute
scheduled tones. The completion cue remains available on the result screen.
See the [sound-control receipt](docs/results/2026/10-28/sound-ownership.md) for
focused checks and the remaining real-browser proof.
