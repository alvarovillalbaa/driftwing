# Driftwing

A little airplane. A wide-open sky. An original browser flight game where wind currents move the aircraft.

Source intent and implementation choices are recorded in [the product contract](docs/spec.md); the module boundary is in [the flight contract](docs/flight-contract.md).

The app uses native JavaScript modules and original Canvas/SVG geometry. There are no runtime dependencies, accounts, analytics, external assets or backend services. Course records and preferences stay on the current browser/device. This is an arcade game rather than a real-world aviation simulation.

Run `npm run check` for focused source checks and `npm test` for the pure flight mechanics. No install is needed. Serve `public/` through a static HTTP server for play only after the applicable browser/dev-server authorization. A local filesystem URL does not support native module loading reliably.

Vercel runs the same source checks and serves `public/`. Publication, actual browser play and any limitations belong in `docs/results/`; this initial source scaffold is not deployment or gameplay acceptance.
