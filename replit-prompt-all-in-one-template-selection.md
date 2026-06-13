# Replit prompt — AI picks the right all-in-one template by intent

## What we're solving

LP Studio has several **all-in-one templates** — multi-section, self-contained pages built for specific use cases (storefront, podcast series, blog series, business case, etc.). When a user asks the AI to generate one of these page types, the AI should detect intent and **use the matching template as-is** instead of assembling a generic landing page from blocks. Today the selector has no signal beyond free-text title/description matching, so it under-uses these high-value templates.

## Findings from a codebase audit

`GlobalTemplateSeed` (`artifacts/api-server/src/seeds/globalTemplates.ts:15-31`) currently has: `slug`, `title`, `templateLabel`, `templateDescription`, `ogImage`, `industry`, `blocks`, `premiumRank`. **No `keywords` or `category` field.** That's the gap.

The all-in-one templates that exist today (these are **single monolithic blocks** — one React component renders all sections, so adding extra blocks would break the layout):

| slug | category | seeded |
|---|---|---|
| `global-flagship-storefront-dtc` | storefront | flagshipTemplates.ts:1672 |
| `global-flagship-content-series-podcast` | content-series (podcast variant) | flagshipTemplates.ts:1352 |
| `global-flagship-blog-series-editorial` | blog | flagshipTemplates.ts:1574 |
| `global-business-case-split` | business-case | globalTemplates.ts:2895 |
| `global-business-case-centered` | business-case | globalTemplates.ts:2912 |
| `global-business-case-premium-editorial` | business-case | globalTemplates.ts:2929 |

Plus authored multi-block templates that behave all-in-one (5+ distinct block types curated as one page):

| slug | category | seeded |
|---|---|---|
| `global-flagship-event-landing` | event | flagshipTemplates.ts:998 |
| `global-flagship-restaurant` | restaurant | flagshipTemplates.ts:569 |
| `global-flagship-creator-portfolio` | portfolio | flagshipTemplates.ts:745 |
| `global-flagship-productized-agency` | services | flagshipTemplates.ts:1195 |
| `global-flagship-local-services` | services | flagshipTemplates.ts:848 |
| `global-flagship-ai-product-launch` | saas-launch | flagshipTemplates.ts:18 |
| `global-flagship-enterprise-platform` | saas-launch | flagshipTemplates.ts:204 |
| `global-flagship-premium-saas` | saas-launch | flagshipTemplates.ts:409 |

**Gaps Charlotte expected but don't exist yet:** `customer-story-hub`, `case-study-detail` (DCA-style single customer story), and `content-series` seeded as a video variant (only podcast is seeded; the block supports `seriesType: "video" | "newsletter" | "blog"`). These should be seeded as a follow-up — out of scope for this PR.

---

## Step 1 — Audit and confirm

Read these files first and put a 5-line summary in the PR description:

- `artifacts/api-server/src/seeds/globalTemplates.ts` — `GlobalTemplateSeed` schema, business-case templates
- `artifacts/api-server/src/seeds/flagshipTemplates.ts` — storefront / content-series / blog-series / event / restaurant / etc.
- The AI template-selection logic — search for `selectTemplate`, `pickTemplate`, `chooseTemplate`, `templateMatch`, or the function that decides which template (if any) the AI should use from a user brief. Likely in `artifacts/api-server/src/lib/ai/` or `artifacts/api-server/src/routes/lp/pages.ts` near the generate handler.
- The generate-from-scratch path (when no template is selected, AI assembles blocks) — note how it differs from the from-template path.
- The URL-inspiration handler — if the user provides a URL, where is that consumed? Likely a separate prompt path that uses the URL's structure as the design brief.

---

## Step 2 — Schema additions

Extend `GlobalTemplateSeed` and the corresponding `lp_global_templates` (or whatever the persisted table is) with:

```ts
interface GlobalTemplateSeed {
  // ... existing fields
  category?:
    | "storefront"
    | "content-series"   // podcast / video / newsletter
    | "blog"
    | "business-case"
    | "customer-story-hub"   // future
    | "case-study"           // future
    | "event"
    | "restaurant"
    | "portfolio"
    | "services"
    | "saas-launch"
    | "generic";             // default — not all-in-one
  keywords?: string[];       // intent strings the AI matches against
  isAllInOne?: boolean;      // true if the template is monolithic OR is a curated multi-block recipe that should NOT have extra blocks added
}
```

Migration adds two columns to the persisted templates table: `category TEXT NULL` and `keywords JSONB NULL` and `is_all_in_one BOOLEAN DEFAULT FALSE`.

---

## Step 3 — Backfill the existing all-in-one templates

Update the seed entries with these category + keyword tags. Re-running the seed should be idempotent — only update rows that don't already have these fields set, to preserve any manual edits.

