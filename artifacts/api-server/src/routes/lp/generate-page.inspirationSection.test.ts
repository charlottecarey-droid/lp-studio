/**
 * Unit tests for the BRAND INSPIRATION SITES prompt section (June 2026).
 *
 * Inspiration-derived references are STYLE/STRUCTURE references only:
 *   • each site is labelled so the model mirrors look/structure/density but
 *     never lifts the site's specific claims;
 *   • when a per-request REFERENCE PAGE also exists, it wins the detailed
 *     treatment and inspiration content is capped hard;
 *   • at most INSPIRATION_REFERENCE_MAX_SITES sites are included.
 *
 * The strict-facts trust gate (urlSourcedFacts) is per-request-only by
 * construction — inspiration scrapes never enter `scrapedUrls` — and the
 * route-level guarantee is covered by generate-page.scrape-gating.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  buildInspirationSection,
  INSPIRATION_REFERENCE_LABEL,
  INSPIRATION_REFERENCE_MAX_SITES,
  MAX_SCRAPE_URLS,
  selectInspirationScrapeUrls,
} from "./generate-page";

const SITE_A = { url: "https://inspo-a.example.com/", markdown: "# Alpha\nBold, dense, proof-heavy sections." };
const SITE_B = { url: "https://inspo-b.example.com/", markdown: "# Beta\nAiry editorial layout." };
const SITE_C = { url: "https://inspo-c.example.com/", markdown: "# Gamma\nThird site that must be dropped." };

describe("buildInspirationSection", () => {
  it("returns empty string when there are no usable inspiration refs", () => {
    expect(buildInspirationSection([], { hasPerRequestReference: false })).toBe("");
    expect(
      buildInspirationSection([{ url: "https://x.example.com/", markdown: "   " }], { hasPerRequestReference: false }),
    ).toBe("");
  });

  it("labels every site as a style/structure reference (never a claims source)", () => {
    const out = buildInspirationSection([SITE_A, SITE_B], { hasPerRequestReference: false });
    expect(out).toContain("BRAND INSPIRATION SITES — STYLE & STRUCTURE REFERENCES ONLY");
    expect(out).toContain(`### ${SITE_A.url} ${INSPIRATION_REFERENCE_LABEL}`);
    expect(out).toContain(`### ${SITE_B.url} ${INSPIRATION_REFERENCE_LABEL}`);
    expect(out).toContain("Do NOT copy their specific claims");
    expect(out).toContain(SITE_A.markdown);
    expect(out).toContain(SITE_B.markdown);
  });

  it(`caps the section at ${INSPIRATION_REFERENCE_MAX_SITES} inspiration sites`, () => {
    const out = buildInspirationSection([SITE_A, SITE_B, SITE_C], { hasPerRequestReference: false });
    expect(out).toContain(SITE_A.url);
    expect(out).toContain(SITE_B.url);
    expect(out).not.toContain(SITE_C.url);
  });

  it("when a per-request reference exists, declares the REFERENCE PAGE the winner and caps markdown harder", () => {
    const longMarkdown = "x".repeat(10_000);
    const out = buildInspirationSection(
      [{ url: SITE_A.url, markdown: longMarkdown }],
      { hasPerRequestReference: true },
    );
    expect(out).toContain("the REFERENCE PAGE wins");
    // Per-site markdown is capped at the tighter with-reference budget (2.5k),
    // well below the full 10k input.
    expect(out.length).toBeLessThan(4_000);
  });

  it("without a per-request reference, does not point at a (nonexistent) REFERENCE PAGE", () => {
    const out = buildInspirationSection([SITE_A], { hasPerRequestReference: false });
    expect(out).not.toContain("REFERENCE PAGE");
  });
});

// ── Scrape-set selection: per-request first, inspiration fills the headroom ──
// Total Firecrawl reference fan-out is capped at MAX_SCRAPE_URLS (5):
// per-request URLs always count toward the cap first, inspiration URLs only
// use whatever headroom remains (and never more than
// INSPIRATION_REFERENCE_MAX_SITES). URLs in both lists dedupe INTO the
// per-request set, which is the only set that mirrors images / confers
// strict-facts trust.
describe("selectInspirationScrapeUrls", () => {
  const INSPO = [
    "https://inspo-a.example.com/",
    "https://inspo-b.example.com/",
    "https://inspo-c.example.com/",
  ];
  const perRequest = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `https://ref-${i + 1}.example.com/`);

  it("with no per-request URLs, takes up to INSPIRATION_REFERENCE_MAX_SITES inspiration sites", () => {
    expect(selectInspirationScrapeUrls([], INSPO)).toEqual(
      INSPO.slice(0, INSPIRATION_REFERENCE_MAX_SITES),
    );
  });

  it("per-request URLs consume the cap first: 4 per-request leaves room for exactly 1 inspiration site", () => {
    expect(selectInspirationScrapeUrls(perRequest(MAX_SCRAPE_URLS - 1), INSPO)).toEqual([INSPO[0]]);
  });

  it(`a full per-request set (${MAX_SCRAPE_URLS}) leaves NO room for inspiration`, () => {
    expect(selectInspirationScrapeUrls(perRequest(MAX_SCRAPE_URLS), INSPO)).toEqual([]);
  });

  it("dedupes an inspiration URL already in the per-request set (normalized: scheme/trailing-slash insensitive)", () => {
    // The user pasted the bare host this run; the brand's persisted entry is
    // the canonical https URL — they must be recognised as the SAME site, and
    // the per-request copy wins (full treatment + trust).
    const out = selectInspirationScrapeUrls(["inspo-a.example.com"], INSPO);
    expect(out).not.toContain(INSPO[0]);
    expect(out).toEqual([INSPO[1], INSPO[2]].slice(0, INSPIRATION_REFERENCE_MAX_SITES));
  });
});
