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

function evidenceFor(html: string): Evidence {
  return {
    homeUrl: "https://example.com/",
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
