---
name: Marketo has two distinct integration paths
description: lp-studio now has TWO unrelated Marketo integrations; know which one before touching "Marketo" code.
---

There are two completely separate Marketo integrations in lp-studio. They share
no tables, services, or routes — confusing "Marketo" code requires identifying
which path first.

1. **Legacy form-lead sync** — config lives in `lp_integrations.config`
   (AES-GCM `v1:` envelope); `syncLeadToMarketo(...)` in `routes/lp/integrations.ts`
   pushes a single inbound form lead. This is what the link-export "connected
   destination" e2e (MARKETO_FAKE_MODE + `lp_integrations` seed) exercises. Phase 1.

2. **Dedicated two-way sales integration (Phase 2)** — own tables
   (`marketo_connections`, `marketo_field_mappings`, `marketo_sync_log`,
   `marketo_lists`, `marketo_activities_pushed` + `sales_contacts.marketo_lead_id`
   / `marketo_last_synced_at`), `lib/marketo-service.ts` singleton, `routes/sales/marketo.ts`,
   and the `/sales/marketo` settings UI. Mirrors the SFDC sales integration pattern
   (sfdc-service / routes/sales/sfdc.ts / sfdc-settings.tsx). Outbound push triggers
   live in campaigns/hotlinks/signals, fire-and-forget, gated on `contact.marketoLeadId`.

**Why:** a future "fix Marketo" task can land in the wrong path entirely; the
legacy single-lead sync and the new bidirectional sales sync look similar by name
but are independent.

**How to apply:** form-lead / link-export destination work → path 1
(`lp_integrations`). Sales contact two-way sync, bulk import, activity push-back,
settings UI → path 2 (`marketo_connections` + `marketo-service.ts`).
`marketoService.getActiveConnection` REQUIRES a non-optional tenantId (unlike the
SFDC service, which omits it).
