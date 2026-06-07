import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import type OpenAI from "openai";

import { extractColors, isWeakColor, hexToRgb } from "./colors";
import type { Evidence } from "../types";

// ── Real-world brand-color import sweep ──────────────────────────────────
// These fixtures are REAL evidence (the `sampledPalette` + named
// `cssVarPaletteHints`) captured from live homepages via `buildEvidence`
// (see scripts/capture-brand-evidence.ts) and frozen as JSON. The unit test
// in colors.test.ts proves the extractor's individual guards against
// synthetic inputs; this sweep proves they hold against the messy real shape
// of production sites — design-system token ramps, photo-heavy washes,
// dark-theme screenshots, screenshot-blocked sites with no CSS vars, and
// plain-hex-only stylesheets.
//
// To re-capture after the extractor's evidence shape changes:
//   pnpm --filter @workspace/api-server exec tsx scripts/capture-brand-evidence.ts
// then re-select the fixtures and update the expectations below.

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

interface Fixture {
  slug: string;
  homeUrl: string;
  capturedAt: string;
  sampledPalette: string[];
  cssVarPaletteHints: { name: string; value: string }[];
}

function loadFixture(slug: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${slug}.json`), "utf8")) as Fixture;
}

function evidenceFromFixture(f: Fixture): Evidence {
  return {
    homeUrl: f.homeUrl,
    pages: [],
    stylesheets: [],
    $home: null,
    robots: { allowed: {}, source: null, userAgent: "test" },
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: f.sampledPalette,
    cssVarPaletteHints: f.cssVarPaletteHints,
    errors: [],
  };
}

/**
 * Stub OpenAI returning a fixed JSON payload. `"{}"` simulates the vision
 * model whiffing (exercises the deterministic fallback). The `washPrimary`
 * helper simulates the realistic failure mode the extractor must correct: the
 * model echoing the most-frequent pixel-sampled color (a hero/photo wash) as
 * primary.
 */
function mockOpenAI(respondWith: string): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: respondWith } }] }),
      },
    },
  } as unknown as OpenAI;
}

function washResponse(palette: string[]): string {
  return JSON.stringify({ slots: { primary: palette[0] ?? "#000000" } });
}

function hueOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return -1;
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return -1;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

interface Expectation {
  /** Site category this fixture stands in for. */
  category: string;
  /** Exact primary the extractor must land (regression lock). */
  expectedPrimary: string;
  /** Overall confidence the evidence should yield. */
  confidence: "high" | "medium" | "low";
  /**
   * When true, the fixture has a named brand CSS token, so the guard must
   * hold even when the LLM echoes the wash (palette[0]) as primary: the
   * declared brand token must win over the screenshot wash.
   */
  hasBrandToken: boolean;
  /** Optional acceptable hue band [min,max] in degrees for the primary. */
  hueBand?: [number, number];
  /** Human note explaining why this is the right answer for the site. */
  note: string;
}

const CASES: Record<string, Expectation> = {
  // Design-system site: 48 namespaced `--palette-*` tokens. The screenshot is
  // dominated by warm photography, so the pixel palette is ALL muddy
  // brown/grey tones — yet the brand's saturated red is declared in named
  // `*-core` tokens. The named token must beat the wash.
  airbnb: {
    category: "design-system / photo-heavy (named token beats wash)",
    expectedPrimary: "#E61E4D",
    confidence: "high",
    hasBrandToken: true,
    hueBand: [330, 360],
    note: "Palette is all product-photo brown; recovers Airbnb's red brand token, not a muddy brown.",
  },
  // Design-system dark-theme site: the screenshot palette is entirely
  // near-black navy, but the brand purple lives in named tokens. The extractor
  // must avoid the near-black wash and land a saturated purple. Note Linear's
  // canonical brand (#5E6AD2) is declared as `--color-brand-bg`, which the
  // extractor deliberately skips as a background token, so it recovers the
  // sibling link/accent purple (#828FFF) instead — still on-brand.
  linear: {
    category: "design-system / dark-theme (named token beats dark wash)",
    expectedPrimary: "#828FFF",
    confidence: "high",
    hasBrandToken: true,
    hueBand: [220, 270],
    note: "Palette is all near-black; recovers a purple link/accent token, not the dark wash.",
  },
  // Screenshot-blocked + plain-hex-CSS: no screenshot palette and no named
  // CSS vars, so evidence falls back to harvesting raw declared hex colors
  // from the stylesheets. Craigslist's only chromatic brand color is its link
  // blue.
  craigslist: {
    category: "plain-hex CSS / screenshot-blocked (harvested colors)",
    expectedPrimary: "#0000EE",
    confidence: "medium",
    hasBrandToken: false,
    hueBand: [220, 250],
    note: "No screenshot, no CSS vars; harvests the declared link-blue hex as the only brand color.",
  },
  // Photo-heavy retail with NO usable CSS vars: the palette is entirely
  // product-photo brown/beige and there is no brand token to recover, so the
  // extractor must degrade gracefully — pick the most saturated palette tone,
  // never fail, and report medium confidence.
  royaldesign: {
    category: "no usable CSS vars / photo-heavy (graceful palette fallback)",
    expectedPrimary: "#684828",
    confidence: "medium",
    hasBrandToken: false,
    note: "No brand token in evidence; best-effort saturated palette pick, must not hard-fail.",
  },
  // Minimal old-school site: no CSS vars, but the brand orange dominates the
  // screenshot palette. The extractor lands an orange-family primary.
  hackernews: {
    category: "no CSS vars / screenshot palette carries the brand",
    expectedPrimary: "#F8A868",
    confidence: "medium",
    hasBrandToken: false,
    hueBand: [15, 45],
    note: "No CSS vars; the brand orange leads the screenshot palette.",
  },
};

describe("brand-color import — real-world fixture sweep", () => {
  for (const [slug, exp] of Object.entries(CASES)) {
    describe(`${slug} (${exp.category})`, () => {
      const fixture = loadFixture(slug);

      it("recovers the expected primary when the LLM whiffs", async () => {
        const result = await extractColors(
          evidenceFromFixture(fixture),
          mockOpenAI("{}"),
        );

        expect(result.status).not.toBe("failed");
        expect(result.data).not.toBeNull();
        expect(result.data?.primary).toBe(exp.expectedPrimary);
        expect(result.confidence).toBe(exp.confidence);
        // Primary must never be a near-grey / brown-beige weak color.
        expect(isWeakColor(result.data?.primary ?? "#000000")).toBe(false);
        if (exp.hueBand) {
          const h = hueOf(result.data?.primary ?? "#000000");
          expect(h).toBeGreaterThanOrEqual(exp.hueBand[0]);
          expect(h).toBeLessThanOrEqual(exp.hueBand[1]);
        }
      });

      if (exp.hasBrandToken) {
        it("named brand token still beats a hero/photo wash echoed by the LLM", async () => {
          // The LLM echoes the most-frequent pixel color (the wash) as primary;
          // the declared brand token must override it.
          const result = await extractColors(
            evidenceFromFixture(fixture),
            mockOpenAI(washResponse(fixture.sampledPalette)),
          );

          expect(result.data?.primary).toBe(exp.expectedPrimary);
          expect(result.data?.primary).not.toBe(fixture.sampledPalette[0]);
          expect(isWeakColor(result.data?.primary ?? "#000000")).toBe(false);
        });
      } else {
        it("degrades gracefully with no named brand token", async () => {
          const result = await extractColors(
            evidenceFromFixture(fixture),
            mockOpenAI("{}"),
          );
          // No CSS vars → never "high"; must still produce a usable, non-weak
          // primary sourced from the sampled palette rather than failing.
          expect(result.status).not.toBe("failed");
          expect(result.confidence).toBe("medium");
          expect(fixture.sampledPalette).toContain(result.data?.primary);
        });
      }
    });
  }

  it("every fixture is real captured evidence with at least one color signal", () => {
    for (const slug of Object.keys(CASES)) {
      const f = loadFixture(slug);
      expect(f.homeUrl).toMatch(/^https?:\/\//);
      expect(f.sampledPalette.length + f.cssVarPaletteHints.length).toBeGreaterThan(0);
    }
  });
});
