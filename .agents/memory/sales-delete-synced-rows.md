---
name: Sales account/contact delete allows synced rows
description: Why the salesforceId guard was removed from sales account/contact delete endpoints, and the resync caveat.
---

The `DELETE /sales/accounts/:id`, `/sales/accounts/bulk`, `DELETE /sales/contacts/:id`, and `/sales/contacts/bulk` endpoints do NOT guard on `isNull(salesforceId)`. Salesforce-synced rows are hard-deletable just like CSV-only rows. Deletes stay tenant-scoped (`tenantId`).

**Why:** The four-view delete feature requires every row to be removable from the UI; gating on CSV-only origin left synced rows undeletable, which contradicted the product requirement. Hard delete only (no soft-delete/undo).

**How to apply:** A deleted synced row can reappear on the next Salesforce sync — this is expected, not a bug. The UI surfaces an amber warning in the confirm dialog when a selected/targeted row has a `salesforceId`. If you ever re-add an origin guard, you must also remove that UI warning and re-introduce CSV-only checkbox gating.
