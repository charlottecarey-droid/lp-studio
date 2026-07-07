---
name: Block accent empty-string navy inheritance
description: Brand-color fallbacks in blocks must use || not ??, or an empty-string brand.accentColor makes accent elements inherit the dark body ink (reads as navy).
---

Blocks that resolve an accent (or any brand color) via a fallback chain must use `||`, not `??`.

**Rule:** `accent = props.accentColor || brand.accentColor || brand.primaryColor || DEFAULT_BRAND.accentColor`. Terminate the chain in a VALID hex (e.g. `DEFAULT_BRAND.accentColor`), never a hardcoded navy like `"#0F172A"`.

**Why:** A tenant can store `brand.accentColor === ""` (empty string). `??` only catches null/undefined, so it stops at `""` → `accent === ""` → every accent element (quote mark, CTA background, avatar circle, carousel dots) gets `color/background: ""` and INHERITS the section's dark body ink, which reads as navy. This is exactly why the testimonial carousel + single-quote blocks "defaulted to navy". Sibling `BlockTestimonialWall` already used `||` and never had the bug.

**How to apply:** Any new/edited block computing a brand color from `props.* ?? brand.* ?? ...` — switch to `||`. When the resolved value is later fed to `pickContrastingColor`/contrast math, keep the final fallback a real hex (a `var(--brand-accent, #hex)` string can't be parsed for contrast). Use `DEFAULT_BRAND.accentColor` (a valid hex, brand-neutral blue) as the safe terminal fallback.
