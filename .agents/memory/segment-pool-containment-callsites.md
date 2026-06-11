---
name: Segment-pool generation containment callsites
description: A pool-only block constraint in microsite generation must be enforced at THREE points, not just the parse clamp.
---

# Segment-pool containment is a 3-point invariant

When microsite generation must draw blocks ONLY from a segment's approved pool
(∪ structural essentials hero/bottom-cta/footer), the pool-only contract leaks
unless enforced at **every** stage that can add blocks after the AI parse:

1. **Parse clamp** — filter normalized AI output by `segmentPoolAllowedSet(...)`.
2. **Required-role backfill** — `enforceRequiredRoles` (defined in
   `generate-page.ts`, called from `generate-microsite.ts` for every
   non-template page) runs AFTER the clamp and will re-inject off-pool defaults
   (benefits-grid/testimonial/trust-bar for missing features/social-proof/stats
   roles). Pass its `allowedTypes` option in pool mode so it only backfills
   in-pool types.
3. **Zero-usable fallback** — if the clamp drops everything, the generic
   `NEUTRAL_MICROSITE_BLOCK_LIST` contains off-pool blocks
   (trust-bar/benefits-grid/testimonial/how-it-works/comparison) and re-leaks.
   Build the fallback from the pool itself (`segmentPoolFallbackBlockList` =
   hero + approved body + bottom-cta + footer), NOT NEUTRAL.

**Why:** the first review pass missed (2), the second missed (3) — the same
off-pool blocks slipped back in through whichever stage was overlooked. Any new
constraint mode (DSO, freeform, future segment modes) has the same three
post-parse insertion points.

**How to apply:** when adding/auditing a block-vocabulary constraint in
generate-microsite, grep for every place that mutates `normalizedBlocks` after
the parse (clamp branch, enforceRequiredRoles call, all `else`/fallback
branches) and confirm each respects the same allow-set. Non-pool branches
(useFreeform/useDsoFreeform) intentionally keep their own NEUTRAL/curated
fallbacks and omit enforceRequiredRoles `allowedTypes` (legacy behavior).
