---
name: Email token coordinated edits
description: Adding a new platform-email merge token requires keeping four callsites in sync, or previews/sends leak {{token}} or render blank.
---

Adding a new token to a platform email (e.g. a workspace-invite field like
`acceptUrl`/`workspaceHost`/`inviterName`) requires FOUR coordinated edits:

1. **Variable catalog** — `lib/notification-variables/src/index.ts`
   `PLATFORM_NOTIFICATION_VARIABLES` (gives the inserter a label + a `sample`
   that `buildSampleVars` uses for preview/test-send defaults).
2. **Sender vars** — the real send path (e.g. `sendInviteEmail` in
   `artifacts/api-server/src/lib/notifications.ts`) must pass the token in the
   `renderSystemEmail(key, vars)` map with a real value.
3. **Template `previewData`** — the template def in
   `artifacts/api-server/src/lib/notificationTemplates.ts` so SuperAdmin
   preview/test-send resolves it without a live send context.
4. **The HTML asset** — the body in `emailHtmlAssets.ts` that actually
   references `{{token}}`.

**Why:** the render pipeline HTML-escapes and substitutes only the vars it is
given; a token present in the HTML but missing from any of (1)-(3) shows a raw
`{{token}}` in previews or an empty value in real sends. Derived tokens
(`physicalAddress`, `currentYear`, `unsubscribeUrl`, `subject`, `preheaderText`)
are the exception — `expandEmailVars` fills those on every render path, so they
need no catalog/sender entry.

**How to apply:** after editing an email's HTML, grep the body for `{{...}}` and
confirm each token is either expandEmailVars-derived or wired through all of
catalog + sender + previewData. The drift test
`emailRender.test.ts` asserts a full-custom template renders with no leftover
`{{` — keep that assertion when adding new full-custom emails.
