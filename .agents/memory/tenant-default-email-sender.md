---
name: Tenant default email sender (Tier 1 shared domain)
description: Every tenant has a zero-setup default sender; all send call sites must resolve through it and fail closed on unverified custom domains.
---

Every tenant can send branded email with NO setup via the Tier 1 shared default:
`{Brand Name} <{slug}@mail.lpstudio.ai>` (mail.lpstudio.ai is permanently verified
in the Resend account, so any local part under it is deliverable). reply-to =
tenant replyTo → workspace owner email (earliest accepted admin) → omitted.

**Rule:** every outbound-email call site resolves the envelope through
`resolveTenantSender(tenantId, kind, {ctx?, overrides?})` (artifacts/api-server/
src/lib/tenantSender.ts), NOT inline `{senderName} <{local}@{domain}>` strings.
The pure core is `buildSenderIdentity(...)` (unit-testable, no I/O).

**Fail closed (never violate):**
- A custom `sendingDomain` is used ONLY when Resend reports it `verified`
  (getResendDomainStatus === "verified"). Unverified / unknown / API-down →
  fall back to the shared default. Never send from an unverified custom domain.
- The only non-tenant domain ever emitted is the shared mail.lpstudio.ai.
  Never borrow another tenant's domain.
- Per-call `senderLocalPart` overrides apply ONLY on a verified custom domain;
  the shared default always uses the slug-derived local part (deriveSlugLocalPart:
  lowercase, [a-z0-9.-] only, fallback `tenant-{id}`).

**Why:** the old code refused to send (400 "Sales Console isn't fully
configured") whenever sender/domain/replyTo were unset — so brand-new tenants
couldn't send at all. Removing those guards means an unconfigured tenant must
still get a working, brand-correct from-header, never a blank/borrowed one.

**How to apply:** when adding a new email send path, call resolveTenantSender
and spread reply_to conditionally (`...(sender.replyTo ? {reply_to} : {})`) —
reply_to is optional now (sendViaResend payload types updated to `reply_to?`).
Current call sites: routes/sales/hotlinks.ts (notifications), campaigns.ts (3
paths: bulk campaign, /send-email single, /send-test-email), campaign-pages.ts
(launch).

**Plan flags (groundwork only):** PlanFeatures gained `brandedEmailSubdomain`
(Tier 2; growth/scale/enterprise) + `customEmailDomain` (Tier 3; enterprise
only). These gate the two downstream domain-provisioning tasks; the Tier 1
shared default is always available regardless of plan. Resend Domains write
wrappers (createResendDomain / getResendDomainById / deleteResendDomain) live in
resendDomainStatus.ts, fail-open to `{available:false}` when no key/API error.
