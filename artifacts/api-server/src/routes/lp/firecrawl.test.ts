/**
 * Unit tests for the multi-page reference scrape image-harvest behaviour
 * (task #1149).
 *
 * Contract under test:
 *   1. When the marketing-companion pass is image-poor (< IMAGE_HARVEST_THRESHOLD
 *      distinct images), an IMAGE-ONLY pass over SMB/service paths
 *      (/services, /gallery, /team, /our-team, /portfolio) runs and adds the
 *      photos those pages expose — so image-poor brands harvest more imagery.
 *   2. That image-only pass NEVER contributes markdown to the combined voice
 *      corpus, and NEVER adds those paths to `additionalUrls`.
 *   3. When the first pass is already image-rich, the image-companion paths are
 *      not fetched at all — image-rich brands pay no extra Firecrawl spend.
 *
 * `fetch` is stubbed to return Firecrawl-shaped responses keyed by the scraped
 * URL, so no network or API key is required.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The reference scraper now SSRF-guards user-supplied hosts via a real DNS
// lookup (isSafePublicHost); the fake `.example` hosts used here don't
// resolve, so treat every host as public in these unit tests.
vi.mock("../../lib/brand-import/net-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/brand-import/net-guard")>()),
  isSafePublicHost: async () => true,
}));

import {
  clearInspirationScrapeCache,
  firecrawlScrape,
  isTenantScrapeBudgetExhausted,
  maybeMultiPageScrapeRef,
  maybeScrapeRef,
  resetScrapeBudget,
  scrapeInspirationUrl,
} from "./firecrawl";

const ROOT = "https://smbclinic.example";

/** A large content image survives the photography extractor's size/chrome
 *  filters; nest it outside header/nav/footer with no tiny dimensions. */
function htmlWithImage(id: string): string {
  return `<html><body><main><img src="${ROOT}/img/${id}.jpg" width="800" height="600"></main></body></html>`;
}

function firecrawlResponse(markdown: string, html: string) {
  return {
    ok: true,
    json: async () => ({ data: { markdown, html, screenshot: undefined } }),
  } as unknown as Response;
}

/** Build a fetch stub: each path returns markdown + one unique image; any path
 *  not listed 404s (typical of SMB sites where marketing paths don't exist). */
function makeFetchStub(pages: Record<string, { md: string; imgId: string }>) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as { url?: string };
    const target = body.url ?? "";
    const path = new URL(target).pathname.replace(/\/+$/, "") || "/";
    const page = pages[path];
    if (!page) return { ok: false, json: async () => ({}) } as unknown as Response;
    return firecrawlResponse(page.md, htmlWithImage(page.imgId));
  });
}

