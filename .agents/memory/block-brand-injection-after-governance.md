---
name: Block brand/accent injection must run after governance
description: Per-block brand-color injection in generate-page must run AFTER enforceAiModes or a locked block wipes it
---

# Per-block brand/accent injection must run AFTER enforceAiModes

In `artifacts/api-server/src/routes/lp/generate-page.ts`, any helper that bakes a
tenant brand color onto a specific generated block (e.g. `applyEventPageBranding`
setting a self-contained full-page block's nested `theme.primary`) MUST be the
FINAL mutation on that block — i.e. run it AFTER the `enforceAiModes(...)` call on
BOTH the template path and the freeform path.

**Why:** `enforceAiModes` is the final governance pass. For a block a tenant has
governed `locked` (with catalog defaults), it does `block.props = cloneJson(defaults)`
— it REPLACES the whole props object with the curated catalog default. So any
accent/brand injection placed BEFORE it is silently reverted (and worse, the
catalog default may itself carry off-brand/Dandy content). `copy`/`open`/no-governance
blocks are unaffected, which is why the bug only shows for tenants who lock that block.

**How to apply:** Place the injection immediately after each `enforceAiModes`
callsite (template path and freeform path) — not next to the other branding helpers
(`applyContentSeriesBranding`, `applyWebinarHubBranding`) which currently sit BEFORE
enforceAiModes and therefore carry the same latent risk for locked instances. The
injection is a tiny idempotent prop write, so running it last is safe.

Related: the event-page injection keeps the dark premium look + EB Garamond and only
swaps the accent, gated on `luminance(hexToRgb(color)) >= 0.1` so a near-black brand
accent can't vanish on the dark background (keeps the gold default instead).

**IMAGERY has the same trap, not just accent/fonts.** A per-block *imagery*
guarantee (swap a self-contained full-page block's baked placeholder photos —
e.g. event-page's Dandy `/event-assets/*` hero + gallery — for tenant/brand
imagery) also breaks under governance, because the image-fill passes run BEFORE
`enforceAiModes`, which then reverts image fields to the catalog placeholders.
Fix = a post-governance reapply scoped to that block type only
(`reapplyEventPageImagery`: re-run `sanitizeAIImageUrls` to clear non-servable
placeholder URLs, then `fillEmptyImages` to refill from the library), called
right after `applyEventPageBranding` on BOTH paths. `sanitizeAIImageUrls`
shallow-copies props and touches only image fields, so run it AFTER the accent
injection and the theme survives. Gate the template path on `replaceImagery ===
true` so the "keep template imagery" opt-out is honored; freeform always
replaces. **Governance revert is field-selective in copy mode:** `enforceAiModes`
copy mode only reverts keys in `GOVERNANCE_IMAGE_FIELD_KEYS` — `src` (gallery
`photos[].src`) IS governed so it snaps back to the placeholder, but
`heroImageUrl` is NOT, so a copy-governed hero survives while its gallery
reverts; `locked` mode resets the whole props object so everything reverts. The
reapply covers both.
