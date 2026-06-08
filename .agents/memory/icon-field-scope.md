---
name: Icon-field IconPicker scope
description: Which builder icon fields get the unified IconPicker vs. stay specialized
---

# Which icon fields get the unified IconPicker

The IconPicker (lib/icon-value.tsx contract: single string = Lucide PascalCase
name OR image URL) goes ONLY on **free-string** icon fields. `dso-partnership-perks`
`perk.icon` IS such a field (updatePerk patch, no type narrowing) and is IN scope —
it was wrongly excluded once and a reviewer pulled it back in.

**Stay specialized (NOT IconPicker):**
- `dso-problem` panel `c.icon` — constrained UNION (`as typeof c.icon`, PANEL_ICONS list)
- `dso-software-showcase` feature chips — curated functional set (check/zap/clock/bar/monitor)
- GridPiece emoji, product/promise/TemplateCaseStudy free icon-key inputs, BusinessCase enum

**Why:** constrained-union / curated-set fields are coupled to renderer-specific icon
maps, not the generic name-or-URL contract; widening them is a separate design change.

**How to apply:** when converting an icon field, check the panel's update signature.
If it stores an arbitrary string -> IconPicker + renderer IconOrImage. If the value is
a typed union or a small curated functional list -> leave it. When migrating a renderer
whose stored values were lowercase/kebab, add a normalizeIconValue() (lower/kebab ->
PascalCase, pass-through for image URLs + already-PascalCase) so legacy rows still resolve.
