---
name: DSO block cross-tenant exposure
description: When a DSO/vertical-specific block becomes selectable by ALL tenants (general LP + microsite recipe dropdowns), what hidden vertical bias must be neutralized.
---

# Exposing a vertical-specific (DSO) block to every tenant

Adding a `- "type": …` bullet to `GENERAL_EXTRA_CORE_BLOCKS` in `generate-page.ts`
auto-exposes a block in BOTH recipe dropdowns (general + microsite union), both
`validateSkeleton` allow-sets, AND the microsite freeform guide (general bullets
are lifted). So the dropdown plumbing is one edit. The risk is everything DOWNSTREAM
that block touches was written assuming it only ran on the dental/DSO path.

**Rule:** before exposing a DSO/vertical block to general tenants, audit its
per-block branches in the image-fill + normalize pipelines for baked-in vertical
assumptions and neutralize them.

**Why:** the blocks already had renderers + dso-path schemas, but their
support code carried dental bias that is invisible until a non-dental tenant
selects them:
- Image-fill context strings hardcoded a vertical keyword (e.g. a bento photo tile
  built its search context as `${caption} dental clinical`). On a non-dental page
  that steers the tile toward clinical imagery. Fix: drive the fill context from
  the tile's own caption + the section copy (`blockContext`), never a literal
  vertical word. (Note `dso-success-stories` keeps `"dental practice"` — it is NOT
  exposed generally, only reached on the gated DSO path.)
- `dso-meet-team` member photos: the LP path is safe because
  `reconcileTeamMemberPhotos` runs unconditionally in the main handler and clears
  any member photo with no matching saved `team_member` row (empty team ⇒ all
  cleared). The MICROSITE generator runs NO such pass — its `mergeWithDefaults`
  case previously did `photo: m.photo ?? m.imageUrl ?? ""`, preserving a
  hallucinated/arbitrary face. Fix: force `photo: ""` in the microsite normalizer
  case (microsites have no verified team source). Names/roles/booking urls stay.

**How to apply:** grep the block id across `generate-page.ts` (fill +
`sanitizeAIImageUrls` + `collectImageSlots`) and the microsite `mergeWithDefaults`
cases; remove vertical-literal search keywords; for any people/photo-bearing block
remember the microsite path has no reconcile guard, so clear unverified media in
the normalizer itself.
