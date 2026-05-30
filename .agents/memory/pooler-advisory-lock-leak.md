---
name: Session advisory locks leak on the Neon -pooler endpoint
description: customDomainPoller integration tests flake (0 sends) because pg_try_advisory_lock leaks on PgBouncer transaction-mode; same latent risk in prod.
---

`@workspace/db`'s `NEON_DATABASE_URL` is the Neon **-pooler** endpoint (PgBouncer, transaction mode). Confirm with `host.includes("-pooler")`.

**The trap:** session-scoped `pg_try_advisory_lock(k,o)` and its matching `pg_advisory_unlock(k,o)` can land on **different server backends** under transaction pooling, so the unlock no-ops and the lock leaks on the original backend (which PgBouncer keeps in its server pool). A low-load sequential lock→unlock→relock probe will *appear* to work because both queries happen to reuse the same warm backend — the leak surfaces under concurrency.

**Symptom:** `customDomainPoller.integration.test.ts` fails with `sendActiveMock ... expected 1, got 0` for every "expect a send" case while the "not.toHaveBeenCalled" cases pass. Cause: its first test fires **5 concurrent** `runCustomDomainPoll()`, leaking advisory lock `(415,1)`; once leaked, every later poll hits the `if (!locked) return` gate and no-ops — and the orphan persists into the *next* run, so isolation runs look worse (5 fails) than full-suite (2 fails). Killing a vitest run mid-poll also leaves the orphan.

**Verify / clear the orphan:** query `pg_locks WHERE locktype='advisory' AND classid=415 AND objid=1`; release by `pg_terminate_backend(pid)` (can't unlock another session's lock). The poller's own scan path is otherwise correct (acquires when free, scan finds rows, unlock releases) — these failures are an integration-test isolation artifact, NOT a product defect.

**Latent prod risk:** `runCustomDomainPoller` uses the advisory lock as a hard gate (skip scan if not acquired), so a real leak would *silently disable* the poller until the backend is recycled — contradicting the code comment that calls layer-2 a mere optimization. Prod runs single sequential polls every 2 min (lower risk), but the safe fix is `pg_advisory_xact_lock` inside a transaction (auto-releases at txn end, pooler-safe) or dropping layer-2 and relying on the layer-3 atomic claim.

**Why:** runtime correctness on a pooler ≠ session-advisory-lock correctness; concurrency is what exposes it.
