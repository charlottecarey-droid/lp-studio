---
name: Customer-logo card slots must be excluded from image fill (not sanitize-stripped)
description: Why case-study customer-logo image slots are excluded from the fill pipeline rather than force-cleared at sanitize, and how to add a new one.
---

Blocks whose per-item image slot is a **customer/company LOGO** rendered in a tiny icon / small logo box (e.g. `case-study-card-grid` cards[].imageUrl, `case-study-logo-results-row` results[].logoUrl) must be kept OUT of the generate-page image-fill pipeline, or the library/AI pass drops a stock headshot/lifestyle photo into the tiny box → the recurring **"tiny images where icons should be"** symptom.

**The fix pattern (mirror logo-results-row exactly):**
- `collectImageSlots`: skip the slot for that blockType (guard the generic `pushArrField(props.cards/results, ...)`). This removes it from dedupe, the AI-gen fill walk, AND template-image restore alignment in one move.
- `fillEmptyImages`: do NOT add a fill branch for it (leave empty → company-name-only fallback).
- Renderer: gate the logo/icon box on `hasImage || builderMode` so a published card with no logo shows the company name alone instead of an empty colored square.

**Why NOT force-clear in `sanitizeAIImageUrls`:** because the slot is excluded from `collectImageSlots`, `restoreTemplateImages` no longer restores it. A sanitize force-clear would therefore permanently wipe REAL author/template-authored customer logos with no restore path. The accepted residual risk (model directly emits a valid library URL into the slot → tiny photo persists) is rare and matches the logo-results-row precedent; the dominant cause is the fill pass, which the exclusion eliminates.

**How to apply:** adding a new customer-logo slot needs these 3 coordinated edits in `artifacts/api-server/src/routes/lp/generate-page.ts` plus the renderer gate; do NOT mirror it into sanitize. Distinct from `benefits-grid`/`features` items[].image which ARE sanitize-stripped (gated on `useItemPhotos`) — those have no template-logo concern. Other card blocks (`sticky-stack`) legitimately use cards[].imageUrl for photos, so always guard by blockType, never remove the generic push.
