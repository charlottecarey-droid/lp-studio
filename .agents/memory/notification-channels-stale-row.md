---
name: notification_templates channels = capability + toggle, no reconcile
description: Adding a channel to a template in code does NOT backfill existing DB rows; a stale row silently hides that channel's editor with no UI path to restore.
---

The `notification_templates.channels` array is overloaded: it is BOTH the
capability flag (does this template support email/in-app at all) AND the on/off
toggle. The SuperAdmin Notifications UI computes `hasEmail =
tpl.channels.includes("email")`; when email is absent it hides the whole email
editor and shows an "Email handled in code" badge — with no UI control to add
the channel back.

The template loader (`rowToDef` → `sanitizeChannels`) only falls back to the
code-default channels when the DB value is missing or empty. A valid non-empty
row (e.g. `["in_app"]`) WINS over the code default. There is no reconcile that
unions newly-added code-default channels into pre-existing rows.

**Why:** when a channel is later added to a template in code (e.g. `welcome`
gained `email` after its row was already seeded `["in_app"]`), the live row stays
stale forever and the editor never appears. Same family as the legacy default-on
boolean config trap — code intent silently loses to an old DB row.

**How to apply:** if a template's editor/channel is missing in the UI but the
code def lists it, suspect a stale `notification_templates` row, not a code bug.
Fix with a targeted data update (`UPDATE notification_templates SET channels =
'["email","in_app"]'::jsonb WHERE key = '<key>'`) then restart api-server (or
wait out the 60s template cache) so the in-process cache reloads.
