# LP Studio launch-readiness deep review

**Reviewed:** generate-page (prompt-to-page brain), firecrawl/URL ingestion, brand-import orchestrator + extractors, sales-microsite + mergeAuthored, strict-facts pipeline, cross-cutting (Sentry/perf/tenant scoping/billing).
**Method:** six parallel deep-read agents, each reading 5–15 files end-to-end and citing file:line for every finding.

---

## Executive summary

**LP Studio is more structurally sound than Charlotte probably gives it credit for.** The hard parts that usually rot in solo-founder codebases are well-engineered: per-tenant rate limits with cost ceilings, SSRF-hardened brand-import with manual redirect re-validation, robots.txt parsing with proper longest-match precedence, Playwright workers with detached-pid reaping, regen-memory for fact-flag resolutions, cache-poisoning protection that refuses to persist all-failed runs, PII-scrubbing Sentry init, atomic welcome-email claim, idempotent slug suffixing, deterministic per-account seeds, and a Cloudflare worker with R2→origin→reload-shim fallbacks. Strict-facts wiring is *substantially more complete* than the new review-flow spec implies.

**The launch risks fall into three clusters:**

1. **Silent-output-drop bugs** in mergeAuthored + restoreTemplateImages + DSO fallback paths that ship fabricated or dropped content with no warning.
2. **Abuse surface** on the reference-URL scraper (`firecrawl.ts`) — no SSRF guard, no robots check, silent empty-corpus failures.
3. **Observability hole** — the four critical AI routes return their own 500s without ever calling `Sentry.captureException`, so a launch-day storm will be invisible.

Fix the 20 S0s below before Product Hunt and the launch is solid. Most are small.

---

## S0 — Launch blockers (do not ship without)

### Generation brain (generate-page.ts + prompts)

1. **DSO fallback ships hardcoded fabricated stats** — `generate-page.ts:4574-4617` substitutes literal "96%+", "5-day", "2.3% remake" when the AI omits the array. Strict-Facts no longer scrubs (`generate-page.ts:4100-4112`), so they ship to the user with a yellow pill at best. For a non-dental tenant whose prompt classifies as DSO via "practice", these dental stats render verbatim. **Fix:** gate fallback behind `!strict`, or replace numeric values with `"X"` placeholder.

2. **No JSON response_format on the main generation calls** — `generate-page.ts:4411-4419` and `:3941-3949`. Single prose preamble from the model = `JSON.parse` 500 + burned AI quota (quota is decremented up front). Critique pass at `critique-pass.ts:223` does set `response_format: { type: "json_object" }`. **Fix:** match the critique-pass pattern on both the freeform and template paths.

3. **`urlSourcedFacts=true` disables the case-study guard for the whole page** — `generate-page.ts:4129, 5108`. The route bypasses `enforceDsoSuccessStoriesApproved` entirely when a trusted URL is present, including invented quotes the AI hallucinates that have *no* relationship to the scraped page. **Fix:** keep the approved-pool rebuild even when a trusted URL is present; only relax the strict-stat scanner.

