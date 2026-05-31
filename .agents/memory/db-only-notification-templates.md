---
name: DB-only notification templates need every admin CRUD callsite
description: Blank-slate (DB-only) notification templates must be supported at every admin route, not just create/list.
---

Phase 3 added "blank-slate" notification templates: superadmin-created rows in
`notification_templates` (scope='platform', category='lifecycle') with NO code
counterpart in the `NOTIFICATION_TEMPLATES` registry. The resolver
(`getNotificationTemplate` / `getNotificationTemplates` / `loadFromDb` +
`buildDbOnlyDef`) surfaces them, and POST creates them.

**Rule:** every admin notification-template route must resolve the template via
`getNotificationTemplate(key)` (or the DB row), NOT by indexing the code registry
`NOTIFICATION_TEMPLATES[key]`. Gating on the registry silently 404s DB-only keys.

**Why:** the editor saves via `PATCH /api/admin/notification-templates/:key`. That
route originally hard-gated on `NOTIFICATION_TEMPLATES[key]`, so freshly created
blank templates were unsaveable (404). A new create path needs its sibling edit /
preview / test-send paths updated in lockstep.

**How to apply:** keep a separate `codeDef = NOTIFICATION_TEMPLATES[key]` handle
only for rules that are genuinely code-owned — e.g. the declared-channel subset
restriction (a code template can't invent a channel). DB-only templates have no
code-declared subset, so they accept any valid channel (email / in_app).
