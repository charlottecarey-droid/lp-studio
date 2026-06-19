---
name: Marketing hero gradient-text intermittently invisible
description: Why the marketing homepage hero accent line ("Watch it build.") vanished in one browser window and how it's hardened
---

# Hero gradient-on-text vanishing

The marketing homepage hero (`artifacts/lp-studio/src/marketing/components/HeroScene.tsx`)
renders a two-line `<h1>`: "Describe a page." in solid ink, then an accent line
("Watch it build.") painted with a gradient *through* the text — the glyphs are set
fully transparent (`-webkit-text-fill-color: transparent` / `color: transparent`) and
a `linear-gradient(--indigo → --coral)` background is clipped to them via
`background-clip: text`.

## Symptom
A user reported the accent line completely missing in one browser window (only
"Describe a page." showed, with blank space where the gradient line belongs) while a
second window rendered both lines fine. Intermittent, window-specific, no console
errors, all API calls 200.

## Root cause
The CSS vars `--indigo`/`--coral` ARE defined in `:root` (marketing.css), so the
gradient is valid — undefined vars were ruled out (would be consistent, not flaky).
The real failure mode is gradient-on-text fragility: when the text is transparent and
depends entirely on the clipped gradient painting, the clip can intermittently fail to
repaint — triggered by the web-font swap-in (DM Sans) reflowing the glyphs and by the
nearby absolutely-positioned `filter: blur()` decorative orbs forcing compositing
layers. A plain inline `<span>` after a `<br>` is the most fragile case. When the clip
doesn't paint, the transparent glyphs show nothing → invisible line.

## Fix
Moved the styles into a `.hero-gradient-text` class in
`artifacts/lp-studio/src/marketing/marketing.css` with two guards:
1. `display: inline-block` — gives the span its own box so the gradient clip paints
   reliably (the standard fix for "webkit gradient text randomly invisible").
2. A solid `color: var(--indigo)` fallback, with `background-clip: text` +
   transparent fill applied ONLY inside `@supports ((-webkit-background-clip: text) or
   (background-clip: text))`. So the text can never render fully invisible.

**Why:** pure CSS can't detect a runtime paint failure; the inline-block is the actual
reliability fix, the solid fallback is graceful degradation.

**How to apply:** any gradient-on-transparent-text accent (especially after a `<br>`,
or near blurred/composited siblings) should use this pattern, never a bare inline span
with transparent fill and no fallback color.
