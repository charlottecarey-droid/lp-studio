---
name: Block brand-CSS-var surface breaks contrast resolver
description: A block that paints its background with a brand CSS var (e.g. var(--brand-primary)) must resolve that var to the live brand hex BEFORE feeding it to the contrast/ink resolver, or text is painted for a white surface.
---

A block can paint its section background with a brand CSS variable
(`var(--brand-primary)`, `var(--brand-accent)`) — which CSS resolves correctly at
render time — yet pass that SAME unparseable var string into the JS contrast math
(`resolveSectionInk`, `pickContrastingColor`, WCAG luminance helpers).

The contrast helpers can only measure a hex. An unparseable input is treated as
WHITE (`resolveSectionInk` falls back to `#ffffff`, `luminance()` returns 1). So on
a DARK brand background the resolver thinks the surface is light and paints
near-black ink → **dark/black headline on the dark brand color**.

**Rule:** resolve any brand CSS var to the live tenant hex BEFORE the contrast math.
Read the real color from `useBrandConfig()` (`brand.primaryColor` / `brand.accentColor`)
and map `var(--brand-primary)` → `brand.primaryColor`, `var(--brand-accent)` →
`brand.accentColor` (honor a `var(--x, #fallback)` fallback too). Keep the PAINTED
style on the CSS var (stays live/brand-aware); only the contrast INPUT needs the hex.
This must stay brand-aware — never hardcode a tenant's color (e.g. Dandy teal).

**Why:** the Dandy product hero (`BlockDandyProductHero`) defaults its bg to
`var(--brand-primary)` and derived the headline ink from that same string, so the
headline rendered black on dark teal. Sibling of the preset-style CSS-var bypass
(lp-preset-style-bypass-contrast-guards.md) but here the bypass is the block's own
DEFAULT brand-var bg, not an authored preset.

**How to apply:** when a block's surface or button color can be a brand `var()` and
you feed it to contrast/ink helpers, add a small `resolveBrandColor(value)` that
returns the hex when the value is a known brand var (falls back to the raw value when
brand context is absent, preserving old behavior). When brand context is missing
(e.g. SSR without a provider) the old white-surface fallback still applies — tests
must stub `useBrandConfig` to exercise the fix.
