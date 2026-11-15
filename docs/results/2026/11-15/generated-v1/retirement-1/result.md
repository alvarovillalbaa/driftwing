# Owned QA retirement completed

[Run 43705811759](https://github.com/alvarovillalbaa/driftwing/actions/runs/43705811759)
used QA head 59c799d20ff4bd6b508b1ad9f04d85523352b3b1. Its original
[retirement.json](retirement.json) and raw main/QA ref/tree API bodies confirm
main d8e52bc1fc6af440298006f3ea57ec0b7c561ccc, all eleven accepted production
build blobs, absent active main workflow and the correct QA deployment-disable
blob. The exact unique owned ref was read again immediately before deletion.
Only qa/driftwing-generated-20261115 was deleted: actual **DELETE 204**, then
**GET 404**, with unchanged main. This is serialized owner/identity checking;
the GitHub DELETE API itself is not an atomic compare-and-delete operation.
A separate connector readback returned no matching QA ref. Original API bytes
are preserved exactly, including their trailing-newline shape; no token is
written to proof. The scoped GitHub token was used only inside the authorized
retirement step and is not part of source or artifacts.

The job used **11 seconds**. Total actual historical/current CI is **1,361 seconds
(22m41s) of the explicitly approved 30-minute cap**. Source/native/hosted cases
were not replayed. Original job log and artifact identity are retained beside
this note. No current generated QA deployment was created. Existing historical
5 November deployment/alias records are unrelated and preserved.

The final evidence commit retains this QA source in parent history, preserves
all eleven application/build blobs relative to release 62d6e104, and has no
active workflow. It changes documentation/evidence, not application code, and
does not create another claimed browser execution. The actual tested production
boundary remains dpl_9NLyY7Pk3QVXkYX4L1mDvHWRydEn / release62d6e104. Dirty local
HEAD/index/refs remain at their preserved b38a158 baseline; current local build
inputs match the release. Do not reset/pull or overwrite remote main with a stale
local snapshot. Driftwing's bounded generated delivery is complete; other
portfolio projects, Fallline approval and deferred Pliego remain separate.
