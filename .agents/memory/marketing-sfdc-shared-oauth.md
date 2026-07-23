---
name: Marketing SFDC integration shares sales-console OAuth
description: How the tenant marketing (LP) Salesforce integration connects and syncs form leads after the client_credentials → OAuth migration.
---

The tenant Settings → Integrations Salesforce card and the sales console share ONE
per-tenant OAuth connection row (`sfdc_connections`), against the shared platform
Connected App. A tenant connected from either surface is connected for both — do
not add a second connection store for marketing.

**Form-lead write-back is OAuth-only.** Marketing form submissions create SFDC Leads
exclusively through `sfdcService` (the active OAuth connection, with token refresh) in
the SFDC write-back block of `routes/lp/leads.ts`. The legacy per-tenant
`client_credentials` path (manual Instance URL / Client ID / Secret in `lp_integrations`,
plus `syncToSalesforce`/`getSalesforceToken` in `lib/notifications.ts` and
`syncLeadToSalesforce` in `routes/lp/integrations.ts`) was removed. The
`SalesforceConfig` interface is kept only for the per-form field-mapping shape.

**Per-form behavior preserved:** a form opts out via `perFormSalesforce.enabled === false`
(skip connection lookup) and its `fieldMappings` (formField → SFDC Lead field) are spread
LAST into `createLead({ customFields })` so they override structured fields + UTM defaults.

**Callback is dual-mode for back-compat.** `/api/sales/sfdc/callback` branches on a
signed `returnTo` embedded in the OAuth state (`lib/sfdc-oauth-state.ts`,
`signSfdcState(tenantId, returnTo)` HMAC'd by WORKER_HOST_SECRET, 10min TTL,
returnTo sanitized to a same-origin relative path):
- returnTo present (marketing) → `res.redirect(returnTo?salesforce=connected|error)`
- returnTo absent (sales console) → legacy JSON response (unchanged).

The marketing Integrations page reads `?salesforce=connected|error`, shows a banner,
refetches status, and strips the query param via history.replaceState.

**Why:** one-click Connect mirrors the sales console; tenants must never re-enter
Connected App credentials, and a sales-console-connected tenant must not reconnect.

**Org uniqueness + disconnect ≠ delete.** `sfdc_connections.org_id` is globally UNIQUE:
one Salesforce org can be linked to only ONE tenant. The app's "Disconnect" only sets
`status='disconnected'` — the row (and its org_id claim) survives, so a different tenant
connecting the same org gets a duplicate-key insert failure surfaced as the generic
"Failed to complete OAuth exchange" (token exchange actually succeeded; the auth code is
consumed, so a retry then shows invalid_grant/expired code). Diagnose in api-server logs
(duplicate key on `sfdc_connections_org_id_key`); unblock by deleting the stale
disconnected row for that org. The callback upsert only matches same tenant+org.
Also: redirect_uri is built from global secret `API_BASE_URL` (now
https://app.lpstudio.ai, one GLOBAL secret shared by dev AND prod — so
dev-initiated Slack/SFDC connect flows bounce through the prod host; acceptable
with the shared DB). It must be listed in the Connected App callback URLs.
loadEnv normalizes it (trim + strip trailing slash), see
base-url-env-normalization.md.
