---
name: Template-page seed prop mirroring
description: api-server global-template seeds must hand-mirror lp-studio block defaults (no shared import); they drift silently.
---

The full-page template blocks (event-noir/luminous/split, case-metrics/editorial/modular,
and the same pattern used by business-case) keep their rich default props in TWO places
that cannot import each other:

- lp-studio: `src/lib/block-types/template-page-defaults.ts` — consumed by the block
  registry `defaultProps()` factories (what you get inserting the block in the builder).
- api-server: `src/seeds/templatePageSeeds.ts` — the global marketplace seed props
  (what a tenant clones from the gallery), spread into `globalTemplates.ts` `COMBINED`.

**Why:** api-server cannot import lp-studio package code, so the seed props are a
hand-copied duplicate of the lp-studio defaults. They will drift silently — a field
fixed in one place stays wrong in the other, and typecheck won't catch it (seed props
are `Record<string, unknown>`).

**How to apply:** When editing default content/images/palette for any of these families,
update BOTH files in lockstep. After adding/refreshing seeds, bump `SEED_MARKER`
(`global_templates_seed_vNN`) in `migrate.ts` or the upsert is skipped on boot. Image
URLs are root-relative `/images/...` (served from lp-studio public); ogImage is an
absolute (unsplash) URL for the marketplace thumbnail.
