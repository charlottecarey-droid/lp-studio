---
name: Modal theme fallback callsites
description: Where the brand-default modalTheme must be resolved when opening EmailCaptureModal.
---

`EmailCaptureModal` accepts a `theme` prop and defaults to `"light"`. It has no access to `BrandConfig` (no context lookup inside the modal).

**Rule:** any callsite that opens `EmailCaptureModal` and wants brand-default modal theme to apply must resolve it at the callsite:
`theme={perBlockTheme ?? resolvedBrand?.modalTheme ?? undefined}`

**Why:** centralising the fallback inside `EmailCaptureModal` was considered and rejected — the modal is rendered in contexts (preview, external embeds) where pulling brand config would couple it to providers it shouldn't depend on. Keeping the fallback at the callsite preserves the modal as a pure presentation component.

**How to apply:** `CtaButton` handles it for the common path. Blocks that render `EmailCaptureModal` directly (e.g. `BlockStickyHeader`) must apply the three-layer fallback themselves. If you add a new such callsite, mirror the pattern or you'll silently ignore brand-default modal theme.
