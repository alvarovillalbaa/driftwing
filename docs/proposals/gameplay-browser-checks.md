# Real-time hosted gameplay checks

**Prepared, UNRUN — 5 November 2026.** This proposal and its
[inactive workflow example](gameplay-browser.workflow.yml.example) are not
browser acceptance or an activated CI job. Alvaro's standing “I approve
everything” / “Do all the work” authorizes this focused packet, isolated public
CI tooling and publication. It supersedes the older unanswered browser-check
language for this scope. The [64 accepted mechanics/VM checks](../results/2026/10-28/sound-ownership.md)
are closed and will not be repeated.

The [brief](../spec.md) requires an airplane game where wind affects flight.
The [flight contract](../flight-contract.md) separates authoritative physics,
rendering, input, records and sound. Hosted bytes and authored VM boundaries
have evidence; actual Canvas play, native interruption/input and browser storage
remain the missing product acceptance targeted here.

## Four fixed journeys

The driver is `scripts/gameplay-browser-driver.mjs`; the outer controller is
`scripts/gameplay-browser-controller.mjs`. Exact identities are:

| ID | Title |
| --- | --- |
| D01 | desktop controls and native interruptions preserve a paused flight |
| D02 | a real Coast flight earns a record that survives reload crash and free flight |
| D03 | narrow native touch controls recover from corrupt preferences |
| D04 | native storage unavailability keeps a completed flight playable without a saved claim |

