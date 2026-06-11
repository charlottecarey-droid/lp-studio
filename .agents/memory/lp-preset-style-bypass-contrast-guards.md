---
name: Preset block-style CSS-vars bypass contrast guards
description: A Dandy block "style" preset sets the bg to a var() string, so isValidHex() is false and every WCAG guard silently skips — pairing two brand vars then renders invisible.
---

# Preset `style` CSS-vars silently skip contrast guards

Several Dandy section blocks (e.g. `BlockDandyConversionPanel1`) expose a `style`
preset ("teal" | "lime" | "medium" | "white") that historically mapped to a CSS
custom-property string like `var(--brand-primary)` / `var(--brand-accent)` for
the section background, paired with brand-var Tailwind color classes for the
heading, eyebrow, divider, and buttons.

**The trap:** the contrast helpers (`pickCtaButtonColors`, `pickOutlineButtonColors`,
`pickContrastingColor`, `relativeLuminance`) need a CONCRETE hex. When `bg` is a
`var(...)` string, `isValidHex(bg)` is `false`, so any guard written as
`isValidHex(bg) ? <derive contrasting color> : <fallback>` silently takes the
UNGUARDED fallback. The fallback pairs two brand vars — heading
`var(--brand-primary)` on a `var(--brand-accent)` section, button
bg=primary / text=accent, etc. That is invisible whenever a brand's primary and
accent are the same hue. Real case: a tenant whose
`primaryColor === accentColor === #28B8F8` blue → blue text + blue buttons + blue
eyebrow on a blue panel.

**Rule:** resolve the preset to a concrete hex BEFORE any contrast math. Build a
`styleBg` map: teal→primaryHex, lime→accentHex, medium→`darkenHex(primaryHex)`,
white→`#ffffff`, or `props.bgColor` only when it is a valid hex. Then derive
EVERY text/divider/eyebrow color and BOTH button color sets from that resolved
hex via the existing helpers, and ALWAYS call the button-color pickers (no
`null` fallback — the bg is always a valid hex now). Apply results as inline
`style={{ color }}`, never brand-var Tailwind color classes.

**Why:** the `cta-button-contrast.test.ts` regression test only catches the
literal `bg-[var(--brand-accent)] text-[var(--brand-cta-text)]` Tailwind pattern;
it does NOT catch a heading/eyebrow pairing two CSS vars, nor a guard that
silently no-ops because its `isValidHex` gate saw a `var()` string. Deriving
from a resolved hex is the only reliable fix.

**How to apply:** any block with a named-preset background (not a raw hex) is
suspect. Audit for `isValidHex(<bg>) ?` gates where `<bg>` can be a CSS var, and
for heading/label/button colors set to `var(--brand-*)` without a luminance
check against the actual surface.
