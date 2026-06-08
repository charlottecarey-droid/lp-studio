---
name: Premium section-block polish pattern
description: How case-study/quote/testimonial section blocks adopt the premium toolkit (reveal motion, animated metrics) without breaking the builder canvas.
---

# Premium polish for section blocks (case-study / quote / testimonial family)

When bringing a section block up to premium-hero visual quality using
`src/lib/premium-toolkit.tsx`:

- **Builder-gate every internal motion.** `const animate = !onFieldChange;` then pass
  `disabled={!animate}` to `Reveal`/`RevealStagger`/`RevealItem`. The builder passes
  `onFieldChange`; the published viewer does not.
  **Why:** BlockRenderer already wraps each block in an outer `<Reveal>` *only on published
  pages* (disabled in builder, NO_REVEAL set excludes sticky blocks). Internal stagger/reveal
  added inside a block would still animate in the builder and fight inline editing unless gated.
  `Reveal/RevealStagger/RevealItem` accept a `disabled` prop that renders a plain `div`.

- **Animated metrics:** published renders the count-up `<StatCounter value=... style={{fontFamily}} />`
  (takes only `value`+`style`, inherits color from a styled parent div); builder keeps the editable
  `<InlineText>` so the number stays editable. Branch on `onFieldChange`.

- **Decorative accent:** use `AccentGlow({color,isDark})` from the toolkit, NOT `GlowOrbs`.
  GlowOrbs is screen-blend/dark-only and is invisible on the light surfaces these blocks default to.
  AccentGlow is surface-aware (faint tint on light, brightened screen-blend on dark). Section needs
  `relative overflow-hidden`, glow sits at z0, wrap content in `relative z-10`.

- **Gradient background:** read the surface via `resolveSectionSurface(props, fallback)` →
  `{background, color, isDark, base}`; pass `isDark` to AccentGlow so it adapts.

- After edits, typecheck via the `tc-lp` validation command (lp-studio tsc > bash cap). A mid-edit
  vite babel "MissingClosingTagElement" in HMR logs is just an intermediate save — trust the final
  tsc PASS, not a stale HMR snapshot.