```ts
// storefront-dtc
category: "storefront",
keywords: ["storefront", "shop", "ecommerce", "e-commerce", "online store",
  "product page", "DTC", "direct to consumer", "buy now", "checkout",
  "cart", "products", "catalog", "merchandise", "store"],
isAllInOne: true,

// content-series-podcast
category: "content-series",
keywords: ["podcast", "podcast series", "podcast page", "podcast home",
  "podcast hub", "video series", "video show", "content series",
  "show", "episodes", "episode archive", "interview series",
  "newsletter series", "series hub"],
isAllInOne: true,

// blog-series-editorial
category: "blog",
keywords: ["blog", "blog series", "blog home", "essays", "articles",
  "editorial", "magazine", "publication", "writing", "article archive",
  "contributors", "topic index"],
isAllInOne: true,

// business-case-split
category: "business-case",
keywords: ["business case", "exec brief", "executive summary",
  "ROI case", "enterprise pitch", "consultative sales", "deal microsite",
  "1:1 sales page", "buyer brief"],
isAllInOne: true,

// business-case-centered
category: "business-case",
keywords: ["business case", "ROI case", "exec narrative",
  "comparison case", "paradigm shift", "KPI case", "centered case"],
isAllInOne: true,

// business-case-premium-editorial
category: "business-case",
keywords: ["business case", "editorial case", "inbound narrative",
  "story-led case", "exec briefing", "story-driven case"],
isAllInOne: true,

// event-landing
category: "event",
keywords: ["event", "event landing", "conference", "summit", "meetup",
  "RSVP", "agenda", "speakers", "event page", "registration"],
isAllInOne: true,

// restaurant
category: "restaurant",
keywords: ["restaurant", "menu", "dining", "reservations", "bar",
  "eatery", "café", "cafe", "bistro", "food"],
isAllInOne: true,

// creator-portfolio
category: "portfolio",
keywords: ["portfolio", "creator", "designer portfolio", "artist site",
  "personal site", "work", "case work", "selected work"],
isAllInOne: true,

// productized-agency
category: "services",
keywords: ["agency", "subscription agency", "productized agency",
  "service subscription", "design subscription", "monthly retainer"],
isAllInOne: true,

// local-services
category: "services",
keywords: ["local service", "plumbing", "HVAC", "landscaping",
  "contractor", "home service", "get a quote", "service area"],
isAllInOne: true,

// ai-product-launch
category: "saas-launch",
keywords: ["AI product", "AI launch", "AI tool", "model launch",
  "prompt-driven", "AI startup"],
isAllInOne: true,

// enterprise-platform
category: "saas-launch",
keywords: ["enterprise platform", "IT buyer", "infrastructure",
  "enterprise software", "platform page"],
isAllInOne: true,

// premium-saas
category: "saas-launch",
keywords: ["premium SaaS", "SaaS landing", "high-end SaaS",
  "conversion-tuned SaaS"],
isAllInOne: true,
```

All other seeded templates default to `category: 'generic'`, `isAllInOne: false`, `keywords: []`.

---

## Step 4 — AI template selection logic

Build (or extend) a `selectTemplateForBrief(brief, urlInspiration?)` function in `artifacts/api-server/src/lib/ai/`:

```ts
interface SelectionResult {
  templateSlug: string | null;
  category: string | null;
  matchKind: "keyword" | "semantic" | "no-match";
  confidence: number; // 0–1
  rationale: string;
}

function selectTemplateForBrief(brief: string, urlInspiration?: string): SelectionResult
```

### Algorithm

1. **URL inspiration override.** If `urlInspiration` is non-null, skip template matching entirely and return `{ templateSlug: null, matchKind: "no-match", confidence: 0, rationale: "URL inspiration provided — build from scratch using the URL as the structural reference" }`. The user gave us a design preference; respect it.

2. **Keyword pass.** Normalize the brief (lowercase, strip punctuation). For each template with `isAllInOne === true`, compute a keyword match score:
   - Count keyword hits where the keyword phrase appears as a whole-word match in the brief
   - Weight multi-word keywords higher (longer = more specific intent)
   - If multiple templates in the same category match (e.g., two business-case variants), prefer the one with the highest aggregate keyword score; if tied, prefer the one most recently seeded
   - Threshold: at least one strong keyword hit (3+ chars or multi-word) OR two single-word hits to consider a template a candidate

3. **Confidence calc.** `confidence = (matched_kw_weight / max_possible_kw_weight)` clamped to 0–1. A brief like "build me an ecommerce page for sneakers" matches `storefront-dtc` with high confidence (`ecommerce` + implicit). A brief like "we should probably do something interactive" matches nothing.

4. **Decision:**
   - `confidence >= 0.5` → return that template
   - `confidence < 0.5` AND any all-in-one template matched on at least one keyword → return the top match anyway (low-confidence path) but tag it for downstream "could-be-wrong" handling
   - No matches → return `templateSlug: null` (AI builds from scratch)

