# Native attempt 2: secondary touch did not activate Roll

[Run 43698716709](https://github.com/alvarovillalbaa/driftwing/actions/runs/43698716709)
used source 150575c39cf120de518159e1816490f06cfb6a82, Node 24.22.2,
Playwright 1.64.1 and full headed Chromium 156.0.8078.4. Its actual job time was
41 seconds; aggregate CI is 601 / 1,200 seconds. L03 failed and no native case
is accepted. The original 30 emitted files, full job log, PNG and artifact identity
are retained beside this note; the first guard failure remains separate.

The actual second touch generated pointerdown and pointerup with isPrimary false,
without a compatibility click. The application registered Roll only on click,
so no roll began or completed. HUD observations remained flying at 15 seconds,
three passed rings and 409 points. A source repair must handle this real secondary
touch without changing primary click, keyboard or assistive click activation,
respect disabled controls and retain pause/input clearing. Add focused regressions
and requalify the changed game VM on actual Node 24; carry only unchanged physics,
records and generator cases by their exact original inputs/raw TAP.

Two harness issues are also explicit: the negative fixture init script ran on
about:blank and recorded a native sessionStorage access-denied pageerror; scope
that fixture to the exact owned origin rather than suppressing page errors.
The wrapper's process group was sampled immediately at exit and was not yet absent.
The subsequent owned scan/Xvfb PID and lock/socket observations were empty, with
no supervisory signal and scratch removed. This is not retroactive normal per-case
closure: the case failed before its explicit native exit-0 closure assertion.
A bounded normal-settlement observation may precede the next group check.

The full viewport failure PNG visibly lacks the scene. Record Canvas DOM bounds,
computed visibility, actual pixel variation and its relation to the viewport
before claiming visual acceptance. Do not infer playable rendering from HUD or
VM/Canvas pixels alone. No product publication, real project configuration,
provider, account or database changed.
