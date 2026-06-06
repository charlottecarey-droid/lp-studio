---
name: Builder color picker var resolution
description: Why builder inspector color rows must resolve brand CSS-var values to concrete hex before feeding a native <input type="color">.
---

# Builder color `<input type="color">` must resolve CSS vars to hex

A native `<input type="color">` only accepts `#rrggbb`. If a block prop's
default/value is a brand CSS variable (e.g. `var(--brand-heading-on-light)`,
`var(--brand-primary)`), the swatch silently falls back to **black** and the
adjacent text field shows the raw `"var(...)"` string.

**Rule:** any builder inspector color row that may carry a brand-var value must
resolve it to a concrete hex for the native swatch. Resolve through
`getBrandStyleVars(brand ?? DEFAULT_BRAND)` (the SAME source blocks render from,
via `useBrandConfig()`), not DOM `getComputedStyle` — the inspector sidebar is
outside the preview's var scope, so a DOM probe returns black.

**Also:** the panel's per-field default MUST equal the block's render default.
Trust Bar drifted — panel defaulted Stat/Number to `var(--brand-primary)` while
`BlockTrustBar` rendered `var(--brand-heading-on-light)`. Keep them identical.

**Text-field gotcha:** binding the text input to a resolved value clobbers
progressive hex typing (`#`, `#1a` → snaps to resolved). Use a local draft that
re-syncs only when unfocused; show the raw hex (preserving alpha) when a hex is
stored, and the resolved hex only when the stored value is a var.

**Why:** native color inputs can't show alpha or named/var colors; the renderer
(plain CSS `color:`) can. The swatch must approximate the rendered color, but the
text field stays the source of truth for what's actually stored.

**How to apply:** when adding/auditing any block property panel `ColorRow`-style
control, check whether its default or stored value can be a `var(...)`; if so,
wire a brand-aware resolver. Trust Bar lives in
`artifacts/lp-studio/src/pages/builder/property-panels/TrustBarPanel.tsx`.
