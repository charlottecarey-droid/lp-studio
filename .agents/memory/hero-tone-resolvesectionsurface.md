---
name: Hero tone must use resolveSectionSurface, not isDarkBg
description: Why hero blocks derive light/dark text tone from the resolved brand surface (and treat cover images as dark), not the preset key.
---

# Hero tone detection

Hero blocks must pick light-vs-dark text tone from the surface they ACTUALLY
paint, via `resolveSectionSurface({ backgroundStyle }, "#ffffff", brand).isDark`,
NOT the legacy `isDarkBg(props.backgroundStyle)` (preset-key only).

**Why:** `isDarkBg` keys the "Brand color" preset (`dandy-green`) as dark and
emits white heading text, but a tenant whose `--brand-primary` is pale renders a
LIGHT hero → white-on-light invisible text (same pale-tenant bug
`resolveSectionSurface` was built to fix for section blocks; heroes were never
migrated). For a `bg-image` layout the cover photo is the real surface — keying
tone off the (often unset/light) preset ignores the image entirely.

**How to apply:**
- Migrated blocks: `BlockHero` (no image bg) and `BlockDsoPracticeHero`.
- For an image-background hero, treat the cover image as a DARK surface
  (`layout === "bg-image" && !!imageUrl ? true : surface.isDark`) so it always
  gets light text + the dark scrim — matches sibling DSO content blocks'
  `isDarkBg(...) || !!backgroundImage` convention.
- Behavior is preserved for white/light-gray/muted/dark/black/gradient presets;
  only the pale-brand-color and light-preset-image edge cases change.
- The fix lives in the block component, so it reaches all three preview surfaces
  (marketing library modal, sales library modal, standalone `/preview/template/:id`)
  automatically — they all render through `BlockRenderer brand={...}`.
- Verify standalone preview only serves GLOBAL templates; `global:<id>` for a
  tenant `is_template` (non-global) page 404s "Template not found".
