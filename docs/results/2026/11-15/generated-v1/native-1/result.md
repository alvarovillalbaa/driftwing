# Native attempt 1: byte guard stopped before browser

[Run 43698484967](https://github.com/alvarovillalbaa/driftwing/actions/runs/43698484967)
used source a97bf991acc08eda9cbc35383c7663bf51e23152 and actual Node 24.22.2.
The six-second job failed before tooling installation, Xvfb or any native case.
No generated native acceptance is claimed. Original runner/streams/source vectors,
full job log and artifact identity are preserved beside this note. Source stayed
stable/clean, no owned process remained and the nonce/inode-owned scratch was removed.

The carry guard correctly rejected three copied Node stderr files: their original
zero-byte streams had been persisted as a one-byte newline by the earlier evidence
file writer. The original Node run's recorded empty SHA-256 and archived bytes
remain unchanged. Restore those three files to literal empty blobs and verify all
six retained Node stdout/stderr files against their original command digests.
This repairs evidence preservation; it does not rerun or add to the accepted 58
Node cases. The failed source tree/vector remains an immutable record of the bad
copy. The corrected copy has its own descendant source identity.

The original aggregate CI total is now 539 historical + 15 Node + 6 failed guard
= 560 / 1,200 seconds. The next L03-only job retains the three-minute maximum;
no app source, real project configuration, account or publication changed.
