---
name: Sales microsite account linkage & business-case templates
description: How account-detail microsites are resolved, and why business-case templates need special handling in the AI generator
---

## Account → microsite linkage has multiple paths that must stay in sync
A microsite (lp_pages row) can be tied to a sales account by several mechanisms:
- hotlinks (sales_account_hotlinks)
- pageVariables.salesAccountId
- the `account_id` / `sfdc_account_id` COLUMNS on lp_pages (this is what the
  AI generator and the accounts-LIST overview use)

**Why:** the account-DETAIL endpoint (`GET /sales/accounts/:id/microsites`)
once resolved only hotlinks + pageVariables, so it showed "0 MICROSITES" even
though the accounts LIST (which counts via the columns) showed the real number.
**How to apply:** any endpoint/aggregate that counts or lists an account's
microsites must resolve ALL linkage paths, including account_id OR
sfdc_account_id (= account.salesforceId), tenant-scoped, isTemplate=false.
Keep the detail endpoint and hotlinks.ts overview in lockstep — adding a new
linkage mechanism means updating every callsite.

## Business-case templates are global-only single-block monographs
The `business-case-split` / `-centered` / `-premium` blocks are flagship Dandy
sales documents seeded as GLOBAL templates (isGlobal=true), each a SINGLE block
with ~50 nested fields and `{{company_name}}`/`{{practice_count}}` placeholders.

Two things break the AI path if forgotten:
1. **Visibility:** the sales generate-microsite modal must fetch
   `/lp/templates?salesMode=true` (owned + global business-case), NOT
   `?ownedOnly=true` which excludes every global. salesMode detects them via
   `(blocks -> 0 ->> 'type') LIKE 'business-case%'`.
2. **Generation:** the AI cannot reliably reproduce all ~50 fields, so the
   generator deep-merges AI copy OVER the authored template props
   (shape-preserving: keep authored array length, keep authored value on type
   mismatch) and substitutes the placeholders with account data. Never rely on
   the AI alone to fill these blocks.

**Why:** authored props are the complete, on-brand base; AI output is partial.
**How to apply:** when adding another compound single-block template family,
extend `isBusinessCaseType` (or a sibling) + BLOCK_PROP_SCHEMAS + the
post-generation merge, and ensure salesMode surfaces it.

## Cross-tenant guard on template lookup
`generate-microsite` loads templateId from lp_pages; the lookup MUST be scoped
`isTemplate=true AND (tenantId == caller OR isGlobal=true)`. Without it a caller
could pass an arbitrary page id and pull another tenant's private page content
into their generated microsite.
