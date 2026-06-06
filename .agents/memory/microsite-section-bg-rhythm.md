---
name: Microsite section-bg rhythm needs seeded backgroundStyle
description: Why AI sales-microsite sections render all-white, and the two-place fix to make them participate in the background-rhythm passes.
---

The deterministic background-rhythm passes in sales-microsite generation only
touch blocks that ALREADY carry a `backgroundStyle` prop:
`applyDesignIntensityBackgrounds` gates on `"backgroundStyle" in props`, and
`applyDandySupportingVariability` only swaps light-neutral presets
(`white`/`light-gray`/`muted`). A block that renders its own `<section>` with a
hardcoded near-white background (e.g. `dandy-columns-v3` #FDFCFA, `testimonial`
#F0F7F4) and never sets `backgroundStyle` is silently skipped → every such
section reads as white.

**Rule:** making a self-section block participate in the rhythm requires TWO
coordinated edits:
1. The block component must consume `props.backgroundStyle` (resolve via
   `getBgStyle`, flip text colors via `isDarkBg`) and keep its hardcoded
   near-white look ONLY when the prop is unset (so legacy DB rows are
   unaffected).
2. `mergeWithDefaults` in generate-microsite.ts must SEED a light-neutral
   default (`white`/`muted`) for that block type so the passes have a value to
   vary. The block's case sets it directly; fall-through types go through the
   `SECTION_BG_SEED_DEFAULTS` map in the `default:` case, guarded by
   `!("backgroundStyle" in p)`.

**Why:** without the seed the prop is absent and the passes no-op; without the
block consuming it the seed renders nothing. Both are needed.

**How to apply:** seed only light-neutral presets — `applyDandySupportingVariability`
ignores anything not in its light-neutral set, so seeding `dark`/`dandy-green`
would freeze that section. Blocks that already render dark/brand anchors
(`event-landing-hero` always #000 image hero, `editorial-carousel` bgColor
defaults to `var(--brand-primary)`) don't consume `backgroundStyle` and should
be left alone. Out of scope: rewriting existing DB rows (they keep the
hardcoded near-white fallback).
