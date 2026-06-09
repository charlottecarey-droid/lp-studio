---
name: AI sales briefing seller→prospect direction
description: Why AI sales-intelligence generators must explicitly frame tenant=SELLER vs account=PROSPECT, or the model flips to "account sells to itself".
---

# AI sales generators must lock seller→prospect direction

Any AI generator that briefs a sales team on a researched account (account
briefing, contact/person brief, microsite copy, draft email) must state the
direction explicitly: the **tenant is the SELLER**, the **researched account is
the PROSPECT/buyer**, and every value prop / talking point / recommended
message / page recommendation positions the tenant's services being sold TO the
account.

**Why:** the account briefing originally named the seller only once and left the
JSON schema entirely prospect-shaped (overview, leadership, fitAnalysis...).
With weak/absent tenant brand identity the model flipped perspective and briefed
"how the account should sell to its own customers" (observed: a Televerde tenant
briefing the Rasta account as if Rasta were the seller). The contact brief
(person-brief.ts) never had this bug because it frames "a B2B sales rep at
{brand}" up front.

**How to apply:**
- Pull the seller identity from `getSalesBrandContext(tenantId)` (robust
  brandName + valuePropPairs + salesIntroLine + briefBlurb), never infer it from
  account-only context.
- Build separate `=== THE SELLER ===` and `=== THE PROSPECT ===` blocks plus
  field-level direction rules (primaryValueProp = why the account should buy
  from the seller; recommendedMessage = what a seller rep says; etc.).
- Seller fallback chain must end neutral ("our company") — never the prospect's
  name.
- Keep the prompt builder a pure exported function so the direction is unit
  tested (see briefings.prompt.test.ts / person-brief.prompt.test.ts).
