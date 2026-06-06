---
name: Post-merge index script lock contention
description: Why scripts/post-merge.sh can time out during a burst of parallel task merges, and the correct response.
---

# Post-merge index-script timeouts = transient lock contention, not a bug

`scripts/post-merge.sh` (CREATE INDEX [CONCURRENTLY] IF NOT EXISTS + a few
ALTER/UPDATE on `tenants`/`lp_*`) normally runs in ~3s because every index
already exists in prod (Neon). It can still **time out** when several task
merges land in the same minute: each merge runs this same script against the
**one shared Neon DB**, so a CREATE INDEX (or the tenants ALTER/UPDATE) waits on
a lock another merge is holding and blows past the post-merge timeout.

**Tell:** the merge-failure stdout stops very early (e.g. only the first 2
CREATE INDEX lines), no SQL error, just "timed out after Nms"; a sibling merge
in the same window shows `BLOCKED BY WAITING_FOR_LOCK`.

**Why:** it's not a script defect — the script is idempotent and the indexes
exist. It's contention on shared Neon during a merge storm.

**How to apply:** don't rewrite the script. Re-run it once the storm passes
(`runPostMergeSetup()` — succeeds in ~3s) to reconcile the main app, and keep
the post-merge `timeoutMs` generous (set to 180000) so a transient lock-wait
resolves instead of failing the merge. Only treat it as a real hang if a clean
solo retry still stalls.
