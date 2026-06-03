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
- **Asset-gated candidate pool:** `full-bleed` (gradient default) always; add
  `split` only if a `lp-hero`-tagged image exists; add `split-video` +
  `stacked-video` only if a tenant video exists. No assets ⇒ only full-bleed, so
  a broken/empty layout is never produced.
- **Deterministic per account** via a hash of `accountId + company name` so the
  same account is stable across regenerations but different accounts spread.
  NEVER random (would churn/repeat).
- **No new combos.** Only the four already-designed layouts. Do NOT force a
  background image onto full-bleed — contrast/legibility is a separate scope and
  the gradient default is the safe premium look.
- **Curated supporting-block order is preserved** — only the hero treatment
  (layout + `heroImageSide`) varies, so the funnel narrative stays intact.

**Why:** the hero component already shipped 4 premium layouts that were never
used; variety had to be added without re-opening copy/contrast/order scope.

## Hash gotcha (reused lesson)
`hashSeed` = FNV-1a **plus a Murmur3 fmix32 avalanche**. The finalizer is load-
bearing: plain FNV-1a LOW bits correlate badly for structured seeds like
`"acct-7:Company 7"`, and layout selection reads exactly those low bits via
`% pool.length` — without fmix32, `split` (pool length 2) essentially never got
picked. Any time you pick `array[hash % n]` over structured/sequential keys,
avalanche-mix first or the distribution collapses.
