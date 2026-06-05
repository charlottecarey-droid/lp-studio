---
name: Link-export destination registry
description: How the no-email "generate links only" export is structured so new destinations are one registration.
---

The Quick Campaign wizard's no-email "Generate personalized links only" mode is built
as a pluggable export-destination abstraction. Rows are built ONCE, then handed to a
selected destination.

**Rule:** to add a new export destination (e.g. Clay), implement the `ExportDestination`
interface and add it to the `DESTINATIONS` array in
`artifacts/api-server/src/lib/exportDestinations.ts`. Do NOT add destination-specific
branches in the route or wizard — both discover destinations from the registry.

**Why:** the route (`routes/sales/link-export.ts`) is generic (`POST /:destinationId`
→ `getDestination(id).deliver(...)`) and the wizard panel
(`artifacts/lp-studio/src/components/LinkExportPanel.tsx`) renders buttons + option
inputs from `GET /sales/link-export/destinations` (`listDestinations`). Hardcoding a
button would diverge from the registry.

**How to apply:**
- Row building lives in `lib/linkExport.ts::buildLinkRows` (tenant-scoped; REQUIRES a
  published page; skips contacts without an email; reuses `ensureHotlinkForContact`).
  Never duplicate row building per destination.
- A destination's `deliver()` returns either `{kind:"file"}` (CSV streams a download) or
  `{kind:"message"}` (Sheets/Marketo toast a status). The frontend branches on
  `resultType`, so set it correctly.
- Extra inputs a destination needs (e.g. Marketo `listId` + `linkFieldName`) go in the
  destination's `options` array; the wizard renders them and posts them under `options`.
- Marketo link-field is validated against the instance schema BEFORE any record is sent
  (fail-closed) so one bad field name can't poison the whole createOrUpdate batch.
- A destination can be `available:false` (named on the homepage promise but not shippable
  yet → UI shows "coming soon"). `listDestinations` SKIPS the `isConfigured` probe when
  `!available`. `setupPath` (e.g. "/sales/sfdc", "/integrations") drives the picker's "set
  it up in {location}" hint. Salesforce link-push uses the SYNC connection (sfdc-service
  getActiveConnection/updateContactField), NOT the lp_integrations provider="salesforce"
  form-lead one; it needs `salesforceId` carried on LinkExportRow and skips unsynced rows.
  The webhook destination is one signed JSON POST (HMAC-SHA256, assertPublicHttpsUrl SSRF
  guard + redirect:"manual"); its credential (`signingSecret`) must be in encryption.ts
  CREDENTIAL_FIELDS_BY_PROVIDER or it's stored plaintext.
