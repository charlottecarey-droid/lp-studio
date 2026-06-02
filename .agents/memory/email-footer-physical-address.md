---
name: Email footer postal address (platform + tenant)
description: How the {{physicalAddress}} footer line is sourced/rendered across every LP Studio email shell, and the coordinated edits a footer-address change needs.
---

Every email footer sources its postal address from its OWN shell's saved address, not a global constant:
- Tenant emails → tenant shell row `physical_address` (resolveTenantShell).
- Platform/auth/welcome/invite/superadmin emails → the platform shell singleton's `physical_address` (getPlatformPhysicalAddress / email_shell_templates).

**Rule — never prefix the address with brand text.** Platform footers used to print `LP Studio · {{physicalAddress}}` on one line; when the address is blank that leaves a stray `·`. Put `{{physicalAddress}}` on its OWN paragraph (the copyright line keeps the "LP Studio" identity). interpolateHtml ESCAPES vars, so you cannot conditionally inject `<br>`/markup around a blank token — separate paragraphs are the only clean collapse. Blank → empty `<p style="margin:0">` collapses cleanly (no `·`, no `undefined`).

**Rule — saved custom footers can omit the token.** A tenant or superadmin can save a custom `footer_html` lacking `{{physicalAddress}}`; the address would then never reach the recipient. `ensureFooterAddress(footerHtml, address)` in tenantEmailShell.ts appends a styled address paragraph ONLY when address is non-blank AND the footer doesn't already reference the token. It injects at RENDER time only — never mutate the saved footer_html (an integration test asserts the saved row is untouched).

**Why:** physicalAddress always resolved empty for platform emails before this (no field existed), and brand-prefixed single-line footers left a stray separator when blank.

**How to apply — a managed footer token / address change needs coordinated edits or it leaks `{{token}}`/renders blank:**
1. The HTML bodies that carry the token: master shell footer + welcome magazine + invite (emailHtmlAssets.ts). Welcome originally had NO address token — full-custom (wrapInShell=false) bodies must carry the token themselves since the shell footer isn't used.
2. Send paths inject the resolved address into vars: notificationDispatcher (welcome/lifecycle) + renderSystemEmail (invite/magic_link/reset/verify) — both already destructure physicalAddress from resolveEmailShellForEmail and inject when ctx/vars don't have it.
3. Superadmin preview + test-send + shell-preview (routes/notifications.ts) must mirror the live send: inject the platform address into vars AND wrap shell.footerHtml with ensureFooterAddress, else the preview won't match delivery.
4. Persist + surface the field: admin email-shell PATCH/GET (physical_address column) + the ShellEditor UI (SuperAdminNotifications.tsx). Tenant side lives in EmailPage.tsx + tenant email-shell routes.

emailRender.test.ts does NOT pin exact footer byte strings (only asserts no leftover `{{` + presence of certain text + that physicalAddress is expandEmailVars-derived), so footer markup edits are safe there.

**Gotcha — superadmin TEMPLATE preview never auto-fills the saved address.** `addressForPreview(previewData, savedAddress)` returns `previewData.physicalAddress` when present, else `savedAddress`. But `DEFAULT_PREVIEW_DATA = buildSampleVars(PLATFORM_NOTIFICATION_VARIABLES)` (notificationTemplates.ts) ALWAYS injects a SAMPLE `physicalAddress` (e.g. "123 Market St…") into every code template's previewData, so the saved platform address never falls through in the template-preview route. Only the SHELL-preview route reads `getPlatformPhysicalAddress()` directly → it's the one that proves saved-address auto-fill. To test the template preview, pass an explicit `previewData.physicalAddress`. The sample lives in the var catalog (not a string literal in src — built by buildSampleVars), so grepping "123 Market St" only finds test files.

**Gotcha — the saved (DB-merged) full-custom welcome body can silently lose the token.** The shipped code default (NOTIFICATION_TEMPLATES["welcome"], MAGAZINE_WELCOME_HTML) carries `{{physicalAddress}}`, but an editor can save a `notification_templates.welcome` row whose body drops it; since wrapInShell=false has NO shell footer, ensureFooterAddress can't save it → CAN-SPAM gap. Regression tests should assert the CODE-DEFAULT welcome body carries the token + that resolveEmailShellForEmail("welcome", anyTenantId, false) returns the PLATFORM address (welcome is non-brandable for the address), rather than depending on the mutable DB body.

**Gotcha — test-send isn't free.** sendViaResend THROWS without RESEND_API_KEY (route 500s) and sends a REAL email with one; it shares the exact render seam as the preview routes, so cover the address via preview, not a live test-send.
