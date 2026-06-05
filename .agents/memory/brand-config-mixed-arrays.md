---
name: Brand-config arrays are mixed-shape
description: productLines/segment string arrays in lp_brand_settings.config can hold objects, not just strings; prompt builders must coerce safely and honor the claims approval gate.
---

# Brand-config JSON arrays are mixed-shape

`lp_brand_settings.config` is free-form JSON. Fields typed as `string[]` in the
server mirrors (e.g. `productLines[].valueProps/claims/keywords`,
`segment.valueProps`) can actually contain **objects** authored by Brand
Settings — most importantly `claims` entries shaped `{ text, approvedForAi }`
(e.g. `{"text":"$99","approvedForAi":true}`), mixed in the same array as plain
strings.

**Rule:** any prompt-building code that maps/filters these arrays must coerce
through a tolerant helper (skip non-strings, extract `.text` from objects),
never `arr.filter(x => x?.trim())` — `?.` guards null/undefined but NOT
non-strings, so a single object element throws
`TypeError: x?.trim is not a function` and 500s the whole generation.

**Claims have an approval gate:** only surface a claim to the AI copywriter when
`approvedForAi !== false` (legacy plain strings = approved). Pricing claims like
"$99" require human sign-off before appearing in generated copy.

**Why:** Dandy enterprise (tenant 1) 500'd on every microsite generation because
its `productLines[].claims` contained `{text,approvedForAi}` objects. The crash
is in `generate-microsite.ts` `buildProductCatalogSection`/`buildSegmentSection`/
`buildSystemPrompt`. Fixed via `toPromptStringList()` + `toApprovedClaimList()`.

**How to apply:** when adding any new read of a brand-config array in the sales
microsite / page-generation prompt path, route it through the tolerant helpers;
grep beyond `valueProps.`/`valueProps?` — the `?? []` form (`valueProps ?? []`)
hides sites from naive greps.

# Per-segment micrositeBlockList is DATA-only

Microsite block selection resolves `segment.micrositeBlockList` →
`brand.defaultMicrositeBlockList` → built-in `NEUTRAL_MICROSITE_BLOCK_LIST`.
These per-segment block lists (incl. all Dandy `dso-*` blocks) exist ONLY as DB
data in `lp_brand_settings.config.segments[]` — there is **no repo seed**. Only
the canonical `dandy` tenant (the demo enterprise tenant) ever had them
populated; sibling/customer tenants whose segments have an empty
`micrositeBlockList` fall through to the neutral 7-block layout (this is why
"every tenant looks the same" — by design, not a regression). Fixing a tenant =
a one-off JSONB data update on its brand row, not a code change.
