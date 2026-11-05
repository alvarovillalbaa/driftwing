# Real-time hosted gameplay checks

**Current status — 5 November 2026: all four journeys accepted in attempt 4.**
The [canonical receipt](../results/2026/11-05/gameplay-browser-checks.md)
preserves the three failures, the stale deployment label and separate actual
READY metadata. Source-matched public bytes and canonical-site gameplay passed;
an exact dual deployment pin is not claimed. Earlier preparation/resource plans
below remain historical, including their then-unrun status.

**Original preparation (then UNRUN) — 5 November 2026.** This proposal and its
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

## Initial infrastructure failure and owned-log repair

The [first receipt](../results/2026/11-05/gameplay-browser-attempt-1.json), run
`42042520853` / job `127296743438`, failed **14:11:03–14:11:43 UTC**.
`xvfb-run` exited 2 with empty stdout: opening `/dev/stderr` failed with ENXIO.
There was no driver report or accepted gameplay case. All four remain unrun.

All 46 streams, three full source guards and nine preflight assets verified;
22 commands exited zero, the wrapper exited 2. Observed processes disappeared
without signals, but no Xvfb display was observed. X11 and scratch cleanup
remain **unverified**; process absence does not close those boundaries.

The controller-only repair uses a precreated owned regular 0600 error log,
retaining bounded complete bytes/gzip/hash and checking identity/writer absence
before cleanup. Driver, product and assertions stay unchanged. The original
inactive example remains historical. Another 19-minute ceiling plus the first
40 seconds is 1180 seconds, below the original 1200: work 990 s, cleanup 90 s,
stdout 2 s; child 490 s/minimum remaining 497 s unchanged. No acceptance yet.

## Second setup failure and preinstalled-library profile

The [second receipt](../results/2026/11-05/gameplay-browser-attempt-2.json), run
`42111314143` / job `127539298949`, failed **21:17:46–21:22:05 UTC**.
Fourteen commands exited zero; the installer timed out at 240 s, with a six-second
forced drain, TERM/KILL and unverified privileged-descendant group closure.
All 30 captured byte/hash records validate, but two installer streams lack
complete EOF/close evidence. Two source guards passed; no assets, browser or
Xvfb started. Scratch cleanup remains **unverified**. Installer stdout reported
shared libraries already installed while nine extra font downloads stalled.

The prepared profile uses pinned Playwright `install --no-shell chromium`,
without `--with-deps`; [the official browser documentation](https://playwright.dev/docs/browsers#chromium-headless-shell)
distinguishes the regular browser from its headless shell. It requires actual
Chrome ELF hash/fully resolved `ldd`, preinstalled Xvfb/xauth and recorded font/tool
inventory; no apt/sudo fallback. Missing prerequisites or headed launch still
fail. The owned regular-log repair remains; driver/cases are unchanged and unrun.
The 299 seconds used plus a 14-minute ceiling is 1139 seconds, below 1200:
work 700 s, cleanup 90 s, stdout 2 s; child 490 s/minimum 497 s unchanged.

## Third failure and pending native-focus profile

The [third receipt](../results/2026/11-05/gameplay-browser-attempt-3.json), run
`42114870279` / job `127551725027`, failed **21:41:16–21:42:01 UTC**.
Actual Chrome ELF/library checks and 53 font-inventory rows passed. D01 failed
the hidden-and-unfocused transition; last DOM values were not captured, so its
cause remains unproven. D02–D04 were unrun; zero cases accepted, zero JPEGs,
zero critical browser errors.

Twenty-eight commands exited zero, the browser command exited 1. All 58 streams
were complete; the 2,348-byte Xvfb log is hash-valid but marked incomplete.
Three source guards/nine preflight-only assets passed. The driver's one browser,
one context and two CDP sessions closed. X11 socket/lock absence passed, but one
supervisor TERM with zero remaining processes leaves normal browser/log/scratch
cleanup **unverified**.

A prepared two-second natural-shutdown grace precedes existing escalation;
any supervisor signal still fails, including the historical TERM. The revised
native-focus resource contract and peer review remain pending before activation.
The 344 seconds used plus another 14-minute ceiling is 1184 seconds, below 1200;
work/cleanup/stdout 700/90/2 s and driver 420/60/2 s remain unchanged.

## Current prepared native-default focus profile — UNRUN

D01 starts the pinned headed Chrome ELF as a fresh owned process, with its own
short profile/artifact directories and loopback CDP port 0. An identity-checked,
bounded `DevToolsActivePort` file identifies only that process. Public
[`connectOverCDP`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)
with `noDefaults: true` and `isLocal: true` uses its existing default context
and initial `about:blank` page. `noDefaults`
avoids the focus override only in that default context; it is not applied to
new contexts. Guards attach before application navigation. No user Chrome or
existing user profile is attached.

Actual hidden/unfocused and visible/focused transitions remain required, with
before/after/failure DOM snapshots. No synthetic events or removed assertions.
D02–D04 keep their functional tests; D04 is labeled an isolated storage-disabled
profile. Totals are three browsers/four contexts. Two managed CDP sessions have
different endings: touch explicitly detaches; the browser-close session ends
with its real browser, without claiming an explicit detach.

Manual Chrome requires a `Browser.close` acknowledgement, child exit 0, reaping,
close, both stream EOFs and original-process-group absence. Each Chrome stream
is capped at 64 KiB and retained gzip at 48 KiB. Retained diagnostics are complete
**sanitized** bytes with redaction metadata/hash, separately from original
observed byte counts/SHA; original bytes are not retained or independently
replayable. Endpoint UUIDs are excluded from logs/errors/metadata; auth contents
are not read. Outer command streams remain original driver-report output.

The two-second natural-exit grace remains inside cleanup's 90 s; any supervisor
signal still fails. Third-attempt uncertainty is not reclassified. No new OS
package, paid account or local environment. This profile is prepared, unrun:
344 seconds plus a 14-minute ceiling is 1184, below 1200; controller 700/90/2 s,
driver 420/60/2 s and child 490 s/minimum remaining 497 s stay unchanged.

## Fourth-run completion — 5 November

Run `42119195058` / job `127566790075` passed D01–D04 once, with all five
source guards, 18 asset observations and scoped cleanup. The parent input kept
the older `dpl_5AdRq9wwfavnwXGtRsNNWFr6PF7s` label; actual source-byte matches
and separate provider metadata must not be described as both pins matching.
The raw receipt remains unchanged. Actual runner time across four attempts was
539 seconds; no accepted journey or closed 64-case check was repeated.
