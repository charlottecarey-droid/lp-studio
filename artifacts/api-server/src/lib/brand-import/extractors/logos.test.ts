import { describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";

import { extractLogos } from "./logos";
import type { Evidence } from "../types";

// extractLogos spawns an out-of-process Playwright worker whenever the top
// candidate isn't a header/footer/svg-alt logo. Stub the spawn: these tests
// only exercise the deterministic cheerio pass, and a real spawn would try
// to launch Chromium inside the test runner.
vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    spawn: vi.fn(() => {
      const child = new EventEmitter() as InstanceType<typeof EventEmitter> & {
        stdout: InstanceType<typeof EventEmitter>;
        stderr: InstanceType<typeof EventEmitter>;
        pid: number;
        kill: () => boolean;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.pid = 99999;
      child.kill = () => true;
      queueMicrotask(() => {
        child.stdout.emit(
          "data",
          Buffer.from(`${JSON.stringify({ ok: false, error: "stubbed in tests" })}\n`),
        );
        child.emit("close", 0);
      });
      return child;
    }),
  };
});

function evidenceFor(html: string, homeUrl = "https://example.com/"): Evidence {
  return {
    homeUrl,
    pages: [],
    stylesheets: [],
    $home: cheerio.load(html),
    robots: { allowed: {}, source: null, userAgent: "test" },
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: [],
    cssVarPaletteHints: [],
    darkCssVarHints: [],
    errors: [],
  };
}

describe("extractLogos og:image handling (s0-6 Bug 2)", () => {
  it("og-only candidate set returns the og image with LOW confidence", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <meta property="og:image" content="/share-card.png">
      </head><body><p>no header, no favicon</p></body></html>
    `));

    expect(["ok", "partial"]).toContain(result.status);
    expect(result.data?.defaultLogoUrl).toBe("https://example.com/share-card.png");
    // og must never be medium: flattenForProposed/the review UI pre-check
    // medium-confidence fields, which is how social cards became logos.
    expect(result.confidence).toBe("low");
  });

  it("og with wide social-card dimensions (1200x630) never wins default when another candidate exists", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <link rel="icon" href="/favicon.ico">
        <meta property="og:image" content="/og-banner.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
      </head><body></body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/favicon.ico");
    // The card is gated from the default but stays visible as an alternate.
    expect(result.data?.alternates.map((c) => c.url)).toContain("https://example.com/og-banner.png");
    expect(result.confidence).toBe("low");
  });

  it("og with wide social-card dimensions loses to a header logo", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <meta property="og:image" content="/og-banner.jpg">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
      </head><body>
        <header><img src="/brand/logo.svg" alt="Acme logo" width="180" height="48"></header>
      </body></html>
    `));

    expect(result.status).toBe("ok");
    expect(result.data?.defaultLogoUrl).toBe("https://example.com/brand/logo.svg");
    expect(result.confidence).toBe("high");
  });

  it("og-only WITH wide dimensions still falls back to og as default, but low confidence", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <meta property="og:image" content="/og-banner.png">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
      </head><body></body></html>
    `));

    // No other candidate to fall back to — keep the result usable rather
    // than failing the dimension, but the low confidence stops auto-accept.
    expect(result.data?.defaultLogoUrl).toBe("https://example.com/og-banner.png");
    expect(result.confidence).toBe("low");
  });

  it("square og images (non-card aspect) are not gated", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <meta property="og:image" content="/square-mark.png">
        <meta property="og:image:width" content="800">
        <meta property="og:image:height" content="800">
      </head><body></body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/square-mark.png");
    expect(result.confidence).toBe("low");
  });
});

describe("extractLogos customer-logo hijack (July 2026)", () => {
  it("excludes customer-wall logos inside social-proof containers entirely", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <header><a href="/"><img src="/assets/site-logo.png" alt="Example"></a></header>
        <section class="customers">
          <img src="/logos/globex.svg" alt="Globex logo" width="200" height="80">
          <img src="/logos/initech.svg" alt="Initech logo" width="200" height="80">
        </section>
      </body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/assets/site-logo.png");
    expect(result.confidence).toBe("high");
    const urls = result.data?.alternates.map((c) => c.url) ?? [];
    expect(urls).not.toContain("https://example.com/logos/globex.svg");
    expect(urls).not.toContain("https://example.com/logos/initech.svg");
  });

  it("a catch-all customer logo with declared dimensions no longer outranks a real header logo", async () => {
    // Pre-fix scores: globex (svg-alt 60 + svg 30 + area 40 = 130) beat the
    // header png without declared dimensions (100 + 20 = 120).
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <header><img src="/header/mark.png" alt="Example logo"></header>
        <div><img src="/logos/globex.svg" alt="Globex logo" width="400" height="160"></div>
      </body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/header/mark.png");
    expect(result.confidence).toBe("high");
  });

  it("a catch-all logo wrapped in a homepage link is vouched: wins with HIGH confidence", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <div class="masthead"><a href="/"><img src="/static/logo.svg" alt="logo"></a></div>
      </body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/static/logo.svg");
    expect(result.confidence).toBe("high");
  });

  it("a catch-all logo whose filename carries the domain token is vouched", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <div><img src="/img/acme-logo.svg" alt="logo"></div>
      </body></html>
    `, "https://acme.com/"));

    expect(result.data?.defaultLogoUrl).toBe("https://acme.com/img/acme-logo.svg");
    expect(result.confidence).toBe("high");
  });

  it("an unvouched catch-all default degrades to LOW confidence and flags the risk", async () => {
    // No header, no homepage link, no domain affinity — statistically this
    // shape is someone else's logo, so it must not pre-check in the review UI
    // (and the orchestrator must not feed it to the colors extractor).
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <div><img src="/media/some-logo.png" alt="Partner logo"></div>
      </body></html>
    `));

    expect(result.data?.defaultLogoUrl).toBe("https://example.com/media/some-logo.png");
    expect(result.confidence).toBe("low");
    expect(result.errors.join(" ")).toMatch(/brand-affinity/);
  });
});

describe("extractLogos existing behavior (regressions)", () => {
  it("footer logos keep MEDIUM confidence", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body>
        <footer><img src="/footer-logo.png" alt="Acme logo"></footer>
      </body></html>
    `));

    expect(result.status).toBe("ok");
    expect(result.data?.defaultLogoUrl).toBe("https://example.com/footer-logo.png");
    expect(result.confidence).toBe("medium");
  });

  it("favicon-only set stays partial/low and surfaces faviconUrl", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head>
        <link rel="icon" href="/favicon.ico">
      </head><body></body></html>
    `));

    expect(result.status).toBe("partial");
    expect(result.confidence).toBe("low");
    expect(result.data?.defaultLogoUrl).toBe("https://example.com/favicon.ico");
    expect(result.data?.faviconUrl).toBe("https://example.com/favicon.ico");
  });

  it("no candidates at all still fails cleanly", async () => {
    const result = await extractLogos(evidenceFor(`
      <html><head></head><body><p>nothing here</p></body></html>
    `));

    expect(result.status).toBe("failed");
    expect(result.data).toBeNull();
  });
});
