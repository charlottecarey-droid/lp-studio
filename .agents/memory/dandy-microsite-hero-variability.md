---
name: Dandy microsite hero variability
description: How/why generated Dandy microsites vary the lead hero layout, and the hash gotcha behind it
---

# Dandy microsite hero variability

Generated Dandy enterprise microsites vary the lead `dso-heartland-hero` layout
per account (was: always the same default → all pages felt templated). Done as a
**post-processing pass** in `generate-microsite.ts` (`applyDandyHeroVariability`),
NOT via the AI system prompt — prompt-steering can't reliably honor asset gating.

**Rules (keep these invariants if you touch it):**
- **Dandy-only.** Gated at the callsite on `isDandyTenant(tenantId)` (planFeatures);
  the generic / white-label path is untouched.
- **Skipped for fixed templates** (`!templateBlocks`) — a template's hero is an
  explicit choice.
- **Asset-gated candidate pool:** `full-bleed` (gradient default) always; if a
  `lp-hero`-tagged image exists add `split` + `full-bleed-image-bg`; if a tenant
  video exists add `split-video` + `stacked-video` + `full-bleed-video-bg`. No
  assets ⇒ only the gradient `full-bleed`, so a broken/empty layout is never
  produced. The `*-bg` tokens map to layout `full-bleed` with the asset set as
  `backgroundImageUrl`/`backgroundVideoUrl` + a moderate base `overlayOpacity`
  (FULLBLEED_BG_OVERLAY_OPACITY ≈ 40).
- **Deterministic per account** via a hash of `accountId + company name` so the
  same account is stable across regenerations but different accounts spread.
  NEVER random (would churn/repeat).
- **Legibility is now handled** (was a deferred scope): the hero full-bleed
  branch lays a directional black `FULLBLEED_LEGIBILITY_SCRIM` over any
  `backgroundImageUrl`/`backgroundVideoUrl` (heavier left+bottom where the copy
  sits, fading top-right so the asset still reads) ABOVE the brand tint, and
  brightens the muted subheadline to `rgba(255,255,255,0.86)` only when a bg
  asset is present. The gradient default gets NEITHER (no regression). This is
  what made forcing a bg asset onto full-bleed safe.
- **Curated supporting-block order is preserved** — only the hero treatment
  (layout + background asset + `heroImageSide`) varies, so the funnel narrative
  stays intact.

**Why:** the hero component already shipped 4 premium layouts that were never
used; variety was added first (layout only), then a follow-up pass added the
scrim + bg-asset full-bleed treatments so "text over imagery" stays legible.

## Hash gotcha (reused lesson)
`hashSeed` = FNV-1a **plus a Murmur3 fmix32 avalanche**. The finalizer is load-
bearing: plain FNV-1a LOW bits correlate badly for structured seeds like
`"acct-7:Company 7"`, and layout selection reads exactly those low bits via
`% pool.length` — without fmix32, `split` (pool length 2) essentially never got
picked. Any time you pick `array[hash % n]` over structured/sequential keys,
avalanche-mix first or the distribution collapses.
