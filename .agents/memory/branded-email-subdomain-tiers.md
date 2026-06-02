---
name: Branded email subdomain tiers (Tier 1/2/3)
description: How the three sending-domain tiers differ and the resolver precedence that keeps them fail-closed.
---

There are THREE sending-domain tiers, resolved in `tenantSender.ts` `resolveTenantSender`:

1. **Tier 1 — shared default** (`SHARED_SENDING_DOMAIN`): every tenant sends zero-setup as `{Brand} <slug@mail.lpstudio.ai>`.
2. **Tier 2 — branded subdomain** (`mail.<slug>.lpstudio.ai`, `deriveBrandedSubdomain(slug,id)`): platform-MANAGED DNS — we register the domain in Resend AND publish its DNS records into our OWN Cloudflare zone (`cloudflare.ts` createDnsRecord). The tenant never sees DNS records. Gated on the `brandedEmailSubdomain` plan feature (Growth/Scale).
3. **Tier 3 — custom domain** (wizard): the tenant copies Resend's DNS records into THEIR OWN zone. Enterprise-gated.

**Resolver precedence (highest wins):** verified custom domain > verified branded subdomain > shared default.

**Why / how to apply:**
- The resolver does NOT plan-gate (mirrors Tier 3); gating happens only on the write route via `requirePlanFeature`. Both Tier 2 and Tier 3 fail CLOSED via `getResendDomainStatus` — persisting config alone never starts unverified sends; mail flips only once Resend reports `verified`.
- The KEY distinction Tier 2 vs Tier 3 is DNS ownership: Tier 2 = our CF zone (auto), Tier 3 = tenant's zone (manual wizard). When touching either, keep this split intact.
- When on the branded subdomain, the sales sender local-part defaults to the slug (`deriveSlugLocalPart`) unless ctx overrides it.
- Adding/removing a required field on `SalesBrandContext` (e.g. `brandedEmailSubdomain`) breaks every literal construction in tests — typecheck-api catches them all; fix each before running.
