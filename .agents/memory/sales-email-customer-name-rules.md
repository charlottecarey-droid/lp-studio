---
name: Sales email per-tenant phrasing guardrail
description: How brand/legal phrasing constraints reach the AI cold-email generators, and why fixing the stored proof point alone is not enough.
---

# Sales-email phrasing guardrail

The cold-email generators (`draft-email.ts` = 3-sentence Problem/Proof/Ask, `email-generate.ts` = HTML composer) **paraphrase** the approved proof point at generation time. Fixing the stored proof (seed/migration) does NOT hold: the model reword s it, reintroducing banned phrasing.

**Rule:** brand/legal phrasing constraints belong in the per-tenant `SalesBrandContext.customerNameRules` field (editable in brand-settings "Customer naming rules"), which is injected verbatim into BOTH email prompts as a mandatory block. Never hardcode a tenant name (e.g. "Dandy") into the shared prompt builders — that violates the white-label architecture.

**Why:** Dandy (tenant 1) must say DCA consolidated labs "through a strategic partnership with Dandy", never "down to one". The approved proof was already stored correctly but the AI kept paraphrasing it back to the banned form. The fix = wire `customerNameRules` into the prompts + seed tenant 1's rule (migration 0105, idempotent/append-only — it preserved the pre-existing "Apex" naming rule).

**How to apply:** when a tenant needs a copy/naming constraint in sales emails, add it to `customerNameRules` (UI or a tenant-scoped migration), not to the prompt source. The field was historically stored but unwired — confirm it is still injected in both generators before relying on it.

**Spacing aside:** the draft-email body renders in a plain `<textarea>` (newlines verbatim). `spaceOutEmailSections()` deterministically rejoins content lines with one blank line because the model is inconsistent about leaving blank lines; safe only because draft-email bodies are a fixed shape (greeting + 3 short sentences + "Best,"), no signature/bullets to preserve.
