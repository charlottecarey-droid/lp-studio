---
name: Settings hub consolidation
description: LP Studio Settings is one tabbed hub (SettingsPage); section bodies are *Content exports; recipient "default" is row-absence.
---

# Consolidated tabbed Settings hub

Settings is a SINGLE tabbed hub (`pages/settings/SettingsPage.tsx`), not separate
routed pages. The hub owns the `AppLayout` wrapper and switches body by URL.

**How to apply:**
- Each section page exposes a named `*Content` component (General/Domain/Seo/
  Notifications/EmailTemplates + AlertRecipients). Edit the `*Content` export when
  changing a section; the page-level `default` export is dead.
- The hub is the only thing routed for the settings surfaces; it is open to any
  authenticated member and gates admin tabs client-side on
  `isAdmin || permissions["settings"]`. The server must re-check every admin
  endpoint regardless.
- Old per-surface URLs deep-link to the right tab/sub-tab. Keep that mapping in
  sync if URLs change. Adding a new settings surface = add a `*Content` export +
  a tab entry, NOT a new route/sidebar item. The sidebar has ONE "Settings"
  entry whose `isActive` must not swallow `/settings/billing|team|roles`.

# Broadcast alert recipients: "default" means NO row

**Why:** the resolver contract is row-absent = legacy default audience
(collaboration → all members; account/billing → all admins, fail-open). An
empty *saved* row is a different state: "send to nobody" (collab) /
"fail-open to admins" (account/billing).

**How to apply:** restoring the default audience requires DELETE-ing the
`(tenant_id, alert_type)` row, never a save with empty arrays. The UI "Reset to
default" must call the DELETE endpoint and flip the row to unconfigured; a
save-empty would silently disable collaboration alerts.
