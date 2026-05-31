---
name: "deduped" is not proof of delivery on workflow send-failure retry
description: Why resolving a recipient-failure ledger row on a dispatcher "deduped" outcome can silently clear an undelivered send
---

The notification dispatcher's email path claims a `notification_sends` row
(`status='pending'`) BEFORE sending, then on send failure releases the claim
with a **best-effort DELETE that is swallowed on error**. So an undelivered
`pending` row can linger on the dedupe slot when both the send AND the
claim-release DELETE fail.

A `dispatchNotification` result of `deduped > 0` only means "a row already
occupies this `(dedupe_key, channel)` slot" — it does NOT mean the recipient
received anything.

**Why:** the workflow send-failure manual retry (`retryWorkflowSendFailure`)
must NOT mark a ledger row resolved just because the re-dispatch came back
`deduped`. A stale `pending` claim would make retry falsely resolve an
undelivered failure, defeating the entire safety-net silently.

**How to apply:** when a retry's re-dispatch reports `deduped`, look up the
occupying `notification_sends` row's `status`:
- `sent` → genuine delivery, resolve (no second copy).
- `pending` → stale orphaned claim (the dispatcher sweep is itself blocked by
  it); DELETE the pending row and re-dispatch exactly once, resolve only if that
  actually delivers.
- missing (race) → treat as not delivered, leave unresolved.
in_app rows are only ever written `status='sent'`, so they pass the `sent` check
naturally. This same "claimed pending row can outlive a failed send" hazard
applies to any future code that infers delivery from claim-slot occupancy.

**Concurrency:** two simultaneous retries of the same ledger row could both enter
the stale-`pending` repair branch, delete each other's in-flight claim, and
double-send. Serialize per-row with a transaction-scoped advisory lock
(`pg_advisory_xact_lock(hashtext('...'), id)`) held across the whole retry.
- Use xact-scoped, NOT session, advisory locks — they auto-release on
  COMMIT/ROLLBACK so they don't leak on the `-pooler` endpoint.
- An advisory lock does NOT conflict with the dispatcher's own row writes to
  notification_sends / workflow_send_failures on other pooled connections, so
  there is no deadlock — only another retry taking the SAME advisory key blocks.
- Also guard the stale delete: re-send only when the DELETE's rowCount > 0.