D01 uses real keyboard input, the native guide dialog, P/R controls and an owned
blank tab brought to the foreground to cause actual visibility/focus changes.
Pinned [Playwright 1.64.1 enables focus emulation](https://raw.githubusercontent.com/microsoft/playwright/v1.64.1/packages/playwright-core/src/server/chromium/crPage.ts)
even for headed pages. Two owned public CDP sessions disable that emulation for
the game and blank tab; actual foreground changes must then produce observed
hidden/focus changes and the app's automatic pause. No visibility state is injected.
Paused HUD values must remain stable, and releasing/resuming must not retain
held input. No synthetic blur, visibility or keyboard DOM events. The prepared
product repair calls `updateHud()` immediately after `showMode('paused')` so the
visible snapshot is current. That repair is source-supported until the browser
observes it; no historical physics-advance defect is claimed.

D02 flies the actual Coast course with neutral controls. The authored reference
is 43.24 simulation seconds, at least two earned gates, positive updraft exposure
and actual altitude recovery. Completion and a real earned record must survive
reload. A subsequent downward-input crash must preserve that course record;
free flight must pass 1.5 km without replacing it. Read the actual HUD/result
and bounded saved record; do not inject a score, flight, completion or record.
This Coast path does not establish every course or every possible control path.

D03 uses a fresh 390×844 context with touch support. Browser-native CDP touch
drag, release and cancellation operate the real stick, and control recovery is
observed. Only an authored corrupt value under the app's own key is seeded as
a negative fixture. Actual preference controls must recover valid persisted
data; an unrelated one-time sentinel must remain unchanged. This is Chromium
touch emulation, not a physical touchscreen or an injected private app state.

D04 launches a second Chromium with the documented `--disable-local-storage`
switch. Actual native storage unavailability must be observed, rather than
replacing Storage methods or assuming the flag worked. A complete real flight
must remain playable, report a visit-only result without a false saved claim,
and have no restored record after reload.

The packet uses headed Chromium under Xvfb in real time: no clock replacement,
fast-forwarded animation frames or alternate simulation. There are two browsers,
four fresh contexts and three owned CDP sessions: two for D01's focus profile,
one for D03's touch input. Native keyboard/touch
commands are allowed; application globals, scoring/physics APIs and DOM event
dispatch are not. DOM/HUD/storage/Canvas observations are read-only except for
the explicitly authored corrupt-key and unrelated-sentinel setup above.

Two actual browser screenshots may retain 320×240 DOM crops as JPEG, at most
64 KiB each. Their bytes/hashes and capture states belong in the receipt. Root's
subsequent visual inspection is separate evidence; automated case success does
not prove appearance beyond those frames. No generated replacement image or
unbounded screenshot/trace/profile archive is proposed.

## Source, network and resource ownership

The application origin is `https://driftwing-alvaro.vercel.app`. Before
activation, publish a clean preparation commit and verify its exact READY
deployment. The workflow pins both identities; provider metadata, anonymous
response bytes and browser behavior remain distinct evidence.

All eight source payloads are byte-compared with anonymous HTTP responses before
and after browser work. There are nine observations per phase because `/` and
`/index.html` each bind the same source HTML. No application build or dependency
installation is needed. The driver permits only enumerated application reads;
unexpected requests, credentials, mutations, WebSockets and page/console errors
fail the packet. The owned blank tab is not an external site visit. No accounts,
private corpus, backend, model/inference calls or paid resource is used. The
anonymous public-hosting reads above remain part of this packet.

Five complete source guards bind pinned HEAD/tree, the full index path/mode/blob
set and working bytes, with no unexplained untracked or ignored output. Tools,
profiles, screenshots and temporary files remain outside the checkout. A fresh
short `/tmp/dw-*` runner root is bound by inode/nonce ownership, with an explicit
Chromium UNIX-socket path budget. This allocation remains disposable CI storage.
Retain
bounded complete compressed raw streams, exact case identities/statuses and
process/EOF/reaping observations. A skipped case, retry, partial report or
diagnostic trimming cannot become a pass. Preserve failures before repair.

The [Playwright CI guidance](https://playwright.dev/docs/ci#running-headed)
requires Xvfb for headed Linux execution. Probe the actual runner's Xvfb,
`xvfb-run` and `xauth` availability and record versions/hashes. If a required tool
is missing, the approved `xvfb`/`xauth` packages may be installed in disposable CI.
[Ubuntu Noble provides xvfb](https://packages.ubuntu.com/noble/xvfb),
but that is not proof it is already installed on this runner.

The [wrapper's authorization scratch](https://manpages.debian.org/bookworm/xvfb/xvfb-run.1.en.html)
and the [global X display socket](https://manpages.debian.org/bookworm/xserver-common/Xserver.1.en.html)
have separate ownership. Bind the actual selected display/PID/starttime, require
its socket/lock paths absent before launch, and verify process plus display,
socket, lock and auth cleanup afterward. Never delete a pre-existing display
artifact or clear global X/browser state. An explicit auth file needs its own
cleanup; wrapper exit alone does not prove resource absence. Uncertain ownership
must fail cleanup and preserve the scratch root. Authorization cookies are not
printed or retained in public diagnostics.

Primary native-input references are Chromium's [local-storage switch](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/common/content_switches.cc)
and the [CDP touch contract](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl).
The latter requires no active touch points on release/cancel. These interfaces
support the authored approach; their actual behavior still needs the run.

## Bounded execution and limits

One public Ubuntu 24.04 job, Node 24.21.0 and Playwright 1.64.1, is limited to
20 minutes on `qa/driftwing-gameplay-20261105`. Its temporary active path will be
`.github/workflows/gameplay-browser.yml`; the example remains inactive until
root pins the preparation and READY deployment. Controller work is 1020 s,
cleanup 90 s and final stdout 2 s. Tool installation is bounded to 150 s and
Chromium/runner-library installation to 240 s inside that same work window.
Driver work/cleanup/stdout are 420/60/2 s; its supervised child deadline is
490 s and requires at least 497 s remaining for the supervision reserve.
No child budget extends the outer deadline. All four cases, exact public bytes,
source guards and current owned cleanup must pass with actual child exit 0.

Storage Guard reports 9.4 GiB free against 34 GiB required. The reserve blocks
local installation, build and browser execution; there is no reserve bypass.
Local work is source inspection, syntax/link and whitespace checks only.
Playwright/Chromium/X packages belong to the disposable runner, not app manifests
or a new local environment. No closed 64-case rerun is included.

These journeys do not establish audible speaker output, physical devices,
all course/flight trajectories, real-world aviation, scientific fidelity,
real-time performance benchmarks, all browser/cache lifecycles, assistive
technology or full-game/portfolio completion. Real-time input here means the
browser clock is unmodified, not that performance or acoustic quality passed.
