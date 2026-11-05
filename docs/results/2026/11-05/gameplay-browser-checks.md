# Hosted gameplay acceptance — 5 November 2026

**Four focused journeys passed once in attempt 4.** The three earlier failures
remain preserved. This accepts the observed canonical-site behavior and
source-matched runtime bytes, with the deployment-label limitation below.
It does not complete every product, device, audio or lifecycle requirement.

## Source and execution

- Checked preparation: `7a5835a90ce3197a235b4be25ea7ee611783a941`, tree
  `3f49538142370947b9c89e173cbc0eff9a472e32`: 32 files / 468,399 bytes,
  independently matched across native HEAD/index/working bytes and immutable
  GitHub tree. No workflow belonged to that preparation.
- Activation: `cfdd84e7238eb616671b974177f5857166901d11` on the isolated QA
  branch. [Run 42119195058](https://github.com/alvarovillalbaa/driftwing/actions/runs/42119195058),
  job `127566790075`: **22:10:34–22:13:49 UTC**, terminal success, 195 seconds.
  Controller work: 22:10:41.979–22:13:45.482 UTC.
- [Immutable run report](gameplay-browser-checks.json): **148,202 bytes**,
  SHA256 `bc6142308f11c8748055c2073828f9cd4344827942160d556675868918f08242`.
  This is the exact emitted JSON plus one LF; emitted JSON was 148,201 bytes,
  SHA256 `1793282def12bcccfafc64e648c3d48c85a5cc86683ceb286c4b9bb3ec9fe6fa`.
- Node 24.21.0, Playwright 1.64.1, headed Chromium 156.0.8078.4 on disposable
  Ubuntu 24.04/Xvfb. No local install/build/server/browser followed the failed
  Storage Guard preflight (9.4 GiB free versus 34 GiB required).

Alvaro's standing approval covered the four-journey scope and temporary CI.
The four actual jobs used 40 + 259 + 45 + 195 = **539 seconds**. The final
14-minute ceiling plus the earlier 344 seconds stayed below the original
20-minute aggregate allowance. No paid plan, account, backend, model/inference
call or closed 64-case mechanics/audio/VM suite was involved.

## Actual outcomes

| Case | Observed behavior |
| --- | --- |
| D01 | All three course choices; real keyboard climb/bank and restart; P/Escape and native guide pause; stable paused HUD. The game became actually hidden/unfocused and paused, then actually visible/focused while remaining paused. Sound toggle UI changed on/off; acoustic output was not measured. |
| D02 | Neutral Coast flight completed with **4/7 gates, 788 points, 43.24 simulation seconds and 9 seconds of lift**. Altitude recovered after a 70 m minimum. The actual earned record survived reload and a real dive crash. Free flight continued to 1.6 km / 46 seconds without replacing it. |
| D03 | Fresh 390×844 touch-emulated profile recovered from authored corrupt preferences using real controls. Native CDP drag/release/cancel operated/reset the stick, with an actual climb. Pause/restart and a 390 px no-overflow layout passed; unrelated authored storage remained intact. |
| D04 | Isolated Chromium with native local storage disabled actually lacked usable storage. A complete Coast flight reported a personal best for this visit, made no saved claim, restored no record after reload and remained playable. |

All flight progression used real time and the real animation loop. No score,
flight state, physics API, fake clock, visibility state or synthetic DOM event
was injected. Only the app's corrupt-key fixture and unrelated authored sentinel
were seeded. Coast completion does not establish completion of every course.

The product change calls `updateHud()` synchronously inside the pause transition
after held input is cleared. It was published before these checks. The native
focus repair concerns the checker: D01 uses a fresh owned Chrome/default context
over public `connectOverCDP` with `noDefaults`, retaining real focus assertions
and bounded snapshots. The other cases retain their original assertions.

## Deployment label and served bytes

Root made a workflow-generation mistake: the source pin was correct, but the
parent-supplied `expectedDeployment` retained **`dpl_5AdRq9wwfavnwXGtRsNNWFr6PF7s`**,
the older `f6967a792831d400644994deda9e919a181f26c5` deployment. The raw workflow
and report preserve that stale label; **both pins matching is not claimed**.

Separately, root observed **`dpl_HLUwdqmBWVj12x4bzR9fGo9SsFDp` READY at the
checked `7a5835a…` source**, for `driftwing-alvaro.vercel.app`, before activation
at **22:10:20 UTC** and after execution at **22:15:22 UTC**. Those provider
observations do not retroactively correct the run input.

The run's nine anonymous reads before and nine after browser work independently
matched all eight checked runtime payloads; `/` and `/index.html` bind the same
HTML. All eight payloads were also byte-identical between the old `f6967a…` and
checked `7a5835a…` sources. The accepted proof is actual canonical-origin
gameplay plus these source-byte snapshots, with provider attribution separate.
No unchanged journey was repeated to repair a metadata-only label.

## Independent evidence and cleanup

Root and a second agent independently decoded all **82 complete original
command streams**: compressed sizes, byte counts and SHA256 matched; all
41 commands exited zero with exit/reap/close/EOF and original-group absence.
Five full source guards matched native immutable objects, all 32 file modes,
blobs and hashes, with no ignored/untracked output. All 18 asset observations
and all eight critical browser/network counters passed.

Three browsers, four contexts and two managed CDP sessions closed. The touch
session explicitly detached; the browser-close session ended with its browser.
Manual Chrome required acknowledged `Browser.close`, child exit 0 without a
signal, reaping, EOF, group absence and actual context/page/disconnect events.
The outer supervisor observed 47 attributed PIDs and needed **zero signals**;
none remained. Actual owned X display 99, its initially absent socket/lock,
authorization scratch, log writers and the owned root were verified released.
The complete Xvfb log was 3,522 bytes, SHA256
`f55e2a6894d1dfbec3e5fcb281a8d1d729dfe04923cdfe02ca3a4e801739b3f2`.

Nested Chrome diagnostics are **sanitized**, distinct from the complete original
outer command captures: stdout 0 bytes; stderr 4,690 retained bytes after one
owned DevTools endpoint redaction. Original stderr was 4,744 observed bytes;
its digest is recorded but those original bytes are unarchived and cannot be
independently replayed. Sanitized gzip/length/hash and ownership match passed.
Authorization-cookie contents were never read or retained.

Root independently verified and visually inspected both original 320×240 JPEG
DOM crops at **22:15:22 UTC**. They show the white/orange plane over the coast,
an approaching ring, and the narrow touch control; neither proves the complete
viewport's appearance. D02: 2,597 bytes, SHA256
`be69a2a38f3c17c5e7032c343761c39fa7ca09ed53d2ba334eb3c1c3cd909f66`;
D03: 3,808 bytes, SHA256
`93c05850f6c9620ce2ef184153fd1bb2124d0171d64575effb2920bddd7fe7fa`.

Temporary workflow `408231050` was verified **disabled_manually** and its active
file removed. This receipt edition changes four status documents and adds the
JSON/Markdown receipts; the other 28 checked inputs, including every runtime
payload, checker and existing test, remain unchanged. Final publication/READY
metadata is recorded separately in the portfolio handoff.

## Preserved failures and remaining limits

1. [Attempt 1](gameplay-browser-attempt-1.json): wrapper `/dev/stderr` failure
   before gameplay. X11 and scratch cleanup stayed unverified.
2. [Attempt 2](gameplay-browser-attempt-2.json): privileged optional-font download
   timed out. Two captures remain explicitly incomplete; scratch is unverified.
3. [Attempt 3](gameplay-browser-attempt-3.json): native hidden/focus transition
   unobserved, without retained last DOM values. Its exact cause is unproven.
   One supervisor TERM leaves normal browser/log/scratch cleanup unverified.

Their raw bytes/hashes and failure flags remain unchanged. The fourth success
does not upgrade their cleanup proof. Physical touch/devices, audible output,
performance, back/forward cache, every course/control combination and complete
product acceptance remain open. No native/store or scientific aviation claim.
