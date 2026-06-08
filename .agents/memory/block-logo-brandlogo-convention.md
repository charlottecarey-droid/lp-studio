---
name: Block logo rendering convention
description: How hero/nav blocks must render the brand logo with a text fallback
---

# Block logo rendering convention

Hero and navbar blocks must render the brand logo via the shared `BrandLogo`
component (`@/components/BrandLogo`), NOT a bare `<img>` gated only on a per-block
override prop, and NOT `brand.brandName` as a text wordmark when a logo exists.

**The pattern (mirror `BlockNavHeader`):**
```tsx
{brandHasLogo(brand, props.logoImageUrl /* or props.logoUrl */) ? (
  <BrandLogo brand={brand} url={props.logoImageUrl} tone={...} alt={logoText} className="h-8 w-auto" />
) : (
  /* text wordmark fallback (+ any decorative dot/badge) */
)}
```

Priority order: per-block override image → resolved `brand.logoUrl` (via
`BrandLogo`) → text wordmark. `BrandLogo` itself returns `null` when no source
resolves, so guard the branch with `brandHasLogo(brand, override)` to fall back
to text only when there is truly no logo at all.

**Tone** picks the recolor/dark-asset surface:
- Dark-surface heroes/navs → `tone="onDark"`.
- Light surfaces → `tone="onLight"`.
- Configurable-color navbars → derive from the foreground text color with
  `brandLogoToneForText(text)` (light text ⇒ dark surface ⇒ `onDark`).

**Why:** the 5 newer heroes (Aurora/Spotlight/Parallax/Cinematic/Editorial) and
several navbars (Minimal/MegaMenu/TransparentOverlay/CenteredLogo) originally
showed the brand *name* as text even when a logo was configured, because they
only rendered an image for a manually-set per-block prop. `StickyHeroNav` and
`BlockNavHeader` already did it right via `BrandLogo`.

**How to apply:** when authoring/auditing a hero or nav block's top-left brand
area, use this helper trio. Keep decorative marks (Zap icon, initial-letter
badge, ring/dot) ONLY in the text-fallback branch, never alongside a real logo.
