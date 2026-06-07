---
name: Campaign signal attribution dual-write
description: How engagement signals get attributed to contacts/accounts and kept in sync with email-send rows in the Sales Console.
---

Engagement signals (opens/clicks/page-views/replies) must be clearly attributed for EVERY tenant. Two distinct surfaces read engagement and they are NOT the same source:

- **Activity feed** (`sales-signals.tsx`) reads `sales_signals` rows directly (joined to contacts/accounts in `routes/sales/signals.ts` GET).
- **Campaign recipient table + summary cards** (`sales-campaign-detail.tsx`) read `sales_email_sends` row state (openedAt/clickedAt/status), NOT signals.

**Rule:** any microsite/hotlink open or click must DUAL-WRITE — insert the `sales_signals` row AND update the matching `sales_email_sends` row (matched by `hotlinkId`). Otherwise microsite engagement shows in the feed but the campaign cards/table miss it. The send-row update must promote status but never downgrade a stronger/terminal state (clicked/bounced/complained) and never overwrite an existing `openedAt`/`clickedAt`. A click implies an open (COALESCE openedAt to now).

**Attribution helper:** `routes/.../lib/signalAttribution.ts#resolveContactByEmail(tenantId, email)` is the ONLY blessed contact-by-email resolver for signal paths. It is strictly tenant-scoped (ilike match) — NEVER add a global/cross-tenant fallback; the same email legitimately exists in multiple tenants' CRMs and a global match leaks attribution. POST /signals uses it to attach contactId+accountId when an integration omits them (reads `metadata.email`). GET /signals does a batched tenant-scoped email lookup to render a display name for NULL-contact rows. Frontend falls back contactName → accountName → "Anonymous".

**Why "outreach" rows were invisible:** integration-pushed signals arrived with `source:"outreach"`, `contact_id` NULL, and no resolvable link. Fix = resolve from metadata.email at write-time + read-time + a one-shot marker-gated backfill in `migrate.ts` (`sales_signal_attribution_backfill_v1`). Backfill only attributes UNAMBIGUOUS matches (HAVING count(*)=1) to avoid mis-attribution, reconciles historical send rows from past hotlink signals, and rewrites the opaque "outreach" source to a readable label.