describe("maybeMultiPageScrapeRef image-companion harvest", () => {
  const realFetch = globalThis.fetch;
  const hadKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (hadKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = hadKey;
    vi.restoreAllMocks();
  });

  it("harvests SMB image pages (image-only) when the marketing pass is image-poor", async () => {
    // Only the homepage and image-rich SMB paths exist; marketing companions 404.
    const fetchStub = makeFetchStub({
      "/": { md: "Welcome to our clinic", imgId: "home" },
      "/services": { md: "SERVICE LIST BOILERPLATE", imgId: "service" },
      "/gallery": { md: "PHOTO CAPTIONS", imgId: "gallery" },
      "/team": { md: "MEET THE TEAM", imgId: "team" },
      "/our-team": { md: "MEET THE TEAM ALT", imgId: "ourteam" },
      "/portfolio": { md: "PORTFOLIO", imgId: "portfolio" },
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    // Use a unique tenant id each test so the module-scoped scrape cache
    // (keyed by tenant+url) never serves a value from a sibling test.
    const res = await maybeMultiPageScrapeRef(ROOT, 91149001);
    const scraped = res.scraped;
    expect(scraped).not.toBeNull();

    // Images from the SMB pages were harvested in addition to the homepage.
    const imgs = scraped!.imageUrls ?? [];
    expect(imgs).toContain(`${ROOT}/img/service.jpg`);
    expect(imgs).toContain(`${ROOT}/img/gallery.jpg`);
    expect(imgs).toContain(`${ROOT}/img/team.jpg`);
    expect(imgs).toContain(`${ROOT}/img/home.jpg`);

    // …but their low-signal markdown stayed OUT of the voice corpus, and they
    // never entered additionalUrls.
    expect(scraped!.markdown).not.toContain("SERVICE LIST BOILERPLATE");
    expect(scraped!.markdown).not.toContain("MEET THE TEAM");
    expect(scraped!.markdown).not.toContain("PORTFOLIO");
    expect(scraped!.markdown).toContain("Welcome to our clinic");
    const extraUrls = scraped!.additionalUrls ?? [];
    for (const u of extraUrls) {
      expect(u).not.toMatch(/\/(services|gallery|team|our-team|portfolio)$/);
    }
  });

  it("does NOT fetch image-companion paths when the marketing pass is image-rich", async () => {
    // Homepage + all marketing companions exist and each yields an image, so
    // the first pass clears the threshold (6 distinct images: home + 5).
    const fetchStub = makeFetchStub({
      "/": { md: "Homepage copy", imgId: "home" },
      "/about": { md: "About copy", imgId: "about" },
      "/pricing": { md: "Pricing copy", imgId: "pricing" },
      "/customers": { md: "Customers copy", imgId: "customers" },
      "/product": { md: "Product copy", imgId: "product" },
      "/platform": { md: "Platform copy", imgId: "platform" },
      // These exist too, but must never be fetched.
      "/services": { md: "SHOULD NOT FETCH", imgId: "service" },
      "/gallery": { md: "SHOULD NOT FETCH", imgId: "gallery" },
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const res = await maybeMultiPageScrapeRef(ROOT, 91149002);
    const imgs = res.scraped?.imageUrls ?? [];
    expect(imgs).not.toContain(`${ROOT}/img/service.jpg`);
    expect(imgs).not.toContain(`${ROOT}/img/gallery.jpg`);

    // Assert the image-companion paths were never requested.
    const requested = fetchStub.mock.calls.map((c) => {
      const init = c[1] as RequestInit | undefined;
      return (JSON.parse((init?.body as string) ?? "{}") as { url?: string }).url ?? "";
    });
    for (const u of requested) {
      expect(u).not.toMatch(/\/(services|gallery|team|our-team|portfolio)$/);
    }
  });
});

// ── Inspiration-URL cached scrape-only path (June 2026) ─────────────────────
// Contract under test:
//   1. CACHED — a second call for the same (tenant, URL) is served from the
//      inspiration TTL cache: no second Firecrawl fetch, and the result is
//      labelled fromCache:true so the generate-page response can surface it.
//   2. SCRAPE-ONLY — a single page fetch (no companion fan-out), no screenshot
//      format requested, and the page's harvested image URLs are dropped (the
//      result type carries none) so inspiration scrapes can never feed
//      mirrorReferenceImages / lp_media.
//   3. BEST-EFFORT — invalid URL / missing API key return null, never throw.
describe("scrapeInspirationUrl — cached scrape-only inspiration path", () => {
  const realFetch = globalThis.fetch;
  const hadKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    clearInspirationScrapeCache();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (hadKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = hadKey;
    vi.restoreAllMocks();
  });

  it("cache hit: the second call does NOT issue a second Firecrawl fetch and is labelled fromCache", async () => {
    const fetchStub = makeFetchStub({ "/": { md: "Inspo homepage copy", imgId: "inspo" } });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    // Unique tenant id so the module-scoped caches never collide across tests.
    const first = await scrapeInspirationUrl(ROOT, 92026001);
    expect(first).not.toBeNull();
    expect(first!.fromCache).toBe(false);
    expect(first!.markdown).toContain("Inspo homepage copy");
    expect(fetchStub).toHaveBeenCalledTimes(1);

    const second = await scrapeInspirationUrl(ROOT, 92026001);
    expect(second).not.toBeNull();
    expect(second!.fromCache).toBe(true);
    expect(second!.markdown).toBe(first!.markdown);
    // The whole point: no second Firecrawl call.
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("scrape-only: single page, no screenshot format, harvested image URLs dropped", async () => {
    const fetchStub = makeFetchStub({
      "/": { md: "Homepage", imgId: "home" },
      // Exists, but inspiration scrapes must never fan out to companions.
      "/about": { md: "About", imgId: "about" },
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const res = await scrapeInspirationUrl(ROOT, 92026002);
    expect(res).not.toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      ((fetchStub.mock.calls[0] as unknown[])[1] as RequestInit).body as string,
    ) as { url?: string; formats?: string[] };
    expect(body.url).toBe(`${ROOT}/`);
    expect(body.formats).toEqual(["markdown", "html"]); // no screenshot variant
    // The result is markdown-only: image URLs harvested from the page HTML are
    // intentionally discarded (mirroring stays per-request-only).
    expect((res as unknown as Record<string, unknown>).imageUrls).toBeUndefined();
  });

  it("best-effort: invalid URL and missing API key return null", async () => {
    const fetchStub = makeFetchStub({ "/": { md: "Homepage", imgId: "home" } });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    expect(await scrapeInspirationUrl("not a url::", 92026003)).toBeNull();
    delete process.env.FIRECRAWL_API_KEY;
    expect(await scrapeInspirationUrl(ROOT, 92026003)).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

// ── Transient-failure retry (June 2026 launch hardening) ────────────────────
// Contract under test (firecrawlScrape, the single choke point every scrape
// path flows through):
//   1. A transient 429 is retried (honoring Retry-After) and the subsequent
//      success is returned — "import failed" blips self-heal.
//   2. A deterministic 4xx (404/400) is NEVER retried — one call, then null.
//   3. A persistent 5xx is retried up to the cap then gives up with null,
//      so a down upstream can't hang the request past its budget.
function firecrawlErrorResponse(status: number, headers?: Record<string, string>) {
  return {
    ok: false,
    status,
    headers: new Headers(headers ?? {}),
    json: async () => ({}),
  } as unknown as Response;
}

describe("firecrawlScrape — transient-failure retry", () => {
  const realFetch = globalThis.fetch;
  const hadKey = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = realFetch;
    if (hadKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = hadKey;
    vi.restoreAllMocks();
  });

  it("retries a 429 (honoring Retry-After) then returns the successful scrape", async () => {
    let calls = 0;
    const fetchStub = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return firecrawlErrorResponse(429, { "retry-after": "1" });
      return firecrawlResponse("Homepage copy", htmlWithImage("home"));
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const p = firecrawlScrape("test-key", `${ROOT}/`);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res).not.toBeNull();
    expect(res!.markdown).toContain("Homepage copy");
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a deterministic 4xx (404) — one call, then null", async () => {
    const fetchStub = vi.fn(async () => firecrawlErrorResponse(404));
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const p = firecrawlScrape("test-key", `${ROOT}/`);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res).toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("retries a persistent 500 up to the cap (3 attempts total) then gives up with null", async () => {
    const fetchStub = vi.fn(async () => firecrawlErrorResponse(500));
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    const p = firecrawlScrape("test-key", `${ROOT}/`);
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res).toBeNull();
    // 1 initial attempt + FIRECRAWL_MAX_RETRIES (2).
    expect(fetchStub).toHaveBeenCalledTimes(3);
  });
});

// ── Per-tenant daily scrape cap (June 2026 launch hardening) ────────────────
// Contract under test:
//   1. REAL (cache-miss) scrapes consume the tenant's daily budget; cache hits
//      are free and never counted.
//   2. Once the budget is spent, further real scrapes short-circuit to a clean
//      "rate_limited" failureReason WITHOUT issuing a network call.
//   3. The budget is scoped per tenant.
// The cap is read live from FIRECRAWL_TENANT_DAILY_CAP, so these tests just set
// a low cap in the env and reset the in-memory budget between cases.
describe("per-tenant daily scrape cap", () => {
  const realFetch = globalThis.fetch;
  const hadKey = process.env.FIRECRAWL_API_KEY;
  const hadCap = process.env.FIRECRAWL_TENANT_DAILY_CAP;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    process.env.FIRECRAWL_TENANT_DAILY_CAP = "2";
    resetScrapeBudget();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (hadKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = hadKey;
    if (hadCap === undefined) delete process.env.FIRECRAWL_TENANT_DAILY_CAP;
    else process.env.FIRECRAWL_TENANT_DAILY_CAP = hadCap;
    resetScrapeBudget();
    vi.restoreAllMocks();
  });

  it("caps real scrapes, keeps cache hits free, and surfaces rate_limited over budget", async () => {
    const fetchStub = makeFetchStub({
      "/": { md: "Home copy", imgId: "home" },
      "/pricing": { md: "Pricing copy", imgId: "pricing" },
      "/about": { md: "About copy", imgId: "about" },
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;
    const T = 93030001;

    // 1st real scrape → consumes 1 of 2 units.
    const a1 = await maybeScrapeRef(`${ROOT}/`, T);
    expect(a1.scraped).not.toBeNull();
    // Same URL again → served from cache; must NOT consume budget or re-fetch.
    const a2 = await maybeScrapeRef(`${ROOT}/`, T);
    expect(a2.scraped).not.toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(1);

    // 2nd distinct real scrape → consumes the last unit.
    const b = await maybeScrapeRef(`${ROOT}/pricing`, T);
    expect(b.scraped).not.toBeNull();
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(isTenantScrapeBudgetExhausted(T)).toBe(true);

    // 3rd distinct real scrape → over budget → rate_limited, no network call.
    const c = await maybeScrapeRef(`${ROOT}/about`, T);
    expect(c.scraped).toBeNull();
    expect(c.failureReason).toBe("rate_limited");
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("scopes the budget per tenant", async () => {
    const fetchStub = makeFetchStub({
      "/": { md: "Home", imgId: "home" },
      "/pricing": { md: "Pricing", imgId: "pricing" },
    });
    globalThis.fetch = fetchStub as unknown as typeof fetch;

    // Exhaust tenant A's 2-unit budget.
    await maybeScrapeRef(`${ROOT}/`, 93030010);
    await maybeScrapeRef(`${ROOT}/pricing`, 93030010);
    expect(isTenantScrapeBudgetExhausted(93030010)).toBe(true);
    // A different tenant is unaffected.
    expect(isTenantScrapeBudgetExhausted(93030011)).toBe(false);
  });
});
