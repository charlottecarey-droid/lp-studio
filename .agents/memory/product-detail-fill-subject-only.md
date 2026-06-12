---
name: Product-detail image fill scores on subject only
description: Why product-grid/dso-products-grid slots must NOT inherit the page-context vocabulary bias when picking library images.
---

# Product-detail image fill must score on the item subject alone

In `generate-page.ts` `fillEmptyImages`, the local `pick()` helper biases each
slot's scoring context with the page's generic industry vocabulary
(`getIndustryImageKeywords`, e.g. for dental: "dental dentistry dentist clinic
teeth"). That bias is right for hero/feature slots with generic headlines, but
it is WRONG for `product-detail` slots.

**The rule:** product-detail fills (the `products[]` branch with `imageKey`, and
the `product-detail` `items[]` branch — i.e. `!ITEM_PHOTO_BLOCK_TYPES.has(type)`)
must call `pick(..., biasPage=false)` so they score against the card's own
subject (imageKey/title) ONLY. Hero/feature slots and feature item photos
(benefits-grid `useItemPhotos`) keep `biasPage=true`.

**Why:** every product-detail image gets the +8 PURPOSE_MATCH_BOOST. If the
generic page words are folded into the context, any on-vertical product shot (a
crown, even a logo tagged product-detail) earns positive content score from
those generic words and outscores the card's specific subject — so a "Digital
Dentures" card pulled a crown&bridge photo and an "Overdentures" card pulled a
logo. The specific subject (e.g. "dentures") gets drowned out. A May-2026
page-bias rework introduced this; the original behavior scored product fills on
the item subject alone.

**How to apply:** any NEW product-detail fill callsite added to `fillEmptyImages`
must pass `biasPage=false`. Keep it `true` everywhere else.

**Residual (separate, data not code):** a library row mistagged
`product-detail` + a subject term but that is actually a LOGO will still be
eligible and can win on a subject tie. That is catalog/tag-quality debt — fix by
re-tagging or excluding logo assets from product-detail pools, not by changing
scoring.
