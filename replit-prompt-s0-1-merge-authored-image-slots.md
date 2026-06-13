# Replit prompt — S0: plug the silent-drop holes in microsite generation

## What we're solving

The sales-microsite route (`artifacts/api-server/src/routes/sales/generate-microsite.ts`) has four bugs that **silently drop or corrupt** content between the template + AI response + final page. Same shape as the regression that lost forms and hero images on customer microsites — the `mergeAuthored` fix landed but four more landmines remain. Together they will ship broken or downgraded pages on Product Hunt day with no warning.

## The four bugs

### Bug 1 — Pre-merge whitelist erasure drops AI personalization

`generate-microsite.ts:1983` calls `normalizeBlock(b, i, fallbackBrand)` on the AI's response **before** `mergeAuthored` runs at `:2160`. Inside `normalizeBlock` → `mergeWithDefaults` (`:592`), every known block type has a per-case `return { headline, subheadline, ...whitelisted-fields }` block. Any AI-personalized prop that isn't in the case's literal object is dropped, then `mergeAuthored` restores the authored copy on top.

Net effect: for a listed block type (e.g. `hero` → 11 fields), if the AI faithfully personalizes a field not in the whitelist (e.g. `eyebrowColor`, `cardLayout`, `theme`, `formMode`), the user sees the unpersonalized authored copy. Same drop pattern as the original forms/hero regression, opposite direction.

### Bug 2 — mergeAuthored truncates AI arrays longer than authored

`generate-microsite.ts:451`:
```ts
return base.map((item, i) => (i < ai.length ? mergeAuthored(item, ai[i]) : item));
```

If template authored 3 placeholder items and the AI returned 6 personalized ones, items 4–6 are silently dropped. The user gets the first 3 only.

### Bug 3 — mergeAuthored lets AI flip booleans and override numbers

`generate-microsite.ts:463`:
```ts
return ai;  // unconditional for typeof ai === "number" || "boolean"
```

An AI hallucination of `false` overrides an authored `showDetailsSection: true`. An AI return of `0` overrides authored `columns: 3`. Invisible.

### Bug 4 — restoreTemplateImages slot list lags collectImageSlots

`generate-microsite.ts:488` `SCALAR_IMAGE_PROPS` lists 5 keys. But `collectImageSlots` in `generate-page.ts:914` handles a much larger set: `bundleImageUrl`, `featuredArticle.imageUrl`, `tiles[].primary` (bento blocks), `articles[].imageUrl`, `contributors[].avatarUrl`, `products[].imageUrl`, `slides[].src`, plus video slots (`backgroundVideoUrl`, `posterImage`).

Any of those slots that the template authored will NOT be restored when the AI returns an empty value. Same shape as the original regression. There is also no `restoreTemplateVideos` at all — videos are fillable via `fillEmptyVideos` but not restorable from the template.

---

## Step 1 — Audit

Read these files end-to-end and put a 5-line summary in the PR description:

- `artifacts/api-server/src/routes/sales/generate-microsite.ts` — `mergeAuthored:448`, `restoreTemplateImages:488`, `mergeWithDefaults:592`, AI call site `:1900`, template merge `:2118-2170`
- `artifacts/api-server/src/routes/sales/generate-microsite.imagePipeline.test.ts` — existing image-pipeline tests
- `artifacts/api-server/src/routes/sales/generate-microsite.smoke.integration.test.ts` — end-to-end smoke
- `artifacts/api-server/src/routes/lp/generate-page.ts:914` — `collectImageSlots` (the canonical image slot map)

---

## Step 2 — Fix mergeAuthored (lines 448–467)

Rewrite the function. Concrete contract:

```ts
export function mergeAuthored(base: unknown, ai: unknown): unknown {
  // Both arrays: walk to the longer length, mergeAuthored each pair
  if (Array.isArray(base) && Array.isArray(ai)) {
    const out = [];
    const len = Math.max(base.length, ai.length);
    for (let i = 0; i < len; i++) {
      if (i < base.length && i < ai.length) {
        out.push(mergeAuthored(base[i], ai[i]));
      } else if (i < ai.length) {
        // AI returned more items than authored — KEEP them
        out.push(ai[i]);
      } else {
        // Authored has more items than AI — KEEP them
        out.push(base[i]);
      }
    }
    return out;
  }

  // Object on object: merge by key
  if (isPlainObject(base) && isPlainObject(ai)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(ai as Record<string, unknown>)) {
      out[k] = mergeAuthored(
        (base as Record<string, unknown>)[k],
        (ai as Record<string, unknown>)[k]
      );
    }
    return out;
  }

  // AI is null/undefined: keep authored
  if (ai === null || ai === undefined) return base;

  // AI is empty string: keep authored (avoids AI blank-out)
  if (typeof ai === "string" && ai.trim() === "") return base;

  // Scalar-on-scalar with MATCHING type: AI wins
  if (typeof ai === typeof base) return ai;

  // Type mismatch (e.g. authored boolean, AI returned string;
  // authored number, AI returned string): KEEP authored.
  // This protects against AI flipping authored booleans/numbers via type confusion.
  if (base !== undefined && base !== null) return base;

  // base is undefined/null and ai is a non-empty scalar: AI wins (additive)
  return ai;
}
```

Add `isPlainObject` helper if it doesn't exist:
```ts
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
```

### New tests

Add to `generate-microsite.imagePipeline.test.ts` (or a new `mergeAuthored.test.ts`):

