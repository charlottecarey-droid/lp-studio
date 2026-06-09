---
name: Imported button CSS marker class
description: How buttonStyleRaw ("Primary button CSS") is applied page-wide, and the secondary-button opt-out rule.
---

The imported "Primary button CSS" (`BrandConfig.buttonStyleRaw`, populated by the
untrusted URL importer) is applied to real CTAs on every live landing page via a
marker-class + injected-stylesheet mechanism, NOT per-callsite inline styles.

- `getButtonClasses()` appends the marker class `lp-brand-btn` to every primary
  button it builds.
- `getBrandButtonCss(brand)` emits a single `.lp-brand-btn { … !important }` rule
  from `buttonStyleRaw` (background, box-shadow, border-radius, padding, font-weight,
  text-transform). `!important` is required because each block sets an inline
  `backgroundColor` on the button, and inline beats a normal stylesheet rule.
- The rule is injected via `<style>` in the three shared render branches of
  `landing-page-viewer.tsx` (builder preview, linked-page variant, legacy DTR/video),
  so it lands in both the live preview and the prerendered/published HTML.
- Returns `""` when `buttonStyleRaw` is absent → fully backward-safe.
- Every value baked into that published `<style>` MUST go through `sanitizeCssValue`
  (rejects `<>{}\\;@` and `/* */`) or a scraped/edited value can break out of the
  `<style>` element (`</style>…`) on a published page.

**Why:** the field had been saved/editable for ages but never consumed by any rendered
button; a central marker+stylesheet avoids editing ~20 block callsites.

**Garbage-scrape guard (render-time, fixes all tenants without migration):** the
untrusted importer regularly lands on a NON-CTA element, so `buttonStyleRaw` holds
values that — emitted with `!important` page-wide — break every CTA: zero padding
(`0px`), invalid multi-value padding (`16px 88px`), or invisible/near-white fills
(`none`, `rgb(241,241,241)`). Both emitters (`getBrandButtonCss` AND
`getImportedButtonInlineStyle`) MUST validate before emitting: padding only when a
single positive length (else brand `buttonPaddingX/Y` utilities own it); background
only when visible (reject none/transparent/alpha-0, and near-white ONLY when there's
no `boxShadow` to define it — a white pill *with* a shadow is a legit style); and
skip the contrast-derived label color whenever the fill was rejected (else it
mis-colors the label on the block's real brand fill). Keep both emitters in lockstep
(button-style-parity.test.ts). Validate at render, not just import — existing tenants
already have garbage stored.

**How to apply:** any outline/secondary button that *reuses* `getButtonClasses` only
for sizing (e.g. `BlockNavHeader` cta1, white bg + slate border) must pass
`{ imported: false }` or it will wrongly inherit the primary imported CSS via the
`!important` rule. Secondary buttons built with `getSecondaryButtonClasses` are already
safe (no marker). The Brand Settings preview uses the inline-style sibling
`getImportedButtonInlineStyle` (no `!important`; inline wins over utility classes),
spread AFTER the base `backgroundColor`/`color` so imported values win.
