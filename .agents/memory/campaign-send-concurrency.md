---
name: Campaign send concurrency
description: How sales campaign /send stays race-free + crash-safe on the Neon pooler, and the one residual duplicate window.
---

Sales campaign `/send` has NO unique (campaign_id, contact_id) constraint, so
idempotency is enforced in app code against `sales_email_sends` rows with
`status='sent'`. Race-freedom requires THREE things together:

1. **Re-derive the recipient set UNDER the claim lock.** A short claim tx takes
   `pg_advisory_xact_lock(hashtext('sales_campaign_send'), id::int)` (xact lock —
   auto-releases on commit; session locks LEAK on the -pooler). Inside that tx,
   after the in-flight check, re-SELECT the already-`sent` contactIds and filter
   the recipient list. The pre-claim idempotency snapshot is ONLY an early-exit
   hint — the authoritative `sendable` is computed under the lock, else two
   near-simultaneous sends can both act on a stale snapshot.
2. **In-flight gate + stale reclaim.** Reject 409 when status='sending' with a
   FRESH `metadata.sendingStartedAt` (< SENDING_STALE_MS=15min). A crashed send
   leaves a STALE marker a later send reclaims.
3. **Heartbeat the marker during the loop.** Refresh `sendingStartedAt` every
   SENDING_HEARTBEAT_MS (2min, << 15min) so a long-but-healthy send is never
   mistaken for crashed and reclaimed mid-flight.

**Why:** the original design (short claim + staleness only, snapshot taken before
the claim) had a double-send window: if send A fully finished between B's snapshot
and B's claim, B re-sent everyone. The under-lock re-filter closes the fast race;
the heartbeat closes the >15min false-stale-reclaim.

**Residual (accepted) duplicate window:** if the provider send SUCCEEDS but the
per-contact `sales_email_sends` insert repeatedly fails (caught + logged, loop
continues — correct, the email already went out), a later stale reclaim can
re-send that one contact, because idempotency is row-based. Only under DB
degradation. The real fix would be a DB unique (campaign_id, contact_id)
constraint making idempotency DB-enforced.

**How to apply:** any change to the send loop must keep per-contact inserts
immediate/durable (not batched at the end) and must not move the authoritative
recipient filter back out of the claim tx.
