---
name: AI trust-bar/stats are numeric-only
description: AI-generated trust-bar/stats blocks must never carry per-item images; the image XOR stat is decided generation-side, across several coordinated callsites.
---

# AI trust-bar / stats blocks are NUMERIC-only

AI page/microsite generation must produce `trust-bar` (and its legacy alias
`stats`) blocks as value+label pairs only — **never** a per-item `image`. The
manual builder still supports trust-bar images (BlockTrustBar renders image XOR
numeric value per item) and is untouched; the constraint is purely on AI output.

**Why:** the server auto-fills empty `item.image` from the `lp-feature` photo
pool (homepage screenshots / text-bearing graphics) and the media library has no
iconic/logo purpose tag to filter on. Result was a stat label like "CUSTOMER
SATISFACTION RATING" / "UPFRONT COST" sitting above a random screenshot — reads
as broken. Decision: stat bars stay numeric; use a separate image block for
imagery.

**How to apply:** stat bars are gated by `STAT_BAR_BLOCK_TYPES` (exported from
`generate-page.ts`, imported by `generate-microsite.ts`). Any new image-assigning
path must skip these block types' `items[].image`. There are SEVERAL coordinated
callsites — miss one and the bug returns:
- `collectImageSlots` / `validateAndDedupeAIImages` — don't treat stat-bar items as image slots.
- `fillEmptyImages` — guard `props.items` fill with `!STAT_BAR_BLOCK_TYPES.has(blockType)`.
- `sanitizeAIImageUrls` — force-clear stat-bar `items[].image = ""`.
- `aiFillEmptyImages` — skip `arrKey === "items"` for stat bars (else AI image-gen re-populates them).
- microsite normalizer (`mergeWithDefaults`) — emit `{value,label}` only.
- microsite `restoreTemplateImages` — skip restoring `items` image for stat bars (legacy templates carry them).
- prompt schemas in BOTH generators (`generate-page` block schema + rule 9a; `generate-microsite` BLOCK_PROP_SCHEMAS for both "trust-bar" AND "stats").

`benefits-grid` / `features` keep per-card photos (`ITEM_PHOTO_BLOCK_TYPES`) —
do not over-filter them.
