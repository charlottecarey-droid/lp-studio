---
name: Global template seed marker + industry gating
description: How DB-backed global LP templates reach every surface, and where industry gating is (and isn't) enforced.
---

# Adding a global/flagship template

Adding a seed to `flagshipTemplates.ts` / `globalTemplates.ts` (they merge into
`GLOBAL_TEMPLATE_SEEDS` via `COMBINED`) does **nothing** until you bump
`SEED_MARKER` (`global_templates_seed_vNN`) in `artifacts/api-server/src/migrate.ts`.
The seed loop is marker-gated and runs once per DB; the upsert is
`ON CONFLICT (tenant_id, slug) DO UPDATE` so bumping is non-destructive (it
refreshes blocks/labels/og_image/industry on existing rows but preserves tenant
title edits). After bumping, restart the api-server workflow to apply.

**Why:** the two newest flagships (`global-flagship-storefront-dtc` /ecommerce,
`global-flagship-blog-series-editorial` /media) were added to the seed file after
v24 was recorded, so they never reached the DB and were invisible everywhere.

# One seed feeds every surface

`GET /lp/templates/enriched` returns the union of (tenant-owned templates) + (all
`is_global` templates). It is the single source for **all three** template
surfaces: the marketplace (`template-marketplace.tsx`), the builder/create-page
Template tab AND the AI "Starting Point" dropdown (both via
`pages-gallery.tsx` `visibleApiTemplates`). The AI dropdown passes the chosen
DB `templateId` straight through to `/api/lp/generate-page` (template-rewrite
mode). So once a generic global is seeded, it appears in all three with no
frontend change.

# Where industry gating IS and ISN'T enforced

- **Client-side LP_TEMPLATES + microsite templates** ARE dental-gated (in
  `lib/templates.ts` `getTemplatesForIndustry` + `tenantIndustry === "dental"`
  checks in `create-page-modal.tsx`). These are the hardcoded Dandy/dental cards.
- **DB-backed `is_global` templates are NOT industry-gated server-side.** The
  enriched endpoint deliberately returns all globals "regardless of industry"
  (see its comment). So the 4 `industry:"dental"` DB globals (the Dandy
  `global-business-case-*` business-case microsites) are visible to non-dental
  tenants in the marketplace + create modal. This is pre-existing; surfacing
  generic globals does not change it. If a task requires DB-level dental gating,
  it must be added at the enriched endpoint (filter `industry='dental'` unless the
  tenant's industry is dental) — that's a behavior change to documented intent,
  not a no-op.
