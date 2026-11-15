# Native attempt 3: Roll repaired; resize observation and scene capture failed

[Run 43699401714](https://github.com/alvarovillalbaa/driftwing/actions/runs/43699401714)
used source e62a2eeeb4ec3c32d5fc801ec5e82b604ea36a85. Actual job time was
42 seconds; aggregate CI is 643 / 1,200 seconds. Preserve all original emitted
text/PNG files, complete job log and artifact identity beside this note.
L03 is not accepted: it failed before its explicit normal per-case closure.

The changed full game module passed **35/35 controlled VM cases** on actual
Node 24.22.2, including three new secondary-touch/click/disabled/pause regressions.
The 26 unchanged physics/records/generator cases retain their original byte-bound
Node evidence; the closed 58-case suite was not rerun. The focused TAP SHA-256 is
39c30b4d49d159238daa92610a98c68c69f4cabd869c30d30b4af2cd444f6142.
This source boundary may be carried by exact inputs, complete successful command
streams, runtime and stable/clean source vectors, independent of the native failure.

Native secondary pointerdown/up now began BARREL ROLL and completed with actual
374 points (one gate plus the 250-point roll). Actual touch End/Cancel and the
320px fit reached their assertions. After a real resize to 390px the case sampled
the newly cleared Canvas before the next ordinary animation frame and failed its
pixel-variation assertion. A later original failure capture already observed
184 Canvas sample colors and correct 390x844 DOM bounds. Wait for bounded actual
repaint rather than requiring a synchronous paint at the resize return.

Both original viewport PNGs still omit the scene despite nonempty Canvas pixel
readback and computed visible/full-viewport bounds. A read-only decoder found
only one color in the central scene region of the preserved attempt-2 PNG.
The renderer requests desynchronized Canvas. Chrome documents that this hint
may bypass ordinary compositing and send its buffer directly to display:
[official explanation](https://developer.chrome.com/blog/desynchronized).
This suggests a compositing cause; it does not establish user-visible behavior on
every browser. Remove that optional optimization for the production Canvas,
retain its ordinary DOM/HUD composition, and require the next actual untouched
screenshot to contain the scene. No screenshot editing or API replacement.

All browser/network error counters were zero. The bounded post-exit group
settlement ran; server exited normally, owned processes and selected X11 files
were absent, no supervisory signals were sent, source stayed stable/clean and
scratch was removed. Those final cleanup facts do not upgrade the failed case's
missing explicit normal per-case exit-0 evidence. Publication remains pending.
