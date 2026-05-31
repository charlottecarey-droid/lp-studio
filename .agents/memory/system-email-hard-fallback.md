---
name: System email hard-fallback must be shell-independent
description: Migrated transactional/auth email senders need a self-contained fallback that does not depend on the editable shell
---

When a hardcoded transactional/auth email sender is migrated into the
notification_templates registry (rendered via `renderSystemEmail(key, vars)`),
its code fallback MUST be a fully self-contained HTML document — never built by
wrapping an inner body in the editable shell (`getEmailShell()` + `renderEmail`).

**Why:** the "auth/login never breaks" guarantee covers a broken *or blank*
shell override too. `renderSystemEmail` returns null on a disabled/blank/throwing
template and the caller falls back — but if that fallback itself runs through the
same shell, a corrupted/empty `shell_html` produces empty output and the email
still breaks. The fallback has to be independent of every DB-editable surface.

**How to apply:** for any new migrated system email, build the fallback from a
standalone full-HTML helper (e.g. `buildAuthActionEmailHtml(...)`) or an inline
`<!DOCTYPE html>...` string with the action/CTA URL baked in. Reserve shell-based
rendering for the *primary* template path only. The `workspace_invite` sender was
the one that originally got this wrong.
