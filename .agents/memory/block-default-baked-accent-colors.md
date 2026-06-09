---
name: Block default baked accent colors
description: Why new block createBlock defaults must not hardcode accent color literals, and which brand token to fall back to.
---

# Baked accent-color defaults override the brand on every surface

Block renderers resolve color as `props.accentColor || brand.accentColor || <fallback>`
(or `?? brand.primaryColor`). If a block's `createBlock` defaultProps in
`block-registry.tsx` bakes a literal `accentColor` (or `gradientStart`/`gradientEnd`),
`props.accentColor` is always truthy, so the brand value/`var(--brand-*)` fallback is
NEVER reached — the literal renders on EVERY surface (live page, builder, block picker),
even inside the tenant brand wrapper. This is why "new blocks show purple everywhere"
despite brand vars injecting correctly.

**Rule:** new/premium blocks must OMIT color props from `defaultProps` (don't set a
`var(...)` string either — many renderers append alpha hex like `${accent}1A`/`${gradEnd}00`
which breaks with a var string). Let the renderer fall through to the brand.

**Why:** baked literals win over the brand resolution chain; the only way to get true
tenant-brand inheritance is to leave the prop undefined.

**How to apply (dark-surface blocks):** the accent fallback must be `brand.accentColor`,
NOT `brand.primaryColor`. `DEFAULT_BRAND.primaryColor` is near-black `#0f172a`; several
premium blocks have dark backgrounds (`#0F172A`/`#0B1120`), so a primary-color fallback
renders an invisible accent/eyebrow/glow for default or dark-primary brands.
`DEFAULT_BRAND.accentColor` is a visible blue `#3b82f6`. Pattern (matches the existing
`gradient-pricing` block): `props.accentColor || brand.accentColor || brand.primaryColor || "#4f46e5"`.

**Not migrated:** removing the default only affects newly-created blocks. Pages already
saved during the regression keep the baked literal in stored props; a data migration
(unset color prop only where it exactly equals the old shipped literal) would be needed
to retro-fix existing pages — left as an optional follow-up.

**Left intentionally:** picker thumbnail SVGs are static, non-tenant-aware schematic art
(indigo `#6366f1` is the picker's generic accent across all tiles) and the dark bg
gradients themselves (a deliberate premium dark surface, not "accent/text").
