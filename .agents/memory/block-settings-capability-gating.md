---
name: Block-settings capability gating
description: Chrome blocks must be ANCHOR_ONLY in the capabilities map; render now strips unsupported saved settings.
---

Two coupled rules govern per-block visual settings (paddingX, minHeight, spacing,
bgColor, textColors, cardBgColor, bgImage) in lp-studio's BlockRenderer:

1. **Every chrome block (nav / header / footer / sticky / popup) must be listed
   in `block-settings-capabilities.ts` OVERRIDES as `ANCHOR_ONLY`.** A new
   nav/header that is NOT listed falls through to the `ALL` default and wrongly
   exposes paddingX/minHeight/spacing/bgColor inspector controls.

2. **`getBlockSettingsCapabilities` only governs which inspector controls show —
   it does NOT stop `wrapWithSettings` from applying already-saved values.** So a
   setting saved while a block was mis-categorized (or before its caps were
   tightened) keeps rendering forever even though the user can no longer see/edit
   it. `BlockRenderer` now runs `gateSettingsByCapabilities(block.type, settings)`
   before `wrapWithSettings` to null out unsupported keys at render time
   (anchorId always preserved).

**Why:** `dso-practice-nav` shipped missing from OVERRIDES → an instance picked up
a `paddingX`/`minHeight` → rendered "weirdly centered with lots of side padding."
The capability override alone would not have fixed the already-saved instance; the
render-time gate is what repairs existing pages.

**How to apply:** when adding any chrome/self-painted block, add it to OVERRIDES
with the right caps (ANCHOR_ONLY for navs/footers). The render gate is general, so
tightening a block's caps now also makes its orphaned saved settings inert — keep
that in mind (intended) for heroes/containers/card-less blocks. `animationStyle`/
`animationDelay` are NOT gated but are inert in the wrapper path.
