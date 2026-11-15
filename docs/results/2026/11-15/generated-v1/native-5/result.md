# L01 accepted; long-flight driver reached a terminal UI race

[Run 43701756778](https://github.com/alvarovillalbaa/driftwing/actions/runs/43701756778)
used source f127b6a83f2d78a1eb72e23c1cd05235258ccf8e. It used 267 actual job
seconds, bringing aggregate CI to 952 / 1,200 seconds. All 40 original emitted
files, untouched PNGs, full job log and artifact identity are preserved. Source
and clean checkout stayed stable; final owned processes/X11/scratch were absent,
with normal server exit and no supervisory signal. Earlier failures are unchanged.

**L01 passed independently before L02 began**, including all six map choices and
varied actual Canvas readbacks, fresh terrain/real saved replay/reload, faster
keyboard flight, climb/bank drag, pause/guide and actual hidden/unfocused →
visible/focused native tab transitions. Paused HUD stayed frozen. Its manually
owned Chrome/default context closed normally via acknowledged Browser.close:
actual exit 0/reaped, close/disconnect/default-page/default-context observations,
both diagnostic ends, no forced signal/drain and absent original process group.
Nested Chrome diagnostics retain sanitized rather than original raw stderr as
explicitly declared. The corrected returned-menu PNG was viewed: the scene is
visible and the stale announcement is hidden; the native computed display is none.
Keep L01 accepted on these exact bytes; do not replay it unchanged.

**L02 failed and L04 was unrun.** Actual native controls earned Coast 7/8 plus a
keyboard roll, its replay 7/8 without another advancement, Ridge 8/8, Cloudline
8/8 and Canyon 8/8. The final failure PNG shows Islands completed at 7/8,
1,303 points, next level 6 and an actual Saved on this device message. These are
preserved observations; they are not complete L02/profile acceptance. Aurora,
final progression reload/crash/free-entry assertions and explicit normal L02
per-case native exit-0 closure were not reached.

The last pilot HUD read still said flying; before its next native touch the real
finish hid the stick. Its bounding box was then absent and the harness asserted.
This is a terminal UI observation race, not evidence that the flight failed.
Repair only that branch: if the stick is absent, re-read the public body/HUD mode;
allow a terminal transition only when it actually says result, then require the
unchanged actual result title/gates/score/frozen result assertions. Missing controls
while flying remain failures. Release the actual native contact and retain all
ordinary closure checks. No application state, score, clock or result is injected.

L04 can still run independently within the original allowance (a two-minute job
maximum fits the current 248-second remainder). Its 60-second work, 30-second
cleanup reserve and 110-second outer deadline are fixed before execution. The
long L02 restart requires more than the allowance that would then remain. Prepare
an inactive bounded continuation and obtain an explicit CI extension before
activating it. Do not borrow Fallline approval or publish this source yet.
