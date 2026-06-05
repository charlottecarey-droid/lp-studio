---
name: Featured homepage templates config
description: How the marketing homepage template gallery is driven by superadmin-editable config with a built-in fallback.
---

The marketing homepage "templates" gallery (TemplatesEmbed.tsx, imported by marketing/pages/*.tsx) is superadmin-editable, not hardcoded.

- Source of truth: `featured_homepage_templates` table (schema lib/db, migration + self-heal in api-server migrate.ts). Self-heal seeds 6 rows guarded by WHERE NOT EXISTS.
- Public read: `GET /api/lp/featured-templates` (allowlisted in routes/index.ts LP_PUBLIC; CORS-open). Returns `{templates:[{id,title,description,thumbnail,category,blocks}]}` where `id` is the LP_TEMPLATES id.
- Superadmin: `GET`/`PUT /api/admin/lp/featured-templates` gated by requireSuperadmin (mounted under /admin/lp/*, bypasses the /lp/* guard). PUT replaces the whole list in one transaction.
- Editor UI: SuperAdminFeaturedTemplates.tsx, wired as the "Homepage Featured" tab in SuperAdminPage.tsx (hash #featured-templates).

**Why it matters:** the underlying-template-id MUST be a real, usable LP_TEMPLATES id (catalog in lp-studio/src/lib/templates.ts, ~12 ids) or the homepage preview iframe (`/preview/template/:id`) and clone handoff break. The editor's picker is a dropdown of the full LP_TEMPLATES catalog for exactly this reason; it warns on unknown ids.

**Fallback:** TemplatesEmbed starts with its built-in TEMPLATES array, then replaces it on a successful non-empty fetch of `${APP_BASE}/api/lp/featured-templates`. Any failure/empty keeps the built-in list, so the section is never blank (also covers dev, where APP_BASE points at prod app.lpstudio.ai).

**Quirk:** tool output sometimes renders the identifier "TemplatesEmbed" as "n" (display artifact); the real source imports `TemplatesEmbed from "../components/TemplatesEmbed"`.
