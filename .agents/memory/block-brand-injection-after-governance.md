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
