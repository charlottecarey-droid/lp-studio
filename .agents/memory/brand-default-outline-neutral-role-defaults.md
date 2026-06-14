---
name: Brand-default category outline collapse
description: Why category-step page outlines collapse for generic (empty-pool) tenants and how the neutral role-default map prevents it.
---

Brand/segment **page outlines** (Brand Settings → `defaultPageOutline`) are stored as a mix of `block` steps (a literal type) and `category` steps (a role like `hero`, `social-proof`, `content`, `media`, `features`, `cta`, `header`, `footer`). `resolvePageOutline` (lib/lp-template-engine/src/page-outline.ts) resolves each **category** step by:
1. picking the first block of that role from the segment's **approved pool**, else
2. falling back to a per-role `roleDefaults` map, else
3. dropping the step (graceful, no throw).

**Rule:** the `roleDefaults` arg passed at every `resolvePageOutline` callsite must be the shared `NEUTRAL_ROLE_DEFAULT_BLOCKS` (exported from block-tags.ts), which covers ALL body+chrome roles — not a narrow inline `{hero,cta,footer}`.

**Why:** generic tenants have an EMPTY approved pool, so category steps fall straight to step 2. With only hero/cta/footer covered, an 8-step authored outline collapsed to ~3 blocks — the "brand level default doesn't work" report. Curated/Dandy tenants are unaffected: a populated pool is always preferred (step 1) before defaults ever apply, so no Dandy-block leak into generic tenants.

**How to apply:**
- Two production callsites must stay in sync: `generate-microsite.ts` and `generate-page.ts` (its `buildSegmentSection`). The microsite page-outline TEST uses a hand-copied mirror of the resolution chain — keep its `roleDefaults` pointed at `NEUTRAL_ROLE_DEFAULT_BLOCKS` too or the test silently drifts from prod.
- `NEUTRAL_ROLE_DEFAULT_BLOCKS` deliberately OMITS `layout`, `pricing`, `faq` (no sensible neutral block); those category steps still drop gracefully when unsatisfied. Add a role only when a brand-neutral default block genuinely fits.
- Composite-lib gotcha: editing block-tags.ts requires `tsc -b lib/lp-template-engine --force` before consumers see the new export (see lib-db-composite-dist-types).
