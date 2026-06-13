# Replit prompt — S0: lock down the reference-URL scraper

## What we're solving

The reference-URL scraper at `artifacts/api-server/src/routes/lp/firecrawl.ts` powers the URL-inspiration flow and the prompt-to-page reference scrape. It has three launch-blocker gaps that the other URL-ingest paths (`brand-import-from-url.ts`, `brand-import-from-url-stream.ts`) have already solved:

1. **No SSRF guard.** A user can paste `http://169.254.169.254/...`, `http://localhost:6379/`, or any internal hostname and we forward it to Firecrawl. Brand-import-from-url already validates this; the reference scraper does not.
2. **No robots.txt check.** The reference scraper fans out 5–10 requests per inspiration URL to `/about`, `/pricing`, `/customers`, `/product`, etc. with zero robots awareness. We'll get abuse complaints.
3. **Silent empty-corpus on scrape failure.** When Firecrawl 5xx's or the site is Cloudflare-protected, we return `{ scraped: null, failureReason: "firecrawl_failed" }` and generation proceeds. The user sees a generic AI page with no indication their URL was unreadable. Worst possible Product Hunt demo outcome.

## Reference: how the other paths already do this

- SSRF: `routes/lp/brand-import-from-url.ts:228` `isSafePublicHost(parsed.hostname)`; `routes/lp/brand-import-from-url-stream.ts:92` same.
- Robots: `lib/brand-import/evidence.ts:503-512` checks `robots.allowed[matchPath] !== false` using `lib/brand-import/robots.ts` (well-implemented allow/disallow longest-match parser).
- Manual redirect re-check (every hop is SSRF-validated): `lib/brand-import/evidence.ts:169-188` and `lib/brand-import/assets-uploader.ts:183-195`.

---

## Step 1 — Audit

Read end-to-end and put a 5-line summary in the PR:

- `artifacts/api-server/src/routes/lp/firecrawl.ts` (398 lines)
- `artifacts/api-server/src/routes/lp/firecrawl.test.ts`
- `artifacts/api-server/src/routes/lp/brand-import-from-url.ts` (the reference for SSRF guard pattern)
- `artifacts/api-server/src/lib/brand-import/evidence.ts:169-188, 503-512` (redirect re-check + robots check pattern)
- `artifacts/api-server/src/lib/brand-import/robots.ts`
- `artifacts/api-server/src/routes/lp/generate-page.ts:3671-3687` (consumer site — see how `failureReason` is currently dropped on the floor)

---

## Step 2 — Add SSRF guard to `parseReferenceUrl` (firecrawl.ts:187-225)

`parseReferenceUrl` currently only validates the scheme. Add:

```ts
import { isSafePublicHost } from "../../lib/...";  // reuse the existing helper

function parseReferenceUrl(input: string): { url: URL; reason?: string } {
  // ... existing scheme check ...
  const safe = isSafePublicHost(parsed.hostname);
  if (!safe) {
    return { url: parsed, reason: "private_or_unsafe_host" };
  }
  return { url: parsed };
}
```

Find the canonical `isSafePublicHost` (search for `export.*isSafePublicHost` in `lib/` and `routes/`). Reuse — don't re-implement.

If `isSafePublicHost` lives only in a file that's awkward to import from `routes/lp/firecrawl.ts`, move it to `lib/safe-url.ts` (or wherever the canonical safety helpers live) and update both callers in `brand-import-from-url.ts` and `brand-import-from-url-stream.ts` to import from the new location. Don't duplicate the function.

### Tests

Add to `firecrawl.test.ts`:
- `http://169.254.169.254/latest/meta-data/` → rejected with `private_or_unsafe_host`
- `http://localhost:6379/` → rejected
- `http://10.0.0.1/` → rejected
- `http://127.0.0.1:3000/` → rejected
- `file:///etc/passwd` → rejected (existing scheme check)
- `https://example.com/` → accepted

---

## Step 3 — Add robots.txt check before scraping

Wrap the actual Firecrawl call (and the multi-page fan-out in `maybeMultiPageScrapeRef:244-273`) in a robots check.

```ts
import { fetchRobotsVerdict } from "../../lib/brand-import/robots";

async function scrapeWithRobots(url: URL, tenantId: string, ws: boolean) {
  const robots = await fetchRobotsVerdict(url.origin);  // cached upstream
  const allowed = robots.allowed[url.pathname] !== false;
  if (!allowed) {
    return { scraped: null, failureReason: "robots_disallowed", url: url.toString() };
  }
  return doFirecrawlScrape(url, tenantId, ws);
}
```

For `maybeMultiPageScrapeRef`, fetch robots ONCE per origin and filter the candidate path list (`/about`, `/pricing`, `/customers`, `/product`, `/platform`, `/services`, `/gallery`, `/team`, `/our-team`, `/portfolio`) by what's allowed before fanning out.

Don't fail-open on robots fetch errors — if the robots fetch itself fails (timeout, 5xx), be conservative: log the warning and SKIP the path. The brand-import paths already do this; mirror the pattern.

