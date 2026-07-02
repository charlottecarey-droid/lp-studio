# LP Studio — Launch Audit (July 2, 2026)

> **FIX LOG (July 2, same day):** every Blocker and High below is now fixed in
> the working tree, plus M1 (stat-scanner keys/regex) and the microsite video
> clobber. Corrections found while fixing: `dandy-green` resolves to
> `--brand-primary` (H4's "Dandy green leak" was a false positive — no change
> needed); the injected chrome CTA copy was already Dandy-gated. Deliberate
> scope choices: the non-strict social-proof/stats role backfill is kept as an
> editor affordance (strict mode now skips both); GENERAL case-study blocks got
> prompt guardrails + scrub/scan coverage rather than being wired into the
> `cases`-shaped enforcement pass (their prop shapes differ). Tests: two
> onboarding tests pinned the buggy logo precedence and were updated;
> `firecrawl.test.ts` mocks the new SSRF guard (fake hosts don't resolve); one
> new test pins the logo-fallback direction. All touched suites verified at
> exact failure-set parity with the pre-change baseline (remaining failures are
> pre-existing: DB-dependent integration tests + navDedup/sectionBgRhythm).
> Pre-existing, unrelated: `mockup-sandbox` typecheck is broken on a clean tree
> (missing `@/blocks/*` path mapping) — spawned as a separate task.

**Scope:** brand scrape in onboarding (`lib/brand-import/*` + wizard), prompt-to-page
(`routes/lp/generate-page.ts`, 11k lines), prompt-to-microsite
(`routes/sales/generate-microsite.ts`, 5k lines), plus re-verification of the June
deep-review S0 list. Method: three parallel deep-read agents (full file reads, every
finding cited file:line) + direct spot-verification of all blocker-grade claims.
Typecheck passes clean.

All paths below are relative to `artifacts/api-server/src/` unless noted.

---

## Verdict

The pipeline architecture is genuinely launch-grade — tenant isolation fails closed,
parse hardening is excellent, image rotation is seeded, fail-open discipline is
consistent. The remaining risk clusters in four places:

1. **Fabricated content injected server-side** (not by the model) that defeats the
   Strict Facts story: hardcoded Dandy stats in the DSO fallbacks, invented stats in
   `enforceRequiredRoles`, un-scrubbable pseudo-testimonials.
2. **The onboarding logo pick** silently bypasses both the asset mirror and the
   social-card demotion — a one-line frontend bug that degrades essentially every
   onboarding import.
3. **The microsite template path** can misalign copy/images positionally and drops
   the strongest anti-fabrication prompt rule due to a wrong gate variable.
4. **June S0s that never landed**: Sentry capture (0 across all 6 AI routes),
   Firecrawl SSRF/robots, mergeAuthored truncation, the DSO fallback stats.

---

## June S0 re-verification (what got fixed, what didn't)

| June S0 | Status |
|---|---|
| #2 response_format on generation calls | ✅ Fixed (4 call sites, `json_object`) |
| #7 scrape failure surfaced to user | ✅ Fixed (`referenceFailureReason` in responses) |
| #8 openai-semaphore release bug | ✅ Fixed (rewritten on shared `makeSemaphore`) |
| Firecrawl global concurrency cap | ✅ Fixed (`FIRECRAWL_CONCURRENCY=2` semaphore) |
| #20 lp_pages tenant index | ✅ Non-issue (composite `(tenant_id, slug)` unique index exists) |
| #1 DSO fallback fabricated stats | ❌ **Open** — `generate-page.ts:10032–10075` unconditional |
| #5 SSRF guard in firecrawl.ts | ❌ **Open** — `parseReferenceUrl` (firecrawl.ts:209) checks scheme only |
| #6 robots.txt on reference scraper | ❌ **Open** — no `fetchRobotsVerdict` import in firecrawl.ts |
| #12 mergeAuthored array truncation | ❌ **Open** — `generate-microsite.ts:1060` still `base.map((item, i) => ...)` |
| #18 Sentry.captureException on AI routes | ❌ **Open** — grep count is 0 in all 6 critical route files |

---

## Blockers

### B1. Onboarding picks `logoAlternates[0]` — bypasses asset mirror AND social-card demotion
`artifacts/lp-studio/src/lib/onboarding-brand-import.ts:100–102`.
`applyAssetMirror` rewrites only `proposed.logoUrl` to the tenant's mirrored copy
(`lib/brand-import/orchestrator.ts:667`); `logoAlternates` keeps external URLs. Since
alternates exist on virtually every site, onboarding saves a raw external URL as the
brand logo — hotlink protection / renamed assets break it later. Worse, the og:image
social card that `logos.ts:342–344` deliberately demotes can be `alternates[0]`, so the
wizard picks the 1200×630 social banner as the logo.
**Fix (one line):** prefer `p.logoUrl`, use alternates only as picker list:
`const pickedLogo = (typeof p.logoUrl === "string" && p.logoUrl) || imported.logoAlternates?.[0]?.url || ""`.

### B2. Server-side fallbacks inject fabricated statistics (defeats Strict Facts by construction)
Three deterministic paths in `routes/lp/generate-page.ts`:
- `:6107–6120` — `enforceRequiredRoles` stats backfill injects "10,000+ Customers
  served", "98% On-time delivery", "4.9/5 Average rating" for any page missing a stats
  role, after the placeholder scrub, including strict mode.
- `:10032–10075` — `dso-paradigm-shift` fallback hardcodes Dandy claims ("96%+
  first-time fit rate", "2.3% average remake rate", "5-day turnaround") for **any**
  tenant carrying the block — the generic `else` branch (:10062) still emits dental copy.
- `:6095–6106` — social-proof backfill injects a pseudo-testimonial ("Replace with a
  real customer quote…" — "Customer name, Title, Company") that does NOT match
  `PLACEHOLDER_TESTIMONIAL_TEXT_RE` (:4938), so the scrubber can't remove it; it
  renders to visitors verbatim.

**Fix:** skip stats/social-proof backfill in strict mode (or inject value-less
variants); make fallbacks tenant-neutral with schematic values; extend the placeholder
regex with "replace with"/"customer name"; tag injected blocks for editor review.

### B3. Firecrawl reference scraper: SSRF open + no robots + silent failure (June #5/#6 unlanded)
`routes/lp/firecrawl.ts:209–219` validates scheme only — `http://169.254.169.254/`,
`http://localhost:6379/` pass. `maybeMultiPageScrapeRef` fans out 5–10 requests per
inspiration URL with no robots check. `brand-import-from-url-stream.ts:92` already has
`isSafePublicHost` — copy the guard, and mirror the `evidence.ts:503–512` robots pattern.

---

## High — brand scrape / onboarding

- **H1. Stored XSS via mirrored SVGs.** `lib/brand-import/assets-uploader.ts:197–259`
  accepts `image/svg+xml`; `routes/storage.ts:1347–1372` serves it same-origin with the
  upstream content-type, `Access-Control-Allow-Origin: *`, and no CSP/`Content-Disposition`.
  A scraped "logo" SVG containing `<script>` executes on the app origin.
  **Fix:** `Content-Security-Policy: default-src 'none'` (or attachment disposition) on
  SVG serves, or sanitize/rasterize at mirror time.
- **H2. Onboarding retry replays stale partial cache for 24h.** Wizard never sets
  `forceRefresh` (`OnboardingWizard.tsx:269`) while Brand Settings always does
  (`brand-settings.tsx:3276`). A transient AI-proxy storm caches a mostly-failed payload
  (`payloadHasUsableResults` passes with 1 dimension OK); Import-again replays failures
  all day. **Fix:** `forceRefresh: true` on user-initiated retries, or shorter TTL for
  partial payloads.
- **H3. Silent 75s evidence phase + spinners stuck on error.** First stream event only
  after `buildEvidence` completes (`orchestrator.ts:393–406`; budget = 75s,
  `evidence.ts:121–129`). LB idle timeouts kill the connection; the wizard's catch
  (`OnboardingWizard.tsx:306–309`) sets an error but leaves all 8 dimension spinners
  running. **Fix:** heartbeat/phase events during evidence build; map still-loading dims
  to "failed" in the catch.

Medium (brand scrape): DNS-rebinding TOCTOU + unbounded `safeHostCache`
(`evidence.ts:43–58`); redirect-following fetches skip per-hop SSRF re-validation
(stylesheet/screenshot/sitemap/robots — consolidate on the `fetchAsset` loop); robots
only honored for Firecrawl, not the direct homepage/sitemap fetches
(`evidence.ts:801–874`); `mirrorBrandAssets` has no dedup → duplicate media rows every
re-import (`assets-uploader.ts:419–539` — reuse `mirrorReferenceImages`' `refsrc:`
lookup); full-res ≤8MB screenshot uploaded to vision 4× per import (use the existing
preview rendition); brand-import scrape still `waitFor: 1500` while the generate-page
path was tuned to 4000 (`evidence.ts:179–186` vs `firecrawl.ts:88–97`); legacy
`/lp/brand-import/from-url` route drift (no robots/cache/SSRF on screenshot fetch —
delete or delegate to orchestrator).

---

## High — generate-page

- **H4. Dandy/dental prompt content leaks to non-Dandy tenants on DSO paths.**
  DSO Practices intro/rules/imageKeys not gated on `isDandyTenant`
  (`generate-page.ts:7029–7061`); non-Dandy paradigm-shift example keeps "96%
  first-time fit rate — guaranteed" with "mirror this verbosity exactly" (:7019);
  `backgroundStyle: "dandy-green"` mandated unconditionally (:6946–6980, :3441);
  hardcoded "dental practice" image-scoring context (:3521). The `dsoEligible` industry
  gate (:9273) is solid, but any dental non-Dandy tenant gets all of the above.
- **H5. GENERAL-path case-study/quote blocks have no approved-facts guardrail.**
  `CASE_STUDY_BLOCK_TYPES` (:5034) misses `case-study-card-grid`,
  `case-study-logo-results-row`, `case-study-metric-triptych`,
  `case-study-spotlight-feature`, `story-hub` (:6430–6436) — fictional named customers
  ship with only bare numbers flagged. `single-quote`/`quote-with-image` lack the
  "NEVER invent" sentence and `quote-with-image` is in neither scrub set (:4924–4933).
- **H6. Phantom image slots burn gpt-image-1 credits.** The `rows[]` fill has no
  block-type gate (:3271–3279) — `dso-comparison` rows consume 5–7 library images into
  an invisible prop. `sanitizeAIImageUrls`' spreads add `undefined`-valued `image`/
  `imageUrl` keys to every array item (:4267–4287), defeating the fill's `"image" in
  item` gate (:3373); `aiFillEmptyImages` then generates for invisible slots, consuming
  `MAX_GENS=12` in document order before real slots. **Fix:** type-gate the rows fill;
  conditional spread in sanitize.
- **H7. No timeout on model calls; no retry on transient failure.** Main completion
  (:121–166, :9740–9751, :8750–8761) rides the SDK's 10-minute default while holding a
  semaphore slot (8 process-wide) — a hung proxy stalls all generation for up to 10
  min. `aiFillEmptyImages` awaits 12 parallel image gens with silent `catch {}`
  (:3970). **Fix:** explicit 90–120s chat / 30–45s image timeouts; one retry on
  malformed-JSON/transient errors.
- **H8. Strict-facts contradictions.** Prompt says "use the user's EXACT numbers"
  (:6542) but `buildApprovedStatSet` (:4735–4800) never ingests prompt numbers — the
  user's own stats get flagged/scrubbed. `STRICT_FACTS_INSTRUCTION` (:475) tells the
  model to emit the placeholder ~7 schemas forbid. `enforceApprovedCaseStudies` sets
  `cases: []` (:5058–5064), letting the renderer's fictional `DEFAULT_CASES` ship on
  strict pages.
- **H9. Critique pass runs AFTER the strict-facts and banned-phrase scans**
  (:10749 → :10823; template :8999 → :9066). The gpt-4o rewrite can introduce new
  unapproved stats/clichés no validator sees. **Fix:** re-run `scanForUnapprovedStats`
  post-critique.
- **H10. Image-fit advisory is effectively dead.** `lib/ai-prompts/image-fit.ts:70–79`
  — bidirectional `includes` with no length guard on the context side means 1–2-char
  words "overlap" every tag; nothing ever gets flagged. Same looseness in `scoreImage`
  (:1737).

Medium (generate-page, abbreviated): stat-scanner misses `×`/`★`/`B`/`hrs` and several
stat field keys the prompt itself teaches (:4814, :4832); `isApprovedStat` substring
match approves hallucinated claims containing an approved number (:4802–4812);
copy-principles demand "every claim needs a number" with the only "never invent" line
buried+conditional (`copy-principles.ts:52–56` vs `:102`), and single-word bans
("solution", "enable") over-fire the critique pass on most generations; critique pass
swallows failures silently and its `NON_COPY_KEY_RE` blocks CTA-text fixes it keeps
re-flagging (`critique-pass.ts:347, :111–117, :374`); curated `avoidPhrases` dropped
when imported forbiddenPhrases exist (`brand-and-brief.ts:221–223`); injected chrome
violates the product's own sentence-case rules and ships `#` dead links when the tenant
has `defaultCtaUrl` but no Chili Piper (:10422, :10469–10473); unprotected awaits
between SSE start and try blocks hang the client spinner on DB error (:8189–8196,
:9274); template path awaits `mirrorReferenceImages` inline with no 25s grace cap
(:8914–8928) and never runs `enforceHeroResolution`; `parallax-image-hero` missing from
3 image-pipeline hero lists → self-inflicted downgrade loop (:3263, :2192, :3762);
hallucinated-URL allowlist is host-agnostic (`https://evil.example/api/storage/objects/x`
passes, :4103–4115); media catalog cap can let a sibling's bulk upload evict the calling
tenant's assets, with a silent catch that makes DB failure look like "no images"
(:1557–1644).

---

## High — generate-microsite

- **H11. Template path: block-dropping passes run before the positional merge.**
  `enforceAiModes` drop (:4453–4459) and `pruneEmptyContentBlocks` (:4477–4488, gated
  only on `!outlineActive`) delete blocks from `normalizedBlocks`, shifting indices;
  `restoreTemplateImages` (:4677–4682) and the template merge (:4726–4741) then zip
  positionally — block N's copy lands on template block N+1. Governance `excludeTypes`
  is never filtered out of `templateBlockTypes`, so templates can contain a block the
  pipeline is guaranteed to delete. Ships subtly wrong / unpersonalized sections with
  no error. **Fix:** reconcile by canonical type before merging, or gate the drops on
  `!templateBlocks` (replace with the authored block instead of removing).
- **H12. "VALIDATED FACTS ONLY" rule gated on the wrong segment variable.**
  `generate-microsite.ts:2933–2937` passes `matchedSegment` (account-row segment) while
  the TARGET SEGMENT section was already fixed (P0-A, :2833–2839) to use the rep-picked
  segment. Exactly in the documented failure setup (rep picks DSO segment, account row
  lacks it), the pre-validated stats are shown but rule 10's "never invent statistics"
  clause is omitted. **Fix:** gate on the segment actually used for the section.
- **H13. mergeAuthored still truncates + lets AI flip scalars (June #12/#13).**
  `:1060` — AI array longer than authored → extra personalized items dropped. Walk
  `Math.max(base.length, ai.length)` and add a matching-type guard for scalars.
- **H14. Temperature constants defined but never wired (explicit unfinished work).**
  `:1028–1033` define 0.5/0.45 with "Wired in at the model call in Phase 2"; the call
  (:4188) still hardcodes 0.85/0.7. 0.85 + json_object + complex schemas raises silent
  fallbacks to unpersonalized templates. One-line fix.

Medium (microsite, abbreviated): `fillEmptyVideos` treats every external URL as
"invented" and clobbers authored YouTube/Vimeo template videos, with no video props in
the restore list (:201–221, :1097); relaxed image-fill passes omit `brandLogoUrls`
(:4829, :4849 — the Task #1134 regression re-opened); no retry/timeout on the single
LLM call (:4185–4198); prompt contradictions (hero-vs-navbar first block, "system will
supply neutral example stories" is false — the block gets pruned, feeding H11);
AI-researched account facts framed as "REAL" and fed into business-case math with no
numeric validation (:3554–3564, :4069, businessCaseVars.ts:16–29); recommend endpoint
reasoning contradicts the generator's additive-emphasis doctrine and leaks `dso-*`
block names to all tenants (`microsite-recommendation.ts:204–206, :255–309`); raw model
output leaked in the curated-path error response (:4218).

---

## Cross-cutting (still open from June)

- **Sentry:** `grep -c "Sentry\."` = 0 in generate-page, generate-microsite,
  brand-import, brand-import-from-url(-stream), firecrawl. Every catch responds itself,
  so nothing reaches `setupExpressErrorHandler`. 15 min/route to add
  `Sentry.captureException` with tenant/route tags. Do this first — launch-day
  anomalies are currently invisible.

---

## Suggested fix order

**Day 1 — one-liners with outsized payoff**
1. B1 logo pick (`onboarding-brand-import.ts:100`) — 1 line
2. H14 wire microsite temperatures (:4188) — 1 line
3. H2 `forceRefresh` on wizard retry — 1 line
4. H13 mergeAuthored `Math.max` walk + scalar type guard — 3 lines
5. Sentry capture on the 6 AI routes — ~1.5 hrs
6. B3 firecrawl `isSafePublicHost` (copy from brand-import-from-url.ts:228) — 30 min

**Day 2 — fabrication + leakage cluster (the trust story)**
7. B2 strict-mode gates on the three fallback injectors
8. H4 `isDandyTenant` gates on DSO prompt content + dandy-green
9. H5 extend case-study/quote guardrails to GENERAL block types
10. H8 prompt-stats into approved pool; H12 microsite segment gate

**Day 3 — reliability + cost**
11. H7 model-call timeouts + one retry (page + microsite + image gen)
12. H6 phantom-slot fixes (type-gate rows fill; conditional spread in sanitize)
13. H11 microsite template reconcile-by-type
14. H9 post-critique strict re-scan; H10 image-fit length guard
15. H1 SVG serve headers; H3 evidence-phase heartbeat + spinner cleanup

Everything in the Medium tiers is safe to batch after launch except the video-clobber
(M2-microsite) if any launch template carries an authored video.

---

## What's already excellent (don't touch)

Tenant isolation fails closed everywhere it matters; `parsePageCompletion` truncation
repair; seeded determinism (recipes, image rotation, microsite variability via FNV-1a
namespaced seeds); fail-open discipline on every enrichment; verbatim-or-restore passes
for team/resources/products/logos; SSE abort propagation through the semaphore;
prompt-injection sanitization on scraped text; the June semaphore consolidation
(`lib/semaphore.ts`) and Firecrawl choke point; cache-poisoning protection in the
brand-import orchestrator; colors extractor's weak-color filtering and real-world test
suite; case-study integrity enforcement (where wired); the honest partial-failure UX in
the onboarding wizard.
