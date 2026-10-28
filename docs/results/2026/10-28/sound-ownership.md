# Preserve the latest sound choice

28 October 2026. Status: source repair and 64 focused frontend checks passed;
publication readback is pending. Desktop/mobile gameplay acceptance remains open.
The all-project goal is active.

Baseline: [1219e0dfc711fa012fca58c2e7a2067d61c9ed2e](https://github.com/alvarovillalbaa/driftwing/commit/1219e0dfc711fa012fca58c2e7a2067d61c9ed2e).
Two clicks while AudioContext resume was pending both computed the same old
sound preference. Older toggle/start failures could later turn a newer choice
off. In the audio module, a stale resume rejection also disabled newer intent.
Inactive updates muted wind but left already-scheduled tones connected to the
audible master output. Terminal departure did not fence later audio outcomes.

## Behavior

[The game](../../../../public/src/game.js) commits desired sound, its pressed
state/label and device preference synchronously. Shared request generation and
flight ownership fence startup/toggle acknowledgements before they alter current
preferences, notices or activity. Resume is still invoked in the initiating user
callback before asynchronous suspension. A current failure turns sound off and
reports it without ending the flight; an obsolete result has no UI side effects.

[The audio module](../../../../public/src/audio.js) separately fences delayed
resume results. Off, pause, menu, hide and blur gate the complete master output,
including scheduled notes. Pass cues require active flight. The finish cue is a
synchronous result-screen exception after the inactive update; it retains the
existing wind fade and is silenced by the next menu/off/hide/blur update. Its
sound frequencies and note envelopes remain unchanged.

Partial graph failure disconnects/stops/closes the incomplete graph and permits
a later user action to retry. Terminal departure invalidates pending sound,
disposes audio/renderer and stops queued frames from drawing again. Disposal is
idempotent, disconnects output before closing and contains asynchronous close
rejection. Back/forward-cache departure retains resources and keeps flight paused.
The [flight contract](../../../flight-contract.md#sound-and-browser-lifecycle)
owns these boundaries.

Flight physics, courses, renderer, record format/key, all 17 existing tests,
HTML/styles/assets, dependencies, configuration and CI remain unchanged. No
account, database, external asset, model call or paid service was added.

## Focused evidence

The same repository shell recorded Node `v24.21.0` and its executable before:

```sh
npm test
npm run check
git diff --check
```

**64 cases passed, zero failures/skips/cancellations**: the original 17
mechanics/record cases, 19 new audio cases and 28 new game-orchestration cases.
The original flight/record test files remain byte-identical to baseline. The
source checker passed five native modules, syntax/imports, 59 unique DOM IDs and
referenced assets. No dependency installation, dev server or local build ran.

[Audio tests](../../../../tests/audio.test.js) execute the actual module with
authored AudioContext/node/parameter boundaries and controlled resume promises.
[Game tests](../../../../tests/game-audio.test.js) boot the entire actual module,
including registered user/lifecycle callbacks, with controlled DOM, audio,
renderer, storage and animation-frame boundaries. Actual flight/record modules
remain in that harness. Business logic is not copied. Gain observations establish
commands/graph connections, rather than measuring native signal output.

The identical final test files against immutable baseline source produced:

| File | Current | Baseline |
| --- | --- | --- |
| Audio | 19 pass / 0 fail | 6 pass / 13 fail |
| Game sound | 28 pass / 0 fail | 11 pass / 17 fail |

Baseline failures are ordinary behavior assertions, with zero skips,
cancellations or missing bindings. These are 30 failing case outcomes, not 30
distinct defects. Preserved baseline controls include synchronous activation,
unsupported/constructor failure, WebKit fallback, running cue gates, ordinary
current failure and paused lifecycle behavior. Coverage also includes on/off/on
in adverse orders, old/new flights, menu ownership, partial initialization retry,
visibility before its callback, blur, back/forward cache, terminal disposal,
close rejection, queued frames, finish ordering and crash-without-finish-cue.
Independent read-only source review found no remaining scoped blocker. Owned
immutable-baseline fixtures were removed after terminal execution.

| Frozen artifact | SHA-256 |
| --- | --- |
| Baseline audio | `66cd8bb4e0347123c58a22051cdf2c4f4516f18ff494b41cf85b7e9fb4628c9e` |
| Baseline game | `07f5da2f994ad4904f34e02d933905bac725a46b7d83d8f11403494fd93f718d` |
| Checked audio | `c824e61425ee4d344a72c426722c22533ff8f42e9034d121beae070d83cc3bdf` |
| Checked game | `b80ffac5577ec33828c6685fba548c3a5208ae21623c19d7cd5fdba81f3a6916` |
| Identical audio checks | `218e9767e7f88d853ab33bb2db6a1168e2d9a16d154af3172cda72d5ef1b3239` |
| Identical game checks | `e7c18a8cf8d443ff1838d815f13fd3ab995813a0851db77e904a77e6e17fa6be` |

## Publication and proof limits

GitHub source and existing Git-linked Vercel static delivery are verified
separately from authored frontend checks. No CI workflow is added or changed.

No browser, native AudioContext/user activation, speaker output, real Canvas,
keyboard/touch play, browser storage/cache lifecycle or performance check ran.
Hosted source bytes cannot establish those behaviors. The earlier requested
desktop/mobile browser approval remains pending; no existing approval was
broadened. This source repair does not complete gameplay acceptance, Driftwing
or the wider all-project goal.
