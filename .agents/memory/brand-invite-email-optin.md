---
name: Branded seat-activation (workspace_invite) email opt-in
description: Account-access invite emails default to platform branding (anti-phishing); tenant branded override is self-serve, fail-closed, and must hard-fallback on a blank render.
---

# Branded seat-activation email opt-in

Seat-activation / account-access emails (the `workspace_invite` "you've been added,
click to accept" email) are **platform-branded (LP Studio) by DEFAULT**. A per-tenant
self-serve flag (`tenant_email_shells.brand_invite_emails`) lets any workspace admin
opt IN to render that email into their OWN branded shell instead.

**Rules (keep consistent for any future account-access email that gains a brand override):**
- Default OFF. The flag accessor fails closed to `false` (DB error → platform path).
- When `tenantId` is absent the branded branch is skipped entirely (legacy callers
  stay byte-identical to the platform path) — do not consult the flag.
- The branded render is wrapped in try/catch; ANY failure drops through to the
  unchanged platform path.
- **Hard fallback on blank render:** a tenant shell's `shell_html` can be saved as
  `""`, so a branded render can produce visually-empty HTML. After rendering, strip
  tags and if there is no visible text, treat it as a failure and fall back — never
  send an empty invite. Guarded by `notifications.invite.test.ts`.

**Why:** account-access emails are phishing-sensitive, so the safe default is the
platform's recognizable chrome; the override is opt-in and must never be able to
break or blank-out delivery.

**How to apply:** the branding decision lives in `getTenantInviteBrandingEnabled` +
the branded branch of `sendInviteEmail` (notifications.ts). UI toggle is in the
Settings → Email shell editor; its save callback must list the toggle state in its
`useCallback` deps or a toggle-only save submits a stale value.