- AI array longer than authored: walks the longer length, keeps AI items beyond base
- AI array shorter than authored: keeps the trailing authored items (current behaviour)
- AI returns `false` against authored `true` (matching type): AI wins (this is the existing contract)
- AI returns `"false"` (string) against authored `true` (boolean): authored wins (type mismatch protection)
- AI returns `0` against authored `5` (matching type): AI wins
- AI returns `"0"` (string) against authored `5` (number): authored wins
- AI returns `""` against authored `"Headline"`: authored wins
- AI returns `null` against authored `"Headline"`: authored wins
- AI returns `{ url: "x" }` against authored `""`: AI wins (additive)

---

## Step 3 — Reorder so mergeAuthored runs BEFORE normalizeBlock

In the template path at `generate-microsite.ts:2118-2170`:

Today the order is:
1. `normalizedBlocks = aiBlocks.map((b, i) => normalizeBlock(b, i, fallbackBrand))` (line ~1983)
2. `mergeAuthored(tmpl.props, normalizedBlocks[i].props)` (line ~2160)

Change to:
1. **First** merge: `merged = mergeAuthored(tmpl.props, aiBlocks[i].props)`
2. **Then** normalize: `normalized = normalizeBlock({ type: tmpl.type, props: merged }, i, fallbackBrand)`

This way, AI-personalized fields not in the per-type whitelist survive into `merged`, and `normalizeBlock` only clamps/defaults missing fields rather than erasing extras.

If `normalizeBlock` actually NEEDS to run first for some block-type-specific validation (skim the `:592` switch), pass a `preserveExtras: true` flag down so unknown keys pass through.

### Confirm

- Add a smoke test: AI personalizes a non-whitelisted field like `eyebrowText: "Quarterly Review"` on a `hero` block. After generation, that field is present in the saved page block props.

---

## Step 4 — Make restoreTemplateImages consume collectImageSlots

Today `restoreTemplateImages` at `generate-microsite.ts:488` has its own hardcoded `SCALAR_IMAGE_PROPS` list. Replace it with a call to the canonical slot collector.

### Option A (recommended) — Import collectImageSlots from generate-page.ts

```ts
import { collectImageSlots } from "../lp/generate-page";

export function restoreTemplateImages(
  templateBlock: { type: string; props: Record<string, unknown> },
  finalBlock: { type: string; props: Record<string, unknown> },
): void {
  const templateSlots = collectImageSlots(templateBlock);
  const finalSlots = collectImageSlots(finalBlock);

  // Pair slots by path; if template had a value and final's matching slot is empty, restore it.
  const templateByPath = new Map(templateSlots.map(s => [s.path, s]));
  for (const finalSlot of finalSlots) {
    const tmplSlot = templateByPath.get(finalSlot.path);
    if (!tmplSlot) continue;
    const tmplValue = tmplSlot.get();
    const finalValue = finalSlot.get();
    if (tmplValue && (!finalValue || (typeof finalValue === "string" && finalValue.trim() === ""))) {
      finalSlot.set(tmplValue);
    }
  }
}
```

If `collectImageSlots` is not currently exported, export it. If it has internal callers that depend on its current shape, leave them and add a thin wrapper if needed.

### Option B (if A is too risky) — Extend SCALAR_IMAGE_PROPS

Add to the existing list at minimum:
- `bundleImageUrl`
- `featuredArticle.imageUrl`
- `tiles[].primary` (bento blocks)
- `articles[].imageUrl`
- `contributors[].avatarUrl`
- `products[].imageUrl`
- `slides[].src`

And add a separate `SCALAR_VIDEO_PROPS` with `backgroundVideoUrl`, `posterImage`, `videoUrl`, `mediaUrl`, and a parallel `restoreTemplateVideos` that runs alongside `restoreTemplateImages` in the same call site.

### Confirm

- Add tests for each restored slot. Take a template authored with `tiles[0].primary = "https://cdn.example.com/tile.jpg"`. Have the AI return an empty `tiles[0].primary`. After generation, the slot is restored to the authored URL.
- Same test for `backgroundVideoUrl` on a hero block.

---

## Acceptance criteria

- [ ] `mergeAuthored` walks `Math.max(base.length, ai.length)` for arrays
- [ ] `mergeAuthored` enforces matching scalar type before letting AI win
- [ ] `mergeAuthored` keeps authored value when AI returns `""`, `null`, `undefined`, or a type mismatch
- [ ] Template path runs `mergeAuthored` BEFORE `normalizeBlock` (OR `normalizeBlock` preserves unknown keys)
- [ ] `restoreTemplateImages` covers every slot returned by `collectImageSlots` (or extended hardcoded list matches)
- [ ] Parallel `restoreTemplateVideos` exists and runs on the same call sites
- [ ] New unit tests cover all five mergeAuthored cases listed above
- [ ] New smoke test: AI personalizes non-whitelisted field → survives to saved page
- [ ] New smoke test: template authored bento `tiles[].primary` survives when AI returns empty
- [ ] New smoke test: template authored `backgroundVideoUrl` survives when AI returns empty
- [ ] Existing `imagePipeline.test.ts` and `smoke.integration.test.ts` still pass
- [ ] `pnpm typecheck` clean

## Don't

- Don't remove the per-type whitelist in `mergeWithDefaults` — other call paths depend on it for default-filling. Either reorder so it runs after merge, or add a preserve-extras flag.
- Don't have AI win when type doesn't match the authored type. That's how booleans get silently flipped.
- Don't truncate AI arrays. If the AI personalized more items than the template seeded, the user wants those items.
- Don't refactor `collectImageSlots` in this PR. Just consume it. The image-slot walker is one of the better pieces of the code — leave it alone.
- Don't keep `SCALAR_IMAGE_PROPS` as a separate hardcoded list if you can avoid it. Two lists guarantee drift; this PR exists because they already drifted.
- Don't change `mergeAuthored`'s exported signature. Tests import the function by name.
