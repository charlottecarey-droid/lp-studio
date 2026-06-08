---
name: Section block background presets (resolveSectionSurface)
description: How to give an lp-studio section block the full brand-aware/gradient Background preset list end-to-end.
---

# Section block Background presets

To let a graduated section block expose the full bg-styles preset list (white/dark/
brand/**gradient**/…) in its editor and render it readably:

1. **Interface** (`lib/block-types/generic-blocks.ts`): add `backgroundStyle?: BackgroundStyle;`.
   Blocks extending `BenefitsCtaConfig` inherit it (covers benefits/features/how-it-works/quote/testimonial).
2. **Panel** (`pages/builder/property-panels/<Name>Panel.tsx`): replace the
   `<ColorField label="Background" value={props.bgColor ?? "#X"} onChange=… />`
   with `<SectionBackgroundControl backgroundStyle={props.backgroundStyle}
   bgColor={props.bgColor} defaultBgColor="#X" onChange={(patch)=>update(patch)} />`.
   The control emits a PARTIAL `{backgroundStyle?,bgColor?}` that must MERGE into props.
   Render it full-width ABOVE the `grid grid-cols-2/3` that holds Text/Accent (shrink the grid).
3. **Renderer** (`blocks/Block<Name>.tsx`): `const surface = resolveSectionSurface(props, "#X");`
   then on the ROOT section use the `background` **shorthand** (`style={{ background: surface.background }}`,
   NOT `backgroundColor`, or the gradient won't render). Text default → `props.textColor ?? surface.color ?? "#…"`;
   feed `surface.base` (solid hex) to every contrast helper (`pickContrastingColor`, luminance/muted/border/box-shadow/edge-fade).
   Brand logo (only if the block renders `<BrandLogo>`): `tone={brandLogoToneForSurface(surface.isDark)}`.

**Why:** `resolveSectionSurface(opts, fallbackHex)` returns `{background,color?,isDark,base}`;
when `backgroundStyle` is UNSET it returns the legacy `bgColor` hex as both `background` and `base`,
so the default path is byte-equivalent — no visual regression. Field is optional → no block-registry
defaultProps change needed.

**Gotchas:**
- Several renderers already had a local card-surface var literally named `surface`
  (`props.surfaceColor`). Rename the local one (e.g. `cardSurface`) and name the resolved one `surface`
  (or vice-versa, e.g. `sectionBg`/`bgSurface`) to avoid a redeclare collision.
- Blocks with their OWN bg image/video/gradient (FullBleed/Video/GradientGlow final CTAs,
  CtaGradientBanner, MediaLoopingShowcase): keep that layer; `surface.background` is the section
  surface beneath. `background` shorthand conflicts with `backgroundImage` longhand on the SAME
  element → move the image to a separate `absolute inset-0` layer.
- Inner-card content keyed to its own card surface (CtaCenteredMinimal/CtaStatBacked) must NOT be
  repointed to `surface.color`/`surface.base` or it breaks readability on the white card.
- Client/partner logo IMAGES (logo walls, case-study logos) are NOT the brand logo — never apply
  brandLogoToneForSurface to them.

**Brand logo light/dark switching:** wherever the brand logo renders on an editable surface, derive
tone from the surface. `BlockNavHeader` does it via `brandLogoToneForText(textColor)` when a text
override exists, else `brandLogoToneForSurface(resolveSectionSurface({bgColor:backgroundColor}, "#fff").isDark)`,
and `"onDark"` when a background image is set.