5. **Semantic fallback (optional, post-launch).** If the embedding pipeline is already available in the codebase, run a cosine-similarity check between the brief and `templateDescription` for templates flagged `isAllInOne`. If keyword match returned null but semantic similarity > 0.75, return that template with `matchKind: "semantic"`. Otherwise skip this step.

### Logging

Every selection decision is logged with: brief (truncated to 200 chars), result (slug or null), matchKind, confidence, top 3 considered templates with their scores. This lets you tune keywords + threshold over time.

---

## Step 5 — Use the all-in-one template correctly

When `selectTemplateForBrief` returns a template with `isAllInOne === true`:

1. **Load the template's authored blocks as-is.** Don't merge with the generic block-assembly path.
2. **Run AI customization on the block content** — replace copy, swap imagery, retune brand tokens — but DO NOT add, remove, or reorder blocks. The authored structure is the template's contract.
3. **Brand the page** — apply tenant brand tokens (colors, fonts, voice), pull imagery from brand library, override stock photos with brand-appropriate alternatives if the brand has photography uploaded.
4. **Run the existing strict-facts pipeline** on the customized output (the new review flow Charlotte already specced).
5. **In the AI prompt to the model**, include an explicit instruction: `THIS IS AN ALL-IN-ONE TEMPLATE. Do not propose adding, removing, or reordering blocks. Customize the copy and imagery within the existing structure.`

When `selectTemplateForBrief` returns `templateSlug: null`:

- Fall back to the existing from-scratch block-assembly path.
- If `urlInspiration` was the reason for the null, pass the URL into the from-scratch path so the AI uses the URL's structure as the design reference.

---

## Step 6 — Surface the decision to the user

After generation, show a small subtle line in the builder UI: *"Generated from the **Storefront — DTC Shop** template."* (with a link to the template card). This helps the user understand what just happened and gives them recourse if the wrong template was picked ("I didn't want a storefront, let me re-generate without a template" → re-run with a flag that skips template selection).

When confidence was below 0.5 but a template was still selected (the low-confidence path), the line reads: *"Looks like a storefront page — generated from the **Storefront — DTC Shop** template. Wrong guess? **[Re-generate from scratch]**"*

---

## Step 7 — Out of scope for this PR (flag as follow-ups)

- **Seed missing templates.** `customer-story-hub`, `case-study-detail`, and the `content-series` video variant don't exist. Author them in separate PRs.
- **Semantic embedding fallback.** Implement only if the embedding pipeline already exists; otherwise treat as a v2 enhancement.
- **User-facing template-override UI.** If the user wants to explicitly request "no template, build from scratch" or "use the X template," that's a separate UI affordance.

---

## Acceptance criteria

- [ ] `GlobalTemplateSeed` schema has `category`, `keywords`, `isAllInOne` optional fields
- [ ] Migration adds `category`, `keywords`, `is_all_in_one` columns to the persisted templates table
- [ ] All 14 all-in-one templates listed above have category + keywords backfilled
- [ ] `selectTemplateForBrief(brief, urlInspiration?)` exists and is tested
- [ ] URL-inspiration override returns no-match deterministically
- [ ] Keyword matching is whole-word; multi-word keywords weighted higher
- [ ] Confidence threshold defaults to 0.5; tunable via env var
- [ ] All-in-one templates loaded WITHOUT extra blocks added by the AI
- [ ] Brand customization (colors, fonts, imagery) still runs on all-in-one templates
- [ ] Strict-facts review flow still runs on the customized output
- [ ] Selection decision logged with brief + result + confidence
- [ ] UI shows "Generated from the X template" line with the template link
- [ ] Low-confidence selections show a "Wrong guess? Re-generate from scratch" affordance
- [ ] Smoke test: prompt "build me a podcast page" → selects `content-series-podcast`, no extra blocks added, copy + colors brand-matched
- [ ] Smoke test: prompt "I want an ecommerce storefront for my candle shop" + URL `https://otherbrand.com` → URL takes precedence, builds from scratch
- [ ] `pnpm typecheck` clean

## Don't

- Don't add or remove blocks when an all-in-one template is selected. The whole point is the curated structure.
- Don't refactor the from-scratch generation path. This PR is additive — it adds a pre-step that may short-circuit the existing path.
- Don't backfill `keywords` on non-all-in-one templates. Generic landing templates should not appear in the selector's candidate set.
- Don't lower the confidence threshold below 0.5 without telemetry to back it up. Aggressive matching = mis-matched templates = bad UX.
- Don't run semantic fallback unless an embedding pipeline already exists in the codebase. If you have to build it, that's a separate PR.
- Don't override the user's URL-inspiration brief with a template. URL = explicit design preference; template selection is implicit intent inference. Explicit wins.
- Don't seed `customer-story-hub` or `case-study-detail` as empty placeholders in this PR. Better to leave them missing than to ship empty stubs.
