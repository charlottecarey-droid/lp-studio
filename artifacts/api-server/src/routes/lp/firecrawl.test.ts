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
import { maybeMultiPageScrapeRef } from "./firecrawl";

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