4. **DSO classifier over-fires** — `isDsoPracticesPrompt` at `generate-page.ts:2511` matches "practice" anywhere. "Build me a chiropractic practice page", "yoga practice", "meditation practice" all flip into Dandy-flavored DSO Practices prompt + inherit the dental fallback (#1). **Fix:** word-boundary multi-token signals + require an industry hint.

### URL ingestion (firecrawl.ts)

5. **SSRF wide open** — `firecrawl.ts:187-225`. `parseReferenceUrl` only validates the scheme; no `isSafePublicHost` / DNS private-IP check. A user can paste `http://169.254.169.254/...`, `http://localhost:6379/`, internal hostnames. By contrast `brand-import-from-url.ts:228` and `brand-import-from-url-stream.ts:92` both call `isSafePublicHost(parsed.hostname)`. **Fix:** add the same guard to `parseReferenceUrl` before launch.

6. **No robots.txt check on the reference scraper** — `firecrawl.ts` never imports `fetchRobotsVerdict`. Worse, `maybeMultiPageScrapeRef` (`:244-273`) fans out 5–10 requests per inspiration URL to `/about`, `/pricing`, `/customers`, `/product`, etc. — abuse complaints incoming. **Fix:** mirror the `evidence.ts:503-512` pattern (`robots.allowed[matchPath] !== false`).

7. **Reference scraper silently sends empty corpus to the AI on failure** — `firecrawl.ts:96` `catch { return null; }`. Downstream `generate-page.ts:3671-3687` resolves to `{ scraped: null, failureReason }` and generation proceeds unchanged. No user-visible "we couldn't read that site" warning. Demo-killer for Cloudflare-protected URLs. **Fix:** surface `failureReason` to the user before generation runs.

### Brand import (orchestrator + extractors)

8. **openai-semaphore release/acquire bug** — `openai-semaphore.ts:32-41`. `release()` hands a slot to the next waiter without incrementing `inFlight`, and `acquire()` for waiters never increments either. `inFlight` drifts low under queue pressure and bursts past `MAX_CONCURRENT=3` — exactly the proxy 429 storm the file is meant to prevent. **Fix:** ensure waiters increment `inFlight` on dequeue.

9. **Logo fallback can persist a baked-image social card as the brand logo** — `extractors/logos.ts:181-186, 250-258, 320-328`. When no header/footer/svg-alt/playwright candidate exists (Stripe/Notion/Vercel-style inline-SVG sites where the Playwright spawn fails), `og` ranks next at 40. og:images are commonly 1200×630 hero renders with the headline baked in. We persist them as `defaultLogoUrl` with `confidence:"medium"` — and `flattenForProposed` pre-checks medium confidence. **Fix:** explicit rejection or downgrade `og` below `apple-touch-icon` when at least a favicon exists.

10. **Playwright worker path fragile** — `extractors/logos.ts:33-37` uses `path.resolve(process.cwd(), "scripts", "playwright-logo-worker.ts")`. If the api-server is started from a different cwd in prod, every Stripe/Anthropic/Vercel-style site falls through to the favicon/og branch above. **Fix:** resolve from `import.meta.url`.

### Microsite + mergeAuthored

11. **Pre-merge whitelist erasure drops AI personalization** — `generate-microsite.ts:592` `mergeWithDefaults` is a per-case `return { …whitelisted fields }`. For listed types (e.g. `hero` → 11 fields), every prop the case doesn't list is dropped before `mergeAuthored` runs. The merge then restores the authored value on top — so a personalized AI field that isn't whitelisted is silently erased, and the user sees the unpersonalized authored copy. Same shape as the regression that drove the original fix, in the opposite direction. **Fix:** strip the whitelist on the template path, OR reorder so `mergeAuthored` runs before `normalizeBlock`.

12. **mergeAuthored truncates arrays where AI is longer than authored** — `generate-microsite.ts:451` `base.map((item, i) => (i < ai.length ? ... : item))`. If template authored 3 placeholders and AI returned 6 well-personalized cards, items 4–6 are dropped. **Fix:** when both are arrays, walk `Math.max(base.length, ai.length)`.

13. **mergeAuthored lets AI flip booleans and override numbers** — `generate-microsite.ts:463`. Authored `true` for `showDetailsSection` flipped to `false` by a single AI hallucination. Authored `columns: 3` overridden by `0`. Both invisible. **Fix:** "scalar of MATCHING type wins, else keep authored."

14. **restoreTemplateImages slot list lags collectImageSlots** — `generate-microsite.ts:488` lists only 5 keys; `collectImageSlots` in `generate-page.ts:914` handles `bundleImageUrl`, `featuredArticle.imageUrl`, `tiles[].primary` (bento), `articles[].imageUrl`, `contributors[].avatarUrl`, `products[].imageUrl`, `slides[].src`, plus video slots. **Any of those that the template authored will not be restored** when the AI drops them. Same shape as the form/hero regression. **Fix:** have `restoreTemplateImages` consume `collectImageSlots` instead of its own list.

### Strict facts

15. **Edit doesn't promote to library** — `routes/lp/fact-flags.ts:142-169`. Writes the new text into the page but never inserts into `lp_proof_points`. The new spec contract is "Edit always promotes to approved." Today's UI must chain `/edit` then `/save-to-library`, which it probably doesn't. **Fix:** /edit inserts in same transaction.

16. **`matchesApproved` substring matching has false-negative bug** — `lib/factFlags/write.ts:42-43` iterates `statPool` with `v.includes(a) || a.includes(v)`. `"5%"` matches `"95%"` as a substring (because `"95%".includes("5%") === true`). Real flags silently suppressed. Same bug on `:51` for claims. **Fix:** word-boundary check, not substring.

17. **Strict-facts telemetry event names don't match the spec** — `lib/factFlags/telemetry.ts:7-18` ships `fact_flag_*`. Spec wants `strict_facts_review_opened`, `strict_facts_action`, `strict_facts_review_dismissed`, `strict_facts_publish_with_unapproved`. Launch dashboards keyed to the new names will be empty. **Fix:** add aliases or rename.

### Cross-cutting

18. **Critical generation routes are invisible to Sentry** — `generate-page.ts:3663-3679`, `brand-import.ts:395-447`, `brand-import-from-url*.ts`. All wrap handlers in `try { ... } catch (err) { res.status(500).json(...) }`. Because the handler responds itself, the error never propagates to `Sentry.setupExpressErrorHandler`. `grep -c "Sentry\." routes/lp/{generate-page,brand-import,brand-import-from-url,brand-import-from-url-stream,firecrawl}.ts` = 0 for all five. **Fix:** in each catch, `Sentry.captureException(err, { tags: { route: "generate-page" }, extra: { tenantId, promptPath } })` before responding. 15 minutes per route.

19. **Templates list ships full block JSONB for the count** — `routes/lp/templates.ts:42-50`. Query selects all columns including the massive `blocks` JSONB just to compute `blockCount: blocks.length`. For a tenant with the full global library this is megabytes per gallery load. **Fix:** project columns; compute count via `jsonb_array_length(blocks)`.

20. **No lp_pages.tenant_id index** — searched all migrations; doesn't exist. Every per-tenant page list seq-scans. Combined with #19 this is the documented templates-list slowness. **Fix:** `CREATE INDEX IF NOT EXISTS lp_pages_tenant_id_idx ON lp_pages (tenant_id);` plus `(tenant_id, is_template)` and `(tenant_id, status)` composites.

---

## S1 — High-impact pre-launch (ship if you have time)

### Generation brain

- **Critique pass burns paid calls on doomed truncated output.** `critique-pass.ts:223` sends whole-block props at 4096 max tokens; for `storefront` or `dso-case-study` blocks the input regularly exceeds budget, producing truncated JSON that `JSON.parse` rejects. Skip critique when input exceeds ~3k tokens.
- **Banned-phrase list contradicts copy-principles.** `copy-principles.ts:25` bans single words "Discover" / "Unlock" / "Unleash"; `banned-phrase-validator.ts:34` only bans them as multi-word phrases. Critique never targets the singles. Reconcile.
- **Temperature 0.9 + STRICT FACTS MODE is contradictory.** `generate-page.ts:4413, 3943`. Drop to 0.5 in strict mode.
- **Hero-legibility ordering bug.** `enforceHeroLegibility` clamps overlay to 45 but `applyDesignIntensityBackgrounds` doesn't convert a model-picked `full-bleed-hero` to dark style. Combined with `airy-minimal` forcing all backgrounds white, full-bleed heroes get white text on a white overlay. Tests miss this because they don't cover hero blocks (heroes don't expose `backgroundStyle`).
- **scanForUnapprovedStats locale-fragile.** `generate-page.ts:2207` won't match `"€1.2M"`, `"24 / 7"`, `"4.9★"`, or numbers inside `<strong>` HTML. Real stat leaks slip past.
- **8-second reference scrape grace.** `generate-page.ts:4715`. Under cold-start + big Firecrawl, p95 image-harvest exceeds 8s. User paid for a scrape they don't benefit from. Make configurable or push harvest fully async.
- **8k-token system prompt every freeform call** — `GENERAL_SYSTEM_PROMPT_TEMPLATE` at `generate-page.ts:2802-2914`. Send the full 30-block catalog regardless of which blocks the model needs. Token waste is substantial. Two-pass shortlist→render OR shrink schemas to role-matched blocks.

### URL ingestion

- **Streaming endpoint silent for first 30–50s.** `brand-import-from-url-stream.ts:135` opens NDJSON then awaits `runOrchestrator`. User sees nothing until `buildEvidence` completes. Emit interim `{ event: "scraping" }` before evidence build.
- **No per-tenant Firecrawl spend ceiling.** Single inspirationUrl import = 5–10 scrapes; 6 req/min × 10 = 60 scrapes/min/tenant. A malicious authed user can burn the entire Firecrawl quota mid-launch. Add a per-tenant-per-day cap (e.g. 100 scrapes/tenant/day).
- **Cache swallows DB errors silently.** `cache.ts:31, 46` and `firecrawl.ts:96` all `catch { return null; }` with no log. A misconfigured DB means every "cached" import goes fresh, invisibly. Add `logger.warn`.
- **No retry on Firecrawl 5xx/429.** `firecrawl.ts:78` treats 429, 502, and 404 identically. Add 1 retry on 429/5xx with 500ms jitter.

### Brand import

- **`flattenForProposed` silently boolean-coerces screenshot mirror failures.** `orchestrator.ts:554-568`. If screenshot mirror throws, import "succeeds" with no screenshot persisted; UI shows empty card. Surface `payload.errors`.
- **Cache row contains data-URL screenshot.** `orchestrator.ts:497-512` puts hundreds of KB of base64 into the cache JSON. For 1k cached brands that's a heavy table. Strip from cached copy, re-derive on read.
- **Voice corpus too small.** `extractors/voice.ts:175-205` builds corpus from `h1`+`h2`+ 2 paragraphs per page + 1 CTA — frequently 30–60 words total. Allow 4 paragraphs and pull "Why us" sections explicitly.
- **`extractContent` requires `populated >= 2`.** `extractors/content.ts:312-325`. If the LLM gives only `brandName`+`taglines`, partial threshold hits; if only `brandName`, the whole result is discarded — including `salesConsole`. Surface fields independently.
- **Buttons "looks_correct" vision override.** `extractors/buttons.ts:251-257` lets vision override category even when CSS parsing was confident. Gate vision override behind a confidence check.

### Microsite

- **No video / `backgroundVideoUrl` / `posterImage` restore.** `fillEmptyVideos` only fills `videoUrl`/`mediaUrl`; no `restoreTemplateVideos` at all. Authored `backgroundVideoUrl` on the template's hero dropped if AI returns empty.
- **Block reordering / type collision not guarded.** Positional zip (`generate-microsite.ts:2158`) assumes types align by position. If AI returns mixed types in different order, `hero` headline copy ends up in a `bottom-cta` slot. Add per-position type check.
- **Concurrency / idempotency.** Two reps generating the same `accountId` race; both succeed with `-2`/`-3` slugs. No idempotency key, no "already generating" lock.
- **`{accountName}`/`{contactFirstName}` tokens not resolved on general templates.** `substituteAccountVars` only handles `{{company_name}}`/`{{practice_count}}` and only for `business-case-*` blocks. Literal `{accountName}` in any other authored template ships verbatim.
- **Retry on AI failure missing.** A parse failure at `:1927` 500s with no retry. Timeout from OpenAI falls into outer catch — generic 500, full token spend wasted.

### Strict facts

- **Detection misses currency, big numbers, ratios, time-of-day.** `lib/factFlags/detect.ts:19-20`. `STAT_LIKE_RX` doesn't accept leading `$`, no `$2.4B`/`$1.2M ARR`, no `:` ratio (`3:1 ROI`), no `bps`, no `ms`, no `≤30%`. Currency is launch-grade miss for B2B copy.
- **Hand-rolled JSONPath silently fails on regen.** `lib/factFlags/path.ts:35-48`. `setAtPath` returns `false` if parent path or leaf key isn't exactly present. Block schemas evolve between regenerations (template merge, mergeAuthored); when a path no longer resolves, `applyResolutionToBlocks` silently drops the regen-memory replay. No log, no telemetry. Biggest "why did my edited stat come back" footgun.
- **Publish gate is single confirmation, not two.** `routes/lp/pages.ts:959` `bulkApproveFactFlags: true` short-circuits the gate. New spec wants two confirmations + `acknowledgeUnapprovedFacts` key. Easy alias.
- **`detectAndWriteFlagsForPage` is best-effort with `catch + warn`.** If detection silently fails, page publishes with zero flags — no banner, no gate. Add fallback flag (`flagsDetectionFailed: true`).
- **N+1 in syncFactFlags.** `write.ts:148-167` and `:171-182` one UPDATE/INSERT per detected fact. 50-stat page = 50 round trips. Bulk insert/update collapses to two.

### Cross-cutting

- **`.env.example` missing prod secrets.** Only documents DATABASE_URL, CSRF_SECRET, SENTRY_*. Missing OPENAI_API_KEY, FIRECRAWL_API_KEY, RESEND_API_KEY, STRIPE_*, CREDENTIAL_ENCRYPTION_KEY, WORKER_HOST_SECRET, TURNSTILE_*, APOLLO_*, PAGESPEED_*, SFDC_*, SLACK_* — 20+ secrets. Onboarding tax.
- **No tests for brand-import or brand-import-from-url routes.** Two of four headline launch flows have zero route-level tests. Tiny smoke integration would catch redeploy regressions.
- **Heatmap N+1.** `routes/lp/heatmap.ts:59, 67` `Promise.all(distinctPageIds.map(async ...))`. Collapse to single `IN (…)` query.

---

## Quick wins (~20–30 min each, ship these first)

1. **Wrap the four critical generation routes in `Sentry.captureException`** before responding 500. Closes the biggest observability gap.
2. **Add `lp_pages_tenant_id_idx`** migration. Single biggest perf win.
3. **Project columns in `routes/lp/templates.ts:42`** — drop `blocks`, add `jsonb_array_length(blocks) AS block_count`. MB→KB payload.
4. **Set `response_format: { type: "json_object" }`** on the two main generate calls. Match the critique-pass pattern.
5. **Add `isSafePublicHost` guard to `firecrawl.ts:parseReferenceUrl`.** Copy from `brand-import-from-url.ts:228`. Closes the SSRF hole.
6. **Fix mergeAuthored array length walk** — `Math.max(base.length, ai.length)`.
7. **Fix mergeAuthored scalar type guard** — `typeof ai === typeof base` before letting AI win.
8. **Fix matchesApproved word-boundary check** — current `includes` matches `"5%"` against `"95%"`.
9. **Append the 20 missing secrets to `.env.example`** as commented placeholders.
10. **Add Sentry telemetry alias** for the four `strict_facts_*` event names the new spec uses.

---

## What's already excellent — don't touch

- **mergeStringLeaves** in `critique-pass.ts:100` — structure-preserving, key + value-shape defense in depth.
- **Image pipeline** (sanitize → validate → fill curated → AI-fill → fill scraped → hero resolution guard) with `normalizeImageUrl` + `imageIdentity` handling srcset/cachebuster duplicates.
- **`isLogoImageUrl` + `collectImageSlots`** — single point of enforcement that protects every downstream image touchpoint from clearing the brand mark.
- **`enforceHeroResolution` carry-CTA-wiring** preserves modal/chilipiper props across type swap.
- **`payloadHasUsableResults`** — orchestrator explicitly refuses to cache all-failed runs.
- **Per-tenant asset mirror decoupled from cache** — each tenant gets their own `/api/storage` copy. Defends cross-tenant ACL leaks.
- **SSRF guard on every redirect hop** in `assets-uploader.ts:183-195`.
- **Robots parser allow-vs-disallow longest-match precedence** (`robots.ts:49-66`).
- **Per-extractor 150ms stagger** (`orchestrator.ts:40`) to avoid AI-proxy rate-limit storms.
- **Regen memory** in `lib/factFlags/write.ts:144-156` — re-applies prior edit/swap/remove decisions on regeneration using `normalized_form` as key.
- **Quote `factKind` plumbed end-to-end** — schema, detection, normalization, swap picker, library save, `fact_flag_quote_approve_confirmed` event. The new spec asked for this; it's already shipped.
- **Tenant scoping bulletproof on every fact-flags SQL** — `factFlags.integration.test.ts:206-210` even asserts the 403 fail-closed path.
- **Sentry init with PII scrubbing** in `lib/sentry.ts:82-117` — scrubs email/phone/address/name/IP/SSN/password while preserving `tenantId`/opaque `userId`.
- **Rate limiting tiered + per-tenant** with friendly error rather than 500 — applied to all 14 AI-generation routes.
- **Cloudflare worker** R2 prerender → R2 asset → origin → reload-shim cascade.
- **Sentry heartbeat** in `lib/sentryHeartbeat.ts` — silence in Sentry = "Sentry broken", not "no errors."
- **Welcome email atomic claim** — `UPDATE … WHERE welcome_email_sent_at IS NULL RETURNING` before fan-out. No double-welcomes on concurrent first logins.
- **DevTools panel gated on `user?.isAdmin`** not env — won't leak in prod regardless of NODE_ENV.

---

## Recommended Replit prompts to write next

Bundle the S0s into ~4 prompts so you can ship them in parallel branches:

1. **"Plug the silent-drop holes in mergeAuthored + restoreTemplateImages"** — items #11, #12, #13, #14. One file, one prompt.
2. **"Lock down firecrawl.ts: SSRF guard + robots + surface failures"** — items #5, #6, #7. One file, one prompt.
3. **"Stop the DSO fallback from shipping fabricated stats + tighten the classifier"** — items #1, #3, #4. One file, one prompt.
4. **"Pre-launch observability + perf hardening"** — items #18, #19, #20 + quick wins #1, #2, #3, #4. Touches 4–5 files but they're all tiny.
5. **(Already drafted in `replit-prompt-strict-facts-review-correct-flow.md`)** Add to that prompt: item #15 (Edit promotes to library), #16 (matchesApproved word-boundary), #17 (telemetry aliases).

Total work to clear the S0 list is probably 1 focused day for someone who knows the codebase, or 3–4 Replit-agent runs.
