---
name: Branded email subdomain (Tier 2) provisioning
description: How {slug}.lpstudio.ai auto-provisioning is wired across Resend + our own Cloudflare zone, and the safe-to-expose-pre-verify routing invariant.
---

Tier 2 branded email = auto-provisioned `{slug}.lpstudio.ai` sending domain for
plans with the `brandedEmailSubdomain` feature (growth/scale/enterprise).

**Key distinction from Tier 3 (BYO custom `sendingDomain`):** the subdomain
lives under OUR `lpstudio.ai` Cloudflare zone, so WE publish Resend's returned
SPF/DKIM/MX records into that zone via the CF DNS-record CRUD. The tenant never
edits DNS. Tier 3, by contrast, has the tenant edit their own DNS.

**Routing invariant (why it's safe to expose pre-verify):** the effective
`sendingDomain` derived in getSalesBrandContext surfaces the branded subdomain
as soon as it's *provisioned* — it is NOT gated on a stored `active`/verified
flag. This is safe because the live sender resolver (`tenantSender.ts`,
do-not-modify) fail-closes on the LIVE `getResendDomainStatus`: until Resend
reports `verified`, sends fall back to the Tier 1 shared default
(`mail.lpstudio.ai`). So enabling mid-campaign never breaks sends.
**Why:** duplicating an `active` gate in the derivation would risk drift with
the resolver's live check; one source of truth (live Resend status) avoids it.

**Provision/deprovision rollback:** provision rolls back BOTH created CF records
AND the Resend domain if any CF write fails (never leaks). Deprovision deletes
CF records by stored id, falling back to name lookup when ids are missing, then
removes the Resend domain — continues past individual failures.

**Landmine:** `SalesBrandContext.brandedSubdomain` / `brandedSubdomainResendId`
must stay OPTIONAL on the interface. Many test fixtures and prompt-builders
construct the context object as a literal; making these required breaks every
such callsite with TS2322 "undefined not assignable to string".

**Persistence:** stored on `lpBrandSettingsTable.config.salesConsole`
(`brandedSubdomain`, `brandedSubdomainResendId`, `brandedSubdomainDnsRecordIds`,
`brandedSubdomainActive`) — managed only by the `/sales/branded-email`
GET/POST/DELETE router, never edited via the brand-config form.
