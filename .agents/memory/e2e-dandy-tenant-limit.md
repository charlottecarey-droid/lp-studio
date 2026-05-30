---
name: E2E can't create Dandy tenants
description: Why lp-studio e2e can only test the non-Dandy side of Dandy-only gating
---
The lp-studio e2e fixture `tests/setup/royal-tenant.ts` seeds tenants with a
`royal-test-<suffix>` slug. The server's Dandy check is slug-based
(`isProtectedEnterpriseSlug` → {"dandy","dandy-smb"}; client checks
brandName==="dandy"), and those exact slugs are unique + already seeded, so a
test CANNOT create a second Dandy tenant.

**Why:** When gating a feature to Dandy-only, e2e can only assert the *negative*
path (non-Dandy tenant is blocked). The positive Dandy path is untestable with
current infra — don't waste time trying to `createRoyalTenant` with a Dandy slug
(unique-constraint collision) and don't impersonate the seeded Dandy tenant in a
spec that writes data (pollutes real Dandy rows).

**How to apply:** For Dandy-gated picker/route work, write the non-Dandy
negative-path spec (hidden in UI + 403 from save/publish routes, plus a
non-gated control to prove it's the gate, not a blanket permission denial).
Restoring positive coverage requires new fixture infra (a safe Dandy
impersonation helper or a way to flag a Royal tenant as Dandy for the check).
