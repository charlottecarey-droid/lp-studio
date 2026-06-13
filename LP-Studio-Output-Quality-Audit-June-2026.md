# LP Studio — Output Quality Audit (June 11, 2026)

Deep audit of landing page + microsite output quality, focused on the three reported regressions:
random images, lost brand/URL fidelity, and same-page-every-time. Code state verified against
staging as of commit `99f4d67e8` (today's fork-experiments merge).

---

## Part 1 — The three core problems

### 1. Random / irrelevant images

**What already shipped** (verified in current code — much of the June 6–8 P0 plan landed):

- Scraped-image tagging is now **awaited synchronously** on the mirror path, with a per-image
  timeout and graceful provenance-only fallback (`lib/brand-import/assets-uploader.ts:283-329`). ✅
- `CLEAR_GAP` raised to `PURPOSE_MATCH_BOOST` so the scorer no longer overrides the model's pick
  on tag-count ties (`routes/lp/generate-page.ts:1606`). ✅
- `benefits-grid`/`features` are **icon-only by default**; per-item photos only fill when
  `useItemPhotos === true` (`generate-page.ts:~2222`). ✅
- Relaxed last-resort pass is now ranked: own scraped > sibling scraped > starters, and
  unclassified images are quarantined into an "OTHER — use judiciously" catalog section. ✅
- Own-tenant preference nudge + sibling tie-breaker penalty addresses Dandy↔Dandy-SMB
  cross-contamination. ✅

**Why pages STILL get random images — remaining root causes:**

1. **No retag backfill (highest-leverage fix).** Every image mirrored or seeded *before* the
   synchronous-tagging fix still carries provenance-only tags (`["page-reference","scraped","refhost:…"]`)
   or starter-only tags (`["starter","generic"]`). They all score 0 against everything, so for any
   tenant with a pre-existing catalog, candidates still tie at 0 and slots fill arbitrarily.
   The fix only helps *newly imported* images.
   - **Fix:** one-time idempotent backfill script that runs `autoTagImage` (content tags + `lp-*`
     purpose) over every `lp_media` row lacking content/purpose tags. Rate-limit through the
     existing OpenAI semaphore; track a `retagged_v1` marker. Pattern already exists in
     `scripts/` (cf. `migrate-tenant-library.cjs`).

2. **Starter seeds are still untagged.** `seeds/starterImages.ts` rows have only
   `["starter","flagship"|"generic"]` — invisible to the scorer. Either author real content +
   purpose tags into the seed data, or exclude starters from relaxed fill whenever the tenant
   has ≥5 images of its own.

3. **No final image-fit check.** Nothing verifies the *finished* page — there is a copy critique
   pass (`ai-prompts/critique-pass.ts`) but it explicitly never touches image URLs. A cheap
   post-generation pass (vision or text-only: section headline + image tags/description →
   "fits / doesn't fit") that **flags mismatches in the review UI** instead of silently shipping
   would catch every remaining failure mode, including ones you haven't found yet.

4. **"Empty is better than wrong" isn't the policy.** The relaxed pass still places *any* unused
   image rather than leaving a slot empty. For hero and product-detail slots, require
   `score >= PURPOSE_MATCH_BOOST` even in relaxed mode; blocks already have decent
   empty/fallback states.

### 2. Lost brand/URL fidelity ("it used to build pages that looked close to a URL")

1. **Root cause found: persisted `inspirationUrls` are no longer scraped at generation time.**
   `generate-page.ts:~5958-5970` — only URLs pasted into the generate modal (`perRequestUrls`)
   are scraped now. The brand's saved inspiration sites (e.g. the Brand Settings homepage) were
   cut off because auto-scraping re-mirrored the same homepage images on every run and flooded
   `lp_media` with duplicates. The fix threw out the baby with the bathwater: **scraping stopped
   entirely instead of just stopping the image mirroring.**
   - **Fix:** re-enable scraping of persisted inspiration URLs with (a) **mirroring disabled** on
     this path — voice/structure/design only, (b) a scrape cache keyed by URL hash with a multi-day
     TTL so Firecrawl isn't hit every run. The "REFERENCE PAGE — STUDY THIS CAREFULLY" prompt
     section and the vision screenshot path already exist and work — they're just starved of input
     unless the user re-pastes the URL every single time.

2. **Logo regression (s0-6 Bug 2) is NOT fixed.** `lib/brand-import/extractors/logos.ts:~320-328`
   still maps `og` source → `"medium"` confidence, and `flattenForProposed` pre-checks medium. On
   inline-SVG sites (Stripe/Notion-style) where the Playwright fallback fails, a 1200×630 social
   card with a baked-in headline becomes the tenant's "logo" on every generated page.
   - **Fix:** demote `og` to `"low"` confidence, or gate it behind a dimension/aspect check
     (reject ≥2:1 aspect photographic images as logo candidates).

3. **Design tokens from the reference aren't applied.** The reference section drives voice,
   vocabulary, and block structure, but scraped colors/fonts don't flow into the generated page's
   styling. Extracting a small token set (palette, display/body font guess, light/dark feel) from
   the scrape + screenshot and mapping it onto per-page brand overrides would close most of the
   visual "looks like the URL" gap.

4. **UI nudge:** the uploaded-screenshot path always wins and works well — surface it more
   prominently in the generate modal ("paste a screenshot of a page you like").

### 3. Builds pretty much the same page every time

1. **The all-in-one template intent plan was never implemented.** `GlobalTemplateSeed` in
   `seeds/globalTemplates.ts` still has **no `category`, `keywords`, or `isAllInOne` fields** —
   the schema migration, backfill, and intent-matching selector from
   `replit-prompt-all-in-one-template-selection.md` are all outstanding. High-value templates
   (storefront, podcast/content-series, business-case, event, restaurant…) are under-used and the
   generic block assembler runs instead. Ship that plan; it's already fully specced.

2. **Variety is prompt-only — and the prompt anchors the model.** The system prompt says "VARY
   THE STRUCTURE PER BRAND… never emit the same block sequence" (`generate-page.ts:4784, 5082,
   5164`) but then provides one "loose flow that works." LLMs regress to the example: same
   hero → benefits → comparison → CTA skeleton every run.
   - **Fix (structural, not prompt):**
     - Author 3–5 distinct **page recipes** per archetype (editorial, showcase-heavy, data-led,
       story-led). Server picks ONE per generation (seeded rotation per tenant) and injects only
       that recipe — the model varies copy within a varied skeleton instead of being asked to
       self-vary.
     - **Repeat guard:** hash the generated block sequence, store the last N per tenant, and on
       collision re-prompt with the colliding sequence listed as forbidden. Cheap and decisive.

3. The "AT LEAST 2 SHOWCASE blocks" rule exists, but the model picks the *same* showcases.
   Recipe rotation above fixes this for free.

---

## Part 2 — Secondary findings (full-app audit)

### Published-page delivery (strong overall)

The prerender pipeline is genuinely good: Playwright snapshots → R2 with atomic capture,
render-version stamping + post-deploy reconcile, 3-tier worker fallback, asset-presence
verification, sane cache headers. Gaps:

| Pri | Finding | Fix |
|---|---|---|
| P0 | No JSON-LD structured data on published pages | Inject `WebPage`/`Organization` schema in `injectPageMeta.ts` |
| P0 | No `robots.txt` / `sitemap.xml` generation per tenant host | New routes enumerating published pages, honoring noindex |
| P0 | GTM + trackers fire without consent on `lp.meetdandy.com` (`lp-studio/index.html:25-32`) — GDPR/CCPA exposure | Consent manager gate before pixel fire |
| P1 | Published pages hydrate the **entire studio SPA** (all 200+ blocks) | Split a lean viewer bundle; lazy-load interactive blocks |
| P1 | No image resizing/WebP/srcset — originals served as-is | Cloudflare Image Resizing or R2 transforms; `srcset` in `InlineImage` |
| P2 | No www/non-www canonical redirect; pre-mount loader hides page up to 4s on JS failure | CF redirect rule; reduce reveal timeout |

### Block rendering (solid foundation, a11y gaps)

Contrast guarding (`pickContrastingColor` + adversarial-brand test suites) and the template
engine (AST parse/validate/escape) are first-class. Gaps:

| Pri | Finding | Fix |
|---|---|---|
| P1 | No per-block error boundaries — one crashing block can white-screen the page | Wrap `BlockRenderer` cases in a shared boundary (ContentSeries already has the pattern) |
| P1 | Reduced-motion guards missing on parallax/animation heroes (ParallaxImage, ParallaxLayers, AuroraGradient, SpotlightGlow) | `useReducedMotion()` + CSS guards |
| P1 | Generic alt-text fallbacks ("Product showcase"); AI-placed images often lack authored alt | Generate alt text in the same tagging pass (cheap — vision already runs) |
| P1 | Forms: no failure-recovery UX on network error; no spinner during submit | Retry affordance + submitting state |
| P2 | Dark/light text detection is preset-based, breaks on arbitrary hex `bgColor` | Compute luminance from the actual color |
| P2 | Footer links under 44px touch targets; missing `:focus-visible` on interactive cards | Padding + focus styles |

### AI generation (beyond images)

| Pri | Finding | Fix |
|---|---|---|
| P1 | Segment-awareness is optional — SaaS/B2B phrasing leaks into non-SaaS tenants | Auto-trigger segment context from tenant industry |
| P1 | Critique pass is not mandatory; cliché-heavy pages ship unreviewed | Always run it; it's already non-destructive on structure |
| P2 | Fact detection misses attributed quotes and rich-text blocks | Extend `detectFacts` coverage |
| P2 | Strict-mode "X" placeholders are jarring in review UI | Friendlier placeholder copy |

---

## Part 3 — Sequenced plan

**Week 1 — restore trust in generation (your three complaints):**
1. Media **retag backfill** script + starter-seed tag enrichment (fixes random images for existing tenants)
2. Re-enable **cached inspiration-URL scraping** (scrape-only, no mirroring) (restores URL lookalike)
3. Demote `og` logo candidates (kills baked-social-card logos)
4. Relevance floor on relaxed pass for hero/product slots ("empty beats wrong")

**Week 2 — variety:**
5. Ship the all-in-one template intent plan (schema + backfill + selector — already specced)
6. Page-recipe rotation + block-sequence repeat guard

**Week 3 — verification loop:**
7. Post-generation image-fit critique pass, surfaced as review flags
8. Make the copy critique pass mandatory

**Following — visitor-facing P0s:**
9. JSON-LD + sitemap/robots; consent gating on meetdandy hosts
10. Lean published-page bundle + image `srcset`/resizing
11. Per-block error boundaries + reduced-motion + alt-text generation

Items 1, 2, 3, 5 are the four that directly reverse the regressions you're seeing day-to-day.
