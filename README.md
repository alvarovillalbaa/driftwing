# Driftwing

Last updated: 2026-11-15

A little airplane. A wide-open sky. An original browser flight game where wind currents move the aircraft.

[Play Driftwing](https://driftwing-alvaro.vercel.app) · [Source](https://github.com/alvarovillalbaa/driftwing)

Source intent and implementation choices are recorded in [the product contract](docs/spec.md); the module boundary is in [the flight contract](docs/flight-contract.md).

The app uses native JavaScript modules and original Canvas/SVG geometry. There are no runtime dependencies, accounts, analytics, external assets or backend services. Course records and preferences stay on the current browser/device. This is an arcade game rather than a real-world aviation simulation.

The current local edition generates courses in six environments instead of using three fixed scenes. Choose new terrain or replay a saved seed/level. First completion advances difficulty through 50: faster launch, stronger gusts, narrower rings and denser rock spires. Space / touch Roll performs a barrel roll when height and distance allow; completing it without impact earns 250 points. Free flight generates obstacles and thermals beyond the course finish and grows harder with distance. The game fills the screen, with map selection and level replay inside its menu.

The [current implementation receipt](docs/results/2026/11-14/generated-levels.md) distinguishes local mechanics/VM checks from browser qualification and publication. The public app and the historical hosted results below still represent the earlier edition.

The [current qualification](docs/results/2026/11-15/generated-v1/result.md)
has 61 distinct source cases on Node 24.22.2 and three accepted native journeys:
touch/scene, keyboard/native focus and actual storage-disabled completion.
The complete generated-map/progression journey remains unaccepted after a
terminal-control race in its driver. Its bounded V5 continuation is prepared
and awaiting an explicit CI extension. Public bytes and publication remain
pending; the public app still represents the earlier edition.

Run `npm run check` for focused source checks and `npm test` for flight mechanics, records and authored sound/lifecycle boundary checks. No install is needed. Serve `public/` through a static HTTP server for play only after the applicable browser/dev-server authorization. A local filesystem URL does not support native module loading reliably.

Vercel runs the same source checks and serves `public/`. Four focused hosted
journeys passed on 5 November: desktop controls and actual tab interruption,
earned-record persistence through reload/crash/free flight, narrow emulated
touch with corrupt preferences, and completed play with native storage disabled.
The pause transition now refreshes the HUD immediately. See the
[gameplay receipt](docs/results/2026/11-05/gameplay-browser-checks.md) for the
three earlier failures, source-matched asset observations, stale workflow
deployment label and separately verified READY metadata. Physical devices,
audible output, performance and complete product acceptance remain unverified.

Sound choices now update immediately while browser audio starts. Older audio
results cannot replace a newer choice or flight; pausing and sound-off also mute
scheduled tones. The completion cue remains available on the result screen.
See the [sound-control receipt](docs/results/2026/10-28/sound-ownership.md) for
focused checks; the gameplay receipt adds real browser sound-toggle UI evidence,
without claiming audible output.