### Tests

- Site allows `/` and `/about` but disallows `/pricing` → scrape returns the two allowed pages, marks `/pricing` skipped
- Site disallows `/` entirely → top-level scrape returns `{ scraped: null, failureReason: "robots_disallowed" }`
- Site has no robots.txt (404) → all paths allowed (default behaviour)
- Robots fetch times out → all paths skipped with warning (fail-safe)

---

## Step 4 — Surface failureReason to the user

Today `firecrawl.ts:96` swallows errors with `catch { return null; }` and the consumer at `generate-page.ts:3671-3687` resolves to `{ scraped: null, failureReason }` and proceeds with empty corpus silently.

### 4a. Add structured logging to all swallowed catches

Find every `catch { return null; }` in `firecrawl.ts` (at minimum lines 78, 96; also `cache.ts:31, 46` if you have time but those are S1). Add:

```ts
} catch (err) {
  logger.warn({ err, url: url.toString(), tenantId }, "firecrawl_scrape_failed");
  return { scraped: null, failureReason: classifyError(err) };
}
```

Where `classifyError` returns one of `"timeout" | "network" | "firecrawl_5xx" | "firecrawl_429" | "blocked_by_site" | "unknown"`. This lets ops debug.

### 4b. Surface the failureReason to generate-page consumers

In `generate-page.ts:3671-3687` (and wherever else `failureReason` lands), wire it through to the response payload. The user-facing error model:

When the user pasted a URL AND scrape failed, the generate-page response includes a top-level warning:

```ts
{
  page: { ... },
  warnings: [
    {
      kind: "url_scrape_failed",
      url: "https://example.com",
      reason: "blocked_by_site",
      userMessage: "We couldn't read example.com (the site blocked our scraper). The page was generated from your brief alone, without URL grounding."
    }
  ]
}
```

The frontend renders this warning as a yellow banner above the generated page so the user knows the URL did nothing for them.

For one retry: when `failureReason === "firecrawl_5xx"` or `"firecrawl_429"`, do ONE retry with 500ms jitter before returning the failure.

### 4c. Add 1 retry on 429/5xx

In the Firecrawl call site (`firecrawl.ts:78`):

```ts
async function callFirecrawlWithRetry(url: URL, opts: ScrapeOpts) {
  const first = await callFirecrawl(url, opts);
  if (first.ok) return first;
  if (first.status === 429 || first.status >= 500) {
    await sleep(400 + Math.random() * 200);  // 400-600ms jitter
    return callFirecrawl(url, opts);
  }
  return first;
}
```

Don't add more than one retry — Firecrawl already has internal retries and we don't want to amplify their rate limits.

### Tests

- Scrape that returns 200 → `{ scraped: ..., failureReason: undefined }`
- Scrape that returns 429 once then 200 → succeeds on retry
- Scrape that returns 429 twice → returns `{ scraped: null, failureReason: "firecrawl_429" }`
- Scrape that times out → returns `{ scraped: null, failureReason: "timeout" }`, log emitted
- Generate-page consumer wraps the failure in `warnings: [{ kind: "url_scrape_failed", ... }]`

---

## Step 5 — Quick frontend wire-up (optional but recommended for launch)

In the builder, after generation, render any `warnings` from the response payload as a dismissible yellow banner above the page preview. Use the existing toast/banner system; don't build a new component.

If a frontend change is too much for this PR, at minimum log the warnings on the client console so beta users surface them in screenshots.

---

## Acceptance criteria

- [ ] `parseReferenceUrl` rejects private/internal IPs, localhost, link-local, and metadata endpoints
- [ ] Robots.txt is fetched once per origin and consulted before EVERY scrape (single-page + fan-out)
- [ ] Robots-disallowed paths return `{ scraped: null, failureReason: "robots_disallowed" }` and skip silently in fan-out
- [ ] All `catch` blocks that swallow scrape errors now log a structured warning with `tenantId` + `url`
- [ ] Failure reason is classified into one of the known categories
- [ ] 1 retry on Firecrawl 429/5xx with 400–600ms jitter
- [ ] `generate-page.ts` consumer surfaces scrape failures in the response payload as `warnings: [{ kind: "url_scrape_failed", ... }]`
- [ ] New tests cover all SSRF rejection cases
- [ ] New tests cover robots allow/disallow per-path
- [ ] New tests cover 429-then-200 retry success
- [ ] Existing `firecrawl.test.ts` still passes
- [ ] `pnpm typecheck` clean

## Don't

- Don't re-implement `isSafePublicHost`. Find the existing helper. If you need to move it, move it once and update all callers.
- Don't fail-open on robots fetch errors. Log + skip path. Brand-import already does this; mirror.
- Don't add more than one retry. Firecrawl has internal retries.
- Don't ship without surfacing the failure to the user. Silent empty-corpus is the launch-day demo killer this PR exists to fix.
- Don't introduce a new robots parser. Use `lib/brand-import/robots.ts`.
- Don't change the response shape of `generate-page.ts` beyond adding the optional `warnings` array. Existing callers must keep working.
