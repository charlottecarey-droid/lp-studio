---
name: HubSpot integration mirrors Marketo Phase 2
description: HubSpot CRM sync is a faithful copy of the Marketo Phase 2 service; several correctness-sensitive patterns are SHARED and must be fixed in both together.
---

The HubSpot two-way CRM sync (hubspot-service.ts, hubspotSyncPoller.ts, routes/sales/hubspot.ts, hubspot-settings.tsx) was built as a deliberate mirror of the Marketo Phase 2 integration. Auth differs: HubSpot uses a per-tenant **Private App token** (long-lived bearer pasted by the tenant — NO OAuth, no refresh, no redirect, no platform secret). The token is AES-256-GCM encrypted at rest via the credential whitelist entry `hubspot: ["accessToken"]`, decrypted only at use-time.

**Shared patterns that are intentionally identical to Marketo (do not "fix" only one side):**
- `getActiveConnection(tenantId)` selects `status='connected' AND syncEnabled=true` with `.limit(1)` and **no deterministic ORDER BY**.
- The connect route upserts on `(tenant_id, externalAcctId)` (HubSpot `portal_id`, Marketo `munchkin_id`), so a tenant CAN have multiple "connected" rows if they paste tokens for two different portals/instances. The poller then processes all eligible rows.
- Outbound idempotency (`pushFormLead`, `pushEngagementScore`, email-activity) is **check-then-act**: `alreadyPushed()` SELECT → external API call → ledger insert with `onConflictDoNothing()`. Not atomic under concurrent same-`localEventId` calls.

**Why:** task was explicitly "mirror Marketo Phase 2". A code review flagged the multi-active-connection nondeterminism and the push race as correctness risks. They are real but are inherited from the Marketo design, not HubSpot regressions; in practice form-lead `localEventId` is `form_lead:${lead.id}` (unique, fired once per submission) so the race window is negligible.

**How to apply:** if you ever harden connection selection (single active per tenant / deterministic ordering) or make outbound pushes claim-first/atomic, apply the change to BOTH marketo-service.ts and hubspot-service.ts in lockstep to keep parity, plus their connect routes.
