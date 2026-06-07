---
name: Featured homepage templates config
description: How the marketing homepage template gallery is driven by superadmin-editable config with a built-in fallback.
---

The marketing homepage "templates" gallery (TemplatesEmbed.tsx, imported by marketing/pages/*.tsx) is superadmin-editable, not hardcoded.

- Source of truth: `featured_homepage_templates` table (schema lib/db, migration + self-heal in api-server migrate.ts). Self-heal seeds 6 rows guarded by WHERE NOT EXISTS.
- Public read: `GET /api/lp/featured-templates` (allowlisted in routes/index.ts LP_PUBLIC; CORS-open). Returns `{templates:[{id,title,description,thumbnail,category,blocks}]}` where `id` is the LP_TEMPLATES id.
- Superadmin: `GET`/`PUT /api/admin/lp/featured-templates` gated by requireSuperadmin (mounted under /admin/lp/*, bypasses the /lp/* guard). PUT replaces the whole list in one transaction.
- Editor UI: SuperAdminFeaturedTemplates.tsx, wired as the "Homepage Featured" tab in SuperAdminPage.tsx (hash #featured-templates).

**Why it matters:** the underlying-template-id MUST resolve to usable blocks or the homepage preview iframe (`/preview/template/:id`) and clone handoff break. The editor's picker only offers valid ids and warns on unknown ones.

**Two id kinds the picker offers:** (1) built-in flagship LP_TEMPLATES ids (string slugs, ~12; blocks bundled client-side); (2) DB-backed global templates encoded as `global:<numericLpPagesId>` via `encodeGlobalTemplateId`/`parseGlobalTemplateId` in lib/templates.ts. The editor loads globals from `GET /api/lp/templates/enriched` (filtered isGlobal). Resolution differs by kind:
- Preview: built-ins render bundled blocks; `global:<id>` fetches `GET /api/lp/global-templates/:id/preview` — a PUBLIC endpoint (LP_PUBLIC pattern `/^\/lp\/global-templates\/\d+\/preview$/`) that serves blocks ONLY for `is_template=true AND is_global=true` rows (tenant templates never exposed). DB column is `is_template` (Drizzle field name is mangled in schema but SQL col is is_template).
- Clone handoff (pages-gallery `?template=` effect): built-ins use createPage+getTemplateBlocks; `global:<id>` calls server `POST /lp/pages/:n/clone` (already allows cross-tenant global templates) then navigates to /builder/:id.
- ALWAYS encodeURIComponent the id in `/preview/template/:id` URLs — `global:<id>` contains a colon.

**Gotcha:** executeSql tool hits a STALE Helium DB that lacks the `is_template` column; verify global-template rows against the real Neon DB the app uses (NEON_DATABASE_URL), not executeSql.

**Fallback:** TemplatesEmbed starts with its built-in TEMPLATES array, then replaces it on a successful non-empty fetch of `${APP_BASE}/api/lp/featured-templates`. Any failure/empty keeps the built-in list, so the section is never blank (also covers dev, where APP_BASE points at prod app.lpstudio.ai).

**Per-row thumbnail has NO fallback:** the marketing card renders `<img src={thumbnail}>` directly; an empty `thumbnail_url` = broken image (the live preview only appears in the modal, never on the card). When adding bespoke single-block templates as featured rows, always set `thumbnail_url` (their `og_image` Unsplash URL is a fine "for now" value). `blocks_count` is display-only — single full-page blocks can carry an estimated count (e.g. 6-8) instead of the literal `1`.

**Quirk:** tool output sometimes renders the identifier "TemplatesEmbed" as "n" (display artifact); the real source imports `TemplatesEmbed from "../components/TemplatesEmbed"`.
