# Replit prompt — P0: image-relevance regression (and three siblings)

> **Priority: ship before the S0 list.** This is visible on live customer pages right now (Dandy OSA sleep-appliances page: pink logo, photos in icon slots, same scanner image everywhere, generic photos for everything).

> **⚠️ Running in parallel with Task #1288.** Task #1288 is wiring the unified `IconPicker` (Lucide dropdown + embedded image picker) into every remaining editor icon field. The contract established by #1288 is: **icons always win on icon-led blocks** (benefits-grid, features-*, how-it-works-*, etc.). The `icon` field holds either a Lucide name OR a customer-provided icon-style image URL, and the renderer (`IconOrImage`) resolves both.
>
> **Do-not-touch list (Task #1288's scope):** `BlockBenefitsGrid.tsx` and other block renderers under `artifacts/lp-studio/src/blocks/*`, `IconPicker.tsx`, `IconOrImage.tsx`, any editor panel under `artifacts/lp-studio/src/components/blocks/*Panel.tsx`. Touching files outside that list — including `BrandLogo.tsx` and `brand-config.ts` on the client side, or anything under `artifacts/api-server/src/` on the server side — is fair game.

## What's broken

Generated pages used to pick topically-correct imagery — dentures on dental pages, business shots on DSO pages, technology on tech pages. They no longer do. Symptoms:

1. **Relevance gone**: Random images placed everywhere; the model's catalog picks get cleared by a tag-driven scorer that has no signal when tags are missing.
2. **Cross-tenant repetition**: Dandy ENT and Dandy SMB share images. The same scanner image fills slot after slot.
3. **Photos in icon slots**: Feature/benefit cards that should show Lucide icons now show full photos with the icon demoted to a tiny badge.
4. **Dandy logo renders pink**: SVG mask-recolor is repainting the multi-color Dandy logo with the tenant's brand-primary.

## Root cause — DO NOT REVERT

The scorer landed May 30 in `1b1c1c920` ("Make AI page generation pick relevant, non-duplicate images (Task #469)") and was stable for a week. The regression is the **interaction of three Jun 6 commits** on top of an under-tagged catalog:

| Commit | What it did | Side effect |
|---|---|---|
| `26b16eff6` | `resolveOwnedTenantIds` lets reciprocal-sibling tenants share read access to media catalogs (Dandy ↔ Dandy SMB seeded as canonical pair) | Cross-tenant images now compete for the same slots; nothing favors the calling tenant's own assets |
| `b0a9a6586` | Adds `benefits-grid` to `ITEM_PHOTO_BLOCK_TYPES`; registers `props.items[].image` as an image slot; prompt tells model to emit `image: ""` | Server unconditionally fills every benefit card's `image` field with a photo, demoting Lucide icons to 44px badges |
| `7a9be32be` | Strict-pass gate softened to `score >= 0` (curated) / `> 0` (scraped); adds unconditional relaxed last-resort pass at line 4804 | Once strict pass can't find a positive scorer (common — most candidates tie at 0), last-resort places ANY unused image with zero relevance gate |

Each fix on its own was correct. The interaction with an **under-tagged catalog** is what blew up:

- `mirrorReferenceImages` at `lib/brand-import/assets-uploader.ts:585-608` writes scraped rows with only `["page-reference", "scraped", "refhost:<host>", "refsrc:<url>"]` — all in `SKIP_TAGS` or prefix-matched out by `scoreImage`. **Scraped images score 0 against everything.**
- `autoTagImage` at `routes/storage.ts:252-334` only fires on the **upload** path (`setImmediate` at line 491), silently no-ops when `AI_INTEGRATIONS_OPENAI_API_KEY` is absent, and silently swallows all errors. **Not called by `mirrorReferenceImages`.**
- `STARTER_IMAGE_SEEDS` (`seeds/starterImages.ts`) have only `["starter","flagship"]` or `["starter","generic"]` tags. **Score 0 against everything.**

Net result: in a typical tenant, nearly every candidate ties at 0; `scoreImage`'s deterministic "first max-scorer wins" rule (line 783, `score > bestScore` strictly) makes the same starter or first-scraped row win every slot; `validateAndDedupeAIImages` clears the model's catalog picks whenever any other candidate happens to have one content-tag hit (6+ score gap).

---

## Step 1 — Audit

Read these end-to-end and put a 6-line summary in the PR description:

- `artifacts/api-server/src/routes/lp/generate-page.ts:587-588, 670-697, 709-747, 783, 830, 914-1078, 1094-1177, 1141, 1145-1177, 1318-1349, 1357-1583, 1429-1438, 4670-4810, 4804`
- `artifacts/api-server/src/lib/brand-import/assets-uploader.ts:496-620, 566-574`
- `artifacts/api-server/src/routes/storage.ts:252-334, 491`
- `artifacts/api-server/src/lib/libraryScope.ts` (full file)
- `artifacts/api-server/src/seeds/starterImages.ts` (skim)
- `artifacts/lp-studio/src/components/BrandLogo.tsx:14-110`
- `artifacts/lp-studio/src/lib/brand-config.ts:645`

**Do NOT read or modify** `artifacts/lp-studio/src/blocks/BlockBenefitsGrid.tsx`, `IconPicker.tsx`, `IconOrImage.tsx`, or any editor panel under `artifacts/lp-studio/src/components/blocks/*Panel.tsx` — those are Task #1288's scope. Trust that on icon-led blocks, the renderer will resolve the `icon` field correctly when this PR stops auto-filling `image`.

---

## Step 2 — Make scraped-image tagging synchronous + add purpose

**File:** `artifacts/api-server/src/lib/brand-import/assets-uploader.ts` (`mirrorReferenceImages` + `scheduleAutoTag`)

**Current state (verified against live code):** `mirrorReferenceImages` DOES call the tagger via `scheduleAutoTag` (around line 621). The bug isn't that the tagger never runs — it's that it runs **asynchronously after the mirror returns**. The brand-import endpoint completes, then the page-gen LLM call starts within seconds, and the tags usually haven't landed yet. By the time the first generation finishes, the next one might see tags — but the first generation that triggered the import always sees provenance-only rows.

Compounding this: the existing tagger (`autoTagImage` in `routes/storage.ts:252-340`) sets content tags but **does not set a purpose tag** for scraped images — only the upload path's full classification flow does. So even when async tagging eventually lands, scraped images come out with content tags but no `lp-hero`/`lp-feature`/`product-detail` purpose, which means they only show up in the catalog's `unclassified` "OTHER" section and never compete for the right slot in the scorer.

**Change A — make scheduleAutoTag synchronous on the mirror path:**

Replace the fire-and-forget `scheduleAutoTag(...)` call in `mirrorReferenceImages` with an awaited variant. Concretely: add a `awaitTagging?: boolean` option (default `false` to preserve upload-path behavior) and have `mirrorReferenceImages` pass `awaitTagging: true`. Then `await Promise.all(scheduleAutoTagAwaited(...))` over the freshly mirrored rows before returning. Brand-import already has a multi-second budget and the page-gen LLM call hasn't started yet, so this latency is the right tradeoff.

**Change B — classify purpose for scraped images:**

When tagging a scraped image, pass the source-page context (page title, h1, the section it came from on the reference page if known) to the classifier so it returns both content tags AND a `purpose` ∈ `{lp-hero, lp-feature, product-detail}`. The classifier's existing prompt already supports this — it's just not invoked from the mirror path. Inspect `autoTagImage` in `routes/storage.ts:252-340` and use the same JSON shape.

**Change C — handle missing API key gracefully:**

If `AI_INTEGRATIONS_OPENAI_API_KEY` is missing: log a structured warning (`Sentry.captureMessage("image_tagger_no_api_key", level: "warning", tags: { route: "mirror-reference-images" })`) and fall through with provenance-only tags. **Do not crash mirror-reference if tagging fails** — failure to tag is degraded mode, not error.

### Tests

- `mirrorReferenceImages.test.ts`: scrape a page with 5 images → assert each persisted row has at least one content tag AND a `lp-*` purpose tag AFTER the call returns (not eventually)
- Missing API key path → assert provenance-only tags are written + warning logged + no throw
- Tagger timeout (mock): the scheduled call hits the budget → fall back to provenance-only + warning + no throw
- Smoke: import a fresh URL, immediately generate a page → confirm scraped images surface in the catalog text with content tags AND purpose buckets (not only `unclassified`)

---

## Step 3 — Only clear on purpose-driven gaps, not tag-count differences

**File:** `artifacts/api-server/src/routes/lp/generate-page.ts` — `validateAndDedupeAIImages` Pass 2 (around line 1284–1289 on current code; may have drifted — locate via the `wrongPurpose / clearlyWorse` variables and the `CLEAR_GAP` reference at the top of the function).

### The actual bug

Today the condition is:
```ts
const wrongPurpose = assignedScore < 0;
const clearlyWorse = (bestAlt - assignedScore) >= CLEAR_GAP;  // CLEAR_GAP = 2 * TAG_MATCH_SCORE = 6
if (wrongPurpose || clearlyWorse) clearPick();
```

`CLEAR_GAP = 6` is the equivalent of "alt has 2 more tag matches than the model's pick." That means a model pick scoring 8 (correct purpose, 0 tag hits) gets cleared by an alt scoring 14 (correct purpose, 2 tag hits) — even though the model picked from the right section. The model is being second-guessed on tag-count ties when its purpose pick was correct.

This is the actual lever for Dandy: when the model picks a tagged denture (e.g. score 11) and another tagged denture exists (also score 11), nothing changes. But when the model picks a less-tag-decorated denture (score 8: purpose only) and an alt has one specific tag match (score 11: purpose + 1 tag), gap is 3 — survives. Bump the alt to two tag matches (score 14) and gap is 6 — clears. That's the tag-count override Replit is calling out.

### The fix — raise CLEAR_GAP to PURPOSE_MATCH_BOOST

```ts
// Find the constant declaration (around line 587-588):
// BEFORE
const PURPOSE_MATCH_BOOST = 8;
const TAG_MATCH_SCORE = 3;
// ...later...
const CLEAR_GAP = 2 * TAG_MATCH_SCORE;  // = 6

// AFTER
const PURPOSE_MATCH_BOOST = 8;
const TAG_MATCH_SCORE = 3;
// Only clear the model's pick when the alternative has a purpose-class advantage
// (i.e. the alt is in the right section and the model wasn't, OR the alt is in
// the right section with massively more relevance signal). A pure tag-count
// difference inside the same purpose section is not enough to override the
// model — the model knows the catalog descriptions better than the scorer's
// substring matching does.
const CLEAR_GAP = PURPOSE_MATCH_BOOST;  // = 8
```

One line. The `wrongPurpose` branch stays — that's the legitimate "model picked the wrong purpose section, e.g. a `product-detail` in a `hero` slot" case and should still clear (`scoreImage` penalises it to a negative value).

### Why this works

Score decomposes as `purpose_boost + (tag_matches × 3)`:

| Scenario | Assigned | Best alt | Gap | Today (CLEAR_GAP=6) | Proposed (CLEAR_GAP=8) |
|---|---|---|---|---|---|
| Both purpose-match, both 0 tag hits | 8 | 8 | 0 | Keep | Keep |
| Both purpose-match, alt has 1 more tag | 8 | 11 | 3 | Keep | Keep |
| Both purpose-match, alt has 2 more tags | 8 | 14 | 6 | **Clear** | Keep |
| Both purpose-match, alt has 3 more tags | 8 | 17 | 9 | Clear | Clear |
| Model in OTHER, alt purpose-match | 0 | 8 | 8 | Clear | Clear |
| Model wrong purpose (e.g. product-detail in hero) | -2 to -10 | 8 | 10–18 | Clear (wrongPurpose) | Clear (wrongPurpose) |

Effect: the "alt has 2 more tag matches in the same section" case stops clearing. Everything else stays. That's the targeted change.

### Tests

- Both purpose-match, gap=6 (2 more tag matches on alt) → model's pick survives (was cleared)
- Both purpose-match, gap=9 (3 more tag matches on alt) → cleared (legitimate large advantage)
- Model in OTHER, alt purpose-match → cleared (purpose-driven gap)
- Model picked `product-detail` for a `hero` slot → cleared via `wrongPurpose`
- Catalog with all-0-score images (rare — only happens when nothing has purpose tag): all gaps stay near 0 → model's picks survive (this case is fine under both old and new)

---

## Step 4 — Icon fields always get icons; item photos become opt-in

**Files (server-side only):**
- `artifacts/api-server/src/routes/lp/generate-page.ts:830` (`ITEM_PHOTO_BLOCK_TYPES`)
- `artifacts/api-server/src/routes/lp/generate-page.ts:1429-1438` (`fillEmptyImages` items-image pass)
- `artifacts/api-server/src/routes/lp/generate-page.ts:985, 914-1078` (`collectImageSlots`)
- `artifacts/api-server/src/routes/lp/generate-page.ts:2823` (prompt instruction)

**Do NOT touch:** any block renderer (`BlockBenefitsGrid.tsx`, etc.), the `IconPicker` component, `IconOrImage`, or any editor panel. Task #1288 owns the editor + renderer side.

### The contract — at the field level, not the block level

Many blocks (`benefits-grid`, `features-*`, `how-it-works-*`, etc.) legitimately have BOTH icon fields AND image fields. Those blocks are not banned from having images. The contract is per-field:

- **`icon` field** (anything wired to `IconPicker` — single string holding either a Lucide name or a customer icon-style image URL): the AI **always** sets a Lucide icon name from the catalog. The image-picker side of `IconPicker` exists for editors who want to swap in their own icon asset; the AI never puts a generated photo URL into an icon field.
- **`image` field** (separate field for full photos, wired to `ImagePicker`): valid to exist on the same block as `icon`. The server can fill it, but **only when the model has explicitly decided this block uses item photos** — never as a default.

Today the prompt teaches the model to emit `image: ""` on every item, the server registers `items[].image` as an `lp-feature` slot, and `fillEmptyImages` drops a random photo into each one regardless of brand context. That's how Dandy OSA's B2B benefit cards got photos demoting their icons to badges.

### Change A — Keep `ITEM_PHOTO_BLOCK_TYPES` populated; gate fill on an opt-in boolean

```ts
// generate-page.ts — leave the set membership ALONE (around line 922 on current code)
const ITEM_PHOTO_BLOCK_TYPES = new Set([
  "benefits-grid",
  "features",
  // ...all current members stay
]);

// generate-page.ts — add the opt-in gate at the SHARED item-fill loop
// (around line 1611 on current code — locate the single `for (const item of block.props.items ?? [])`
// loop that handles items[].image fill; all three fill passes (strict, relaxed, last-resort)
// route through it, so this one gate covers all three)
if (
  ITEM_PHOTO_BLOCK_TYPES.has(block.type) &&
  block.props.useItemPhotos === true
) {
  for (const item of block.props.items ?? []) {
    if (!item.image) item.image = pickFromPool(...);
  }
}
```

**Gate placement matters:** Verified in the live code, all three fill passes (strict-curated, strict-scraped, relaxed last-resort) call into the same item-fill loop. Putting the `useItemPhotos === true` gate at that single loop covers all three passes — there's no separate path that could re-inject photos through the relaxed last-resort. If the loop has been split or duplicated in a refactor by the time you read this, make sure the gate is replicated on every path that touches `items[].image`.

Add `useItemPhotos: boolean` (default `false`) to the block schema for every block currently in `ITEM_PHOTO_BLOCK_TYPES`. This is a non-breaking additive prop — existing pages with no `useItemPhotos` set behave as if it's `false` (no auto-fill, icons-only).

### Change B — Update the prompt at line 2823

Replace any instruction that tells the model to emit `image: ""` on benefits/features/how-it-works items with:

> **Icon fields (every field wired to `IconPicker`)**: set to a Lucide icon name from the catalog. Never set an icon field to a photo URL. The image-picker inside `IconPicker` is for human editors to swap in custom icon assets — not for the AI to drop photography into.
>
> **`items[].image` fields on benefits-grid, features-*, how-it-works-*, etc.**: these are optional photo slots that coexist with the per-item icon. Default behavior is icon-only cards. To enable per-item photography on a block, set `useItemPhotos: true` at the block level AND set `image` on each item. Only do this when the brand is visual/consumer/lifestyle (e-commerce, restaurant, hospitality, fashion, real estate) AND the items have distinct visual referents. For B2B, SaaS, healthcare, or any block where each card is an abstract benefit ("Boost outcomes", "Easy billing"), leave `useItemPhotos` unset or `false` and omit `image` on each item.

### Change C — Don't backfill `useItemPhotos` on existing pages

Migration / load behavior: when reading an existing page that has `items[].image` filled but no `useItemPhotos` field, do NOT retroactively set `useItemPhotos: true`. Existing pages render whatever's already in the props. The new gate only applies to NEW generation. Existing pages keep their old photos until regenerated.

### Tests

- B2B brief (`"Build me a sleep apnea page for a dental practice"`) → `benefits-grid` generated → `useItemPhotos` is `false` or omitted → no item has `image` filled by the server → assertion: every item has `icon` set to a Lucide name, no item has `image` set
- Restaurant brief → `benefits-grid` (or other amenity block) → model sets `useItemPhotos: true` → server fills `items[].image` per item
- AI is given an icon catalog → assertion: no `icon` field on any generated block contains a URL or an extension like `.jpg/.png/.webp/.svg`. Icons are always Lucide names.
- Existing page with `items[].image` filled but no `useItemPhotos` → loads and renders identically (no retroactive scrub)

---

## Step 5 — Don't let cross-tenant sibling images dominate the scorer

**File:** `artifacts/api-server/src/routes/lp/generate-page.ts:610-700` (`fetchMediaCatalog`)
**File:** `artifacts/api-server/src/lib/libraryScope.ts:21-44` (`resolveOwnedTenantIds`)

The sibling-shared catalog is intentional for the picker UI (Dandy ENT user wants to see Dandy SMB's uploads in the media drawer). But sharing the same pool with the scorer means sibling images compete for the calling tenant's page slots — and when both pools are largely untagged, the "first-seen wins" determinism leaks the same images across tenants.

**Change — sibling penalty (recommended), NOT pool exclusion:**

Excluding siblings from the scoring pool entirely creates a real footgun: the model can still legitimately pick a sibling URL (it sees siblings in the catalog text by design). When `validateAndDedupeAIImages` re-scores that pick, it would find the URL absent from the narrowed scoring pool and treat it as "not found" — clearing a good legitimate pick.

Safer approach: keep one pool, deprioritize sibling images by a small score penalty.

```ts
// In scoreImage (around line 709-747)
function scoreImage(img, contextLower, contextWords, preferredPurpose, callingTenantId): number {
  let score = 0;
  // ... existing purpose + tag scoring ...

  // Sibling penalty: prefer the calling tenant's own assets in ties.
  // Doesn't exclude siblings — they're still pickable, just not preferred.
  if (img.tenantId && callingTenantId && img.tenantId !== callingTenantId) {
    score -= 1;
  }

  return score;
}
```

This requires propagating `tenantId` through the `MediaImage` shape (it's already on `lpMediaTable`) and threading `callingTenantId` into `scoreImage` calls. Picker UI is unaffected; the catalog text still lists sibling images (so the model can pick them when they're genuinely the best match); the scorer just prefers own-tenant assets in close calls.

### Tests

- Tenant `dandy` with both own and sibling-tagged denture images at score 11 each: scorer picks own-tenant version (gap = 1, but model's choice is preserved either way because of Step 3's purpose-only clear)
- Tenant `dandy` picks a sibling URL explicitly: `validateAndDedupeAIImages` does NOT clear it just because it's a sibling (only `-1` penalty in scoring, not removal from pool)
- Tenant with no sibling: scoring unchanged from today

---

## Step 6 — Dandy logo pink

**File:** `artifacts/lp-studio/src/components/BrandLogo.tsx:74-95`
**File:** `artifacts/lp-studio/src/lib/brand-config.ts:645`

Today `BrandLogo` defaults `logoAutoRecolor: true` for any SVG and mask-paints the SVG silhouette with `var(--brand-primary)`. That works for monochrome wordmarks (Stripe, Mutiny) but destroys multi-color marks (Dandy).

**Change — lead with the targeted opt-out; treat the default flip as a separate, deliberate decision:**

### 6a (required, ship now). Hard-code an opt-out for known multi-color marks

This is the actual Dandy fix. Low-risk, surgical, no behavior change for any other tenant.

In `BrandLogo.tsx` (around line 96 on current code — find the `autoRecolor` derivation), add a `KNOWN_MULTICOLOR_LOGOS` set covering Dandy's logo paths:

```ts
const KNOWN_MULTICOLOR_LOGOS = new Set([
  "/dandy-logo.svg",
  "/dandy-logo-white.svg",
  "/dandy-logo-dark.svg",
]);

const pathname = (() => {
  try { return new URL(src, location.origin).pathname; }
  catch { return src; }
})();
const isKnownMulticolor = KNOWN_MULTICOLOR_LOGOS.has(pathname);

// BEFORE
// const autoRecolor = isSvg && (brand.logoAutoRecolor ?? true);
// AFTER
const autoRecolor = isSvg && !isKnownMulticolor && (brand.logoAutoRecolor ?? true);
```

Note the runtime fallback stays `?? true` — no implicit behavior change for any existing tenant. The Dandy logo simply gets the explicit opt-out via path match.

### 6b (recommended). Detect multi-color SVGs at upload time

When a logo SVG is uploaded, parse it and count distinct non-`currentColor` `fill=` / `stroke=` values. If more than one distinct color, set `logoIsMonochrome: false` on the brand record. The renderer checks this flag and skips recolor regardless of `logoAutoRecolor`.

This generalises 6a beyond Dandy — future tenants with multi-color logos get auto-detected at upload.

### 6c (deliberate, separate decision). Flip the default to `false`

```ts
// brand-config.ts:645
logoAutoRecolor: false,  // was: true
```

**This is a wider runtime change than the other two.** It affects every existing tenant who never set the field — including monochrome-wordmark tenants who currently rely on the recolor default for dark-nav contrast. Their logos will suddenly stop recoloring on dark backgrounds.

Recommendation: ship 6a + 6b first to fix Dandy without side effects. Consider 6c as a separate follow-up after auditing which existing tenants' rendering depends on the implicit `true` default (likely small number). If you go ahead with 6c, pair it with a one-time migration that sets `logoAutoRecolor: true` explicitly for any tenant whose existing logo IS monochrome (detected via 6b's SVG parser) so their rendering doesn't shift.

### Tests

- Render Dandy brand with default settings → logo renders in its native colors, NOT pink
- Render a known monochrome brand (e.g. one in seeds with `logoAutoRecolor: true`) → logo gets recolored to `var(--brand-primary)`
- Upload a multi-color SVG → `logoIsMonochrome: false` set on brand record
- Upload a monochrome SVG → `logoIsMonochrome: true` set

---

## Step 7 — Preserve library catalog variety for well-tagged tenants

**Files (server-side only):**
- `artifacts/api-server/src/routes/lp/generate-page.ts:660-678` (catalog text rendering, `buildSection`)
- `artifacts/api-server/src/routes/lp/generate-page.ts:677` (per-tag URL cap)

**Why this matters specifically:** Tenants like Dandy have dozens of product images correctly tagged with specific terms (`denture`, `acrylic`, `scanner`, `crown`, etc.) plus a purpose tag (`product-detail`). The catalog rendering already groups these correctly into sections like `[PRODUCT DETAIL] "denture" (12): url1, url2, url3` — but caps each group at **3 URLs**. For a 6-card product showcase that needs 6 distinct dentures, the model only sees 3 URLs in the "denture" group and either repeats or falls back to a less-specific group (which might pull a non-denture product). This is the "same product showing up in multiple squares" and "wrong product in some squares" pattern.

### Change A — Bump per-tag URL cap to 8 (or per-purpose, see Change B)

```ts
// generate-page.ts:677
// BEFORE
.map(([tag, grpImgs]) => `  "${tag}" (${grpImgs.length}): ${grpImgs.slice(0, 3).map(i => i.url).join(" , ")}`);

// AFTER
.map(([tag, grpImgs]) => `  "${tag}" (${grpImgs.length}): ${grpImgs.slice(0, 8).map(i => i.url).join(" , ")}`);
```

The catalog stays bounded because tag overlap is high (an image with 3 content tags appears in 3 groups). Token impact is modest; benefit to product-grid variety is large.

### Change B — Per-purpose URL cap (optional, more refined)

If Change A bloats the prompt for tenants with very large libraries, cap by purpose section instead:

| Section | URLs per tag |
|---|---|
| HERO & LIFESTYLE | 6 |
| FEATURE IMAGES | 6 |
| **PRODUCT DETAIL** | **10** (Dandy-style product-grid variety lives here) |
| OTHER | 4 |

Make the cap a parameter to `buildSection`. Defaults can stay at 8 for simplicity; bump to 10 only for product-detail.

### Change C — Catalog text stays unified; Step 5's sibling penalty handles cross-tenant preference

Step 5 (above) uses a per-image `-1` sibling penalty in `scoreImage` rather than a pool split. That means the catalog text rendered to the model already includes own-tenant + sibling-shared images — no separate query needed. The model can pick from either; the scorer just nudges toward own-tenant assets when scores are otherwise tied. No additional change here beyond Step 5.

### Change D — Pass 2 (Step 3 above) keeps tagged-library picks together

This is a clarification, not a new code change. When Step 3's raised `CLEAR_GAP = PURPOSE_MATCH_BOOST` is in place, the model's good tagged-library picks survive even when the scorer has a tied-or-similar alternative. For Dandy's product-grid: model picks `denture-1.jpg` (scores 11 via purpose + tag), scorer finds `denture-2.jpg` also scoring 11 → gap is 0 → model's pick survives. Even when the alt scores 14 (purpose + 2 tags vs model's purpose + 1 tag), gap is 3 — below the new `CLEAR_GAP` of 8 — model survives. The combination of Steps 3 + 5 + 7 restores "6 distinct dentures in 6 squares."

### Tests

- Dandy tenant with 12+ tagged denture images: regenerate a 6-card product-grid for a denture page → assertion: 6 distinct URLs, all from the `product-detail` purpose section, all matching the "denture" tag group
- Dandy tenant with both ENT and SMB siblings: regenerate the same page on each → assertion: model can see both libraries in the catalog text; scorer's `-1` sibling penalty makes the calling tenant's own images win in close calls; neither tenant ships the other's photos by accident
- Tenant with sparse library (1 tagged denture, lots of starters): the 1 denture is picked for the most-relevant slot; starters only fill remaining slots
- Tenant with completely untagged library: catalog falls back to `(untagged, N): url1...` blocks (existing behaviour, preserved)

---

## Step 8 — Demote starter seeds (defense in depth)

**File:** `artifacts/api-server/src/routes/lp/generate-page.ts:1318-1349` (`buildReferenceFillPool`)

Confirm the fill-pool ordering is: curated tenant images → fresh-scraped reference images → other reference scraped → starter seeds (last). Starter seeds should ONLY be reached when nothing else is available.

Today the order is curated → freshScraped → currentRefScraped → otherScraped. Verify that "curated" doesn't include starter seeds inline — they should be a separate tail of the pool, not mixed in.

If starter seeds ARE mixed into curated, split them out:

```ts
const pool = [
  ...tenantCuratedImages,    // tenant's own uploads
  ...freshScrapedImages,
  ...currentRefScrapedImages,
  ...otherScrapedImages,
  ...starterSeedImages,       // last resort only
];
```

### Test

- Tenant with one curated image + many starter seeds → curated image is picked first; starter only used if curated is exhausted

---

## Acceptance criteria

- [ ] `mirrorReferenceImages` awaits `scheduleAutoTag` (or equivalent synchronous variant) for every scraped image before returning
- [ ] Scraped-image tagger sets BOTH content tags AND a `purpose` tag (`lp-hero`/`lp-feature`/`product-detail`)
- [ ] Missing API key on tagger path logs warning + falls through with provenance-only tags + does not throw
- [ ] `CLEAR_GAP` raised from `2 * TAG_MATCH_SCORE` (6) to `PURPOSE_MATCH_BOOST` (8) — only purpose-driven gaps clear the model's pick
- [ ] `wrongPurpose` branch preserved (negative scores still clear, e.g. `product-detail` in a `hero` slot)
- [ ] `ITEM_PHOTO_BLOCK_TYPES` membership unchanged — benefits-grid, features-*, how-it-works-* etc. still listed
- [ ] `items[].image` server-fill gated on `block.props.useItemPhotos === true` at the SHARED item-fill loop (covers strict + relaxed + last-resort passes)
- [ ] `useItemPhotos: boolean` (default `false`) added to schema for every block in `ITEM_PHOTO_BLOCK_TYPES`
- [ ] Existing pages with `items[].image` set but no `useItemPhotos` field load + render unchanged (no retroactive scrub)
- [ ] Prompt updated: icon fields always get Lucide names (never URLs / file extensions); item photos opt-in via `useItemPhotos` for visual/consumer brands only
- [ ] AI catalog generation test: no generated `icon` field contains a URL or image-file extension
- [ ] **Editor panels, IconPicker, IconOrImage, and block renderers are NOT touched** (Task #1288's scope)
- [ ] `scoreImage` accepts `callingTenantId` and applies a `-1` penalty when image's `tenantId !== callingTenantId`
- [ ] Sibling images stay in the picker + scoring pool (NOT excluded) — model picks of sibling URLs survive validation
- [ ] `BrandLogo.tsx` hardcodes opt-out for `KNOWN_MULTICOLOR_LOGOS` (`/dandy-logo.svg`, `/dandy-logo-white.svg`, `/dandy-logo-dark.svg`) — Dandy logo renders in native colors
- [ ] `?? true` runtime fallback in `BrandLogo` is left unchanged for now (default-flip is a separate, deliberate decision — NOT in this PR unless paired with a tenant audit + migration)
- [ ] Starter seeds are the last tier of `buildReferenceFillPool`, not mixed with curated
- [ ] Per-tag URL cap in catalog text bumped from 3 to 8 (or per-purpose: 10 for `product-detail`)
- [ ] Smoke: Dandy 6-card denture product-grid ships 6 distinct denture URLs
- [ ] **Smoke test pages**: generate one each for dental / DSO / tech / restaurant / Dandy ENT / Dandy SMB — assert images are topically relevant, no cross-tenant leakage, B2B grids show icons not photos, Dandy logo renders in native colors
- [ ] Existing `generate-page.images.test.ts` + `imagePipeline.test.ts` still pass (update assertions where they encoded the regression)
- [ ] `pnpm typecheck` clean

## Don't

- **Don't revert any of the Jun 6 commits.** Each one fixed a real bug. Targeted re-engineering only.
- **Don't delete `validateAndDedupeAIImages`.** The dedupe pass is the only thing catching the model repeating URLs.
- **Don't raise `CLEAR_GAP` past `PURPOSE_MATCH_BOOST` (8).** That would suppress legitimate "alt is in the correct purpose section while model wasn't" clears. 8 is the load-bearing number — it draws the line between "purpose-driven gap" (clear) and "tag-count gap inside the same purpose section" (keep model's pick).
- **Don't add `icon`, `iconName`, `cardIcon` to `collectImageSlots`.** The icon field is the renderer's job (Task #1288's `IconOrImage` resolves it). The fix is to stop the server from putting a photo into the SIBLING `image` field.
- **Don't remove `benefits-grid`, `features-*`, `how-it-works-*` from `ITEM_PHOTO_BLOCK_TYPES`.** These blocks legitimately have both icon AND image fields per item. Visual/consumer brands genuinely want photo cards. The fix is gating the auto-fill on `useItemPhotos === true`, not banning images from the block.
- **Don't backfill `useItemPhotos: true` on existing pages.** Existing pages with `items[].image` already filled should load and render unchanged. The opt-in gate only applies to fresh generation.
- **Don't touch any file under `artifacts/lp-studio/src/blocks/` or `artifacts/lp-studio/src/components/blocks/*Panel.tsx` or `IconPicker.tsx` or `IconOrImage.tsx`.** Those belong to Task #1288. Coordinate by contract, not by code-touch.
- **Don't remove the logo recolor feature entirely.** Monochrome wordmark tenants (Mutiny, etc.) use it for dark-nav contrast. Make it opt-in with multi-color detection.
- **Don't flip the `?? true` runtime fallback in `BrandLogo` in this PR.** That's a wider behavior change than it looks — every monochrome wordmark tenant who never set the field gets affected. The hardcoded `KNOWN_MULTICOLOR_LOGOS` opt-out fixes Dandy without that side effect. If you want to flip the default later, pair it with an upload-time multi-color detector (Step 6b) and a one-time migration that sets `logoAutoRecolor: true` for tenants whose existing logo IS detected as monochrome.
- **Don't leave `scheduleAutoTag` as fire-and-forget on the `mirrorReferenceImages` path.** The tagger IS being called today — that's not the bug. The bug is that it runs after the function returns, so the first page-gen call sees provenance-only rows. Await it.
- **Don't exclude sibling images from the scoring pool.** That breaks model picks of sibling URLs (the catalog text still shows siblings, the model can pick one, then validation can't find it in the narrowed pool and clears). Use the `-1` penalty in `scoreImage` instead.
- **Don't add an ML relevance model.** The model already picks well when it has signal — give it signal instead of replacing it.

## Verification screenshots

After deploy, regenerate the Dandy OSA sleep-appliances page (https://dandy.lpstudio.ai/...) and check:

1. Hero image is dental/sleep-appliance themed, not generic
2. The six benefit cards show Lucide icons (lightning, person, dollar-sign, briefcase, settings, plus) at full size — NOT photo + tiny icon badge
3. The "scanner image" doesn't appear in multiple slots
4. Dandy logo in the nav renders in native colors (not pink/coral)
5. Regenerate the same page on Dandy SMB tenant — assert NO image from the Dandy ENT page reappears
