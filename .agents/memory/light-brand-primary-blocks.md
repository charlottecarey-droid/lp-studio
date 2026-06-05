---
name: Light brand-primary block contrast
description: Generic LP blocks must not treat brand-primary as a dark anchor color; light/near-white primaries cause white-on-white.
---

Generic lp-studio blocks (BlockHero, BlockTrustBar, etc.) must NOT assume `var(--brand-primary)` is a dark, saturated anchor color. A tenant whose brand primary is light/near-white breaks any block that uses brand-primary as a dark surface or as text on a light surface.

**Why:** A real tenant (light/near-white primary) rendered an invisible hero headline and invisible trust-bar stats. Causes:
- BlockHero `backgroundStyle="dark"` was excluded from the `bgExtended` list, so it fell through to `bg-[var(--brand-primary)]` (light) under white heading text. The `bg-styles` MAP already defines `"dark"` = charcoal `#1a1a1a` + white fg; the hero just wasn't honoring it.
- BlockTrustBar `statColor` defaulted to `var(--brand-primary)` on a fixed light bg.

**How to apply:**
- A block painting a *dark surface* from a named preset (`dark`/`black`/etc.) must route through `getBgStyle(preset)`, never substitute brand-primary.
- Block text/number colors on a light surface must use the contrast-guarded tokens (`--brand-heading-on-light` / `--brand-heading-on-dark` from `getBrandStyleVars`/`resolveHeadingColor`), which keep brand-primary only when it clears AA on the page bg and otherwise step to near-black/white. Never default to raw `var(--brand-primary)`.
- These tokens degrade to brand-primary for dark-primary tenants, so the change is backward-compatible.

Separately: the generic centered (non-split) BlockHero layout historically dropped its media (renderMedia was split-only). Render media in the centered branch only when there is EXPLICIT media (`imageUrl` non-empty OR resolved `mediaUrl`); gating out `imageUrl===undefined` prevents the `/dandy-platform.webp` fallback leaking into generic centered heroes. Note: BlockBenefitsGrid and BlockTrustBar are icon/stat blocks and have never rendered per-item `image` (not a regression) — image-rich item grids are separate block types in `generic-blocks.ts`.
