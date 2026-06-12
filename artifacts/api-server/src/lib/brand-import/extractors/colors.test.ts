import { describe, expect, it } from "vitest";
import type OpenAI from "openai";

import { extractColors, isNearGrey } from "./colors";
import type { Evidence } from "../types";

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    homeUrl: "https://example.com",
    pages: [],
    stylesheets: [],
    $home: null,
    robots: { allowed: {}, source: null, userAgent: "test" },
    screenshotUrl: null,
    screenshotDataUrl: null,
    sampledPalette: [],
    cssVarPaletteHints: [],
    errors: [],
    ...overrides,
  };
}

/**
 * Minimal OpenAI stand-in. `respondWith` is the JSON string the chat
 * completion returns (use "{}" to simulate the LLM whiffing so we exercise
 * the deterministic fallback path). Pass `throwOnCall: true` to assert the
 * extractor never reaches the network (used by the no-evidence test).
 */
function mockOpenAI(opts: { respondWith?: string; throwOnCall?: boolean } = {}): {
  client: OpenAI;
  calls: () => number;
} {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          calls += 1;
          if (opts.throwOnCall) throw new Error("LLM should not be called");
          return {
            choices: [{ message: { content: opts.respondWith ?? "{}" } }],
          };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls: () => calls };
}

describe("extractColors", () => {
  it("maps CSS-var hints to the matching slots", async () => {
    const { client } = mockOpenAI({ respondWith: "{}" });
    const evidence = makeEvidence({
      cssVarPaletteHints: [
        { name: "--color-primary", value: "#FF5733" },
        { name: "--color-accent", value: "#33C1FF" },
      ],
    });

    const result = await extractColors(evidence, client);

    expect(result.status).not.toBe("failed");
    expect(result.data).not.toBeNull();
    expect(result.data?.primary).toBe("#FF5733");
    expect(result.data?.accent).toBe("#33C1FF");
    // CSS vars present → high overall confidence
    expect(result.confidence).toBe("high");
    // The raw CSS vars are carried through for downstream UI
    expect(result.data?.rawCssVars).toHaveLength(2);
  });

  it("prefers valid LLM slot values over the CSS-var fallback", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({
        slots: { primary: "#10B981", accent: "#6366F1" },
      }),
    });
    const evidence = makeEvidence({
      cssVarPaletteHints: [{ name: "--color-primary", value: "#FF5733" }],
    });

    const result = await extractColors(evidence, client);

    expect(result.data?.primary).toBe("#10B981");
    expect(result.data?.accent).toBe("#6366F1");
  });

  it("returns a non-grey primary/accent from a pixel palette when the LLM whiffs", async () => {
    const { client } = mockOpenAI({ respondWith: "{}" });
    const evidence = makeEvidence({
      // lightest grey, one saturated red, one dark grey
      sampledPalette: ["#F5F5F5", "#E11D48", "#222222"],
    });

    const result = await extractColors(evidence, client);

    expect(result.status).not.toBe("failed");
    expect(result.data?.primary).toBe("#E11D48");
    expect(isNearGrey(result.data?.primary ?? "#000000")).toBe(false);
    expect(isNearGrey(result.data?.accent ?? "#000000")).toBe(false);
    // No CSS vars but a palette → medium overall confidence
    expect(result.confidence).toBe("medium");
  });

  it("refuses a near-grey LLM primary and substitutes a saturated palette color", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: "#808080" } }),
    });
    const evidence = makeEvidence({
      sampledPalette: ["#FFFFFF", "#2563EB", "#111111"],
    });

    const result = await extractColors(evidence, client);

    expect(isNearGrey(result.data?.primary ?? "#000000")).toBe(false);
    expect(result.data?.primary).toBe("#2563EB");
  });

  it("promotes a saturated CTA color to primary when the primary is achromatic", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({
        slots: { primary: "#111111", ctaBackground: "#F97316" },
      }),
    });
    // No saturated palette colors, so the near-grey post-filter leaves the
    // achromatic primary in place; the CTA-promotion rule must then kick in.
    const evidence = makeEvidence({
      sampledPalette: ["#111111", "#FAFAFA"],
    });

    const result = await extractColors(evidence, client);

    expect(result.data?.primary).toBe("#F97316");
    expect(result.data?.ctaBackground).toBe("#F97316");
  });

  it("skips brown/beige product-photo tones and decouples CTA from primary on photo-heavy sites", async () => {
    const { client } = mockOpenAI({ respondWith: "{}" });
    // Muddy product-photo brown (#988878) is the most frequent tone, but the
    // brand's real accent is the red-orange. Primary must not be the brown, and
    // the CTA background must not silently collapse onto primary.
    const evidence = makeEvidence({
      sampledPalette: ["#988878", "#FFFFFF", "#1A1A1A", "#E63946"],
    });

    const result = await extractColors(evidence, client);

    expect(result.status).not.toBe("failed");
    expect(result.data?.primary).not.toBe("#988878");
    expect(result.data?.ctaBackground).not.toBe(result.data?.primary);
  });

  it("does not let a large hero/gradient wash hijack primary when a named brand token exists", async () => {
    // Regression: a gradient/hero-driven site (e.g. Stripe). The pixel
    // sampler floats the big vivid orange hero wash to the FRONT of the
    // palette and the LLM dutifully echoes it as primary, but the site
    // declares its real brand color as a named --brand custom property
    // (Stripe's blurple). The named token must win the primary slot.
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: "#FF6201" } }),
    });
    const evidence = makeEvidence({
      // Orange hero wash leads the palette; navy + light surfaces follow.
      sampledPalette: ["#FF6201", "#0A2540", "#FFFFFF", "#F6F9FC"],
      cssVarPaletteHints: [
        // The vivid mid-scale brand shade should win over the pale tint and
        // the orange "accent" utility token (which is NOT a brand/primary
        // name, so it must never be picked as primary).
        { name: "--hds-color-core-brand-100", value: "#D6D9FC" },
        { name: "--hds-color-core-brand-600", value: "#533AFD" },
        { name: "--hds-color-util-accent-orange-350", value: "#FF6201" },
      ],
    });

    const result = await extractColors(evidence, client);

    expect(result.data?.primary).toBe("#533AFD");
    expect(result.data?.primary).not.toBe("#FF6201");
  });

  it("leaves a valid LLM primary untouched when there is no pixel palette to guard against", async () => {
    // Sibling guard to the wash test: with no sampled palette there is no
    // hero wash competing for the slot, so a confident LLM primary must NOT
    // be overridden by the brand-token fallback (pasted-text imports).
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: "#10B981" } }),
    });
    const evidence = makeEvidence({
      cssVarPaletteHints: [{ name: "--brand-primary", value: "#533AFD" }],
    });

    const result = await extractColors(evidence, client);

    expect(result.data?.primary).toBe("#10B981");
  });

  it("returns status 'failed' with no color evidence and never calls the LLM", async () => {
    const { client, calls } = mockOpenAI({ throwOnCall: true });
    const evidence = makeEvidence({ sampledPalette: [], cssVarPaletteHints: [] });

    const result = await extractColors(evidence, client);

    expect(result.status).toBe("failed");
    expect(result.data).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(calls()).toBe(0);
  });

  it("records an error and degrades to 'partial' when the LLM call throws", async () => {
    const { client } = mockOpenAI({ throwOnCall: true });
    const evidence = makeEvidence({
      cssVarPaletteHints: [{ name: "--brand", value: "#7C3AED" }],
    });

    const result = await extractColors(evidence, client);

    expect(result.status).toBe("partial");
    expect(result.data?.primary).toBe("#7C3AED");
    expect(result.errors.some((e) => e.includes("LLM call failed"))).toBe(true);
  });
});

// ── Logo dominant-color signal (Old Navy fix) ────────────────────────────────
// Promo-heavy homepages flood the pixel sampler with CAMPAIGN colors (a pink
// seasonal-sale wash) while the brand's actual mark is navy. The extracted
// logo's dominant color is threaded in as a hint: when the chosen primary
// clashes with the logo hue, the logo dominant wins `primary`, the sampled
// pick demotes to `accent`, and confidence drops so the review UI surfaces it.
describe("extractColors — logo dominant-color signal", () => {
  const NAVY_LOGO = "#003366"; // hue ~210 (Old Navy-like navy)
  const PROMO_PINK = "#F659A2"; // hue ~332 (sale-banner pink)

  it("Old-Navy-like: pink promo palette + navy logo → primary navy, pink demoted to accent", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    // Pink dominates the sampled palette (promo wash); no CSS vars.
    const evidence = makeEvidence({
      sampledPalette: [PROMO_PINK, "#FFFFFF", "#111111"],
    });

    const result = await extractColors(evidence, client, NAVY_LOGO);

    expect(result.data?.primary).toBe(NAVY_LOGO);
    expect(result.data?.accent).toBe(PROMO_PINK);
    // The override is surfaced for review: partial status + an explanatory error.
    expect(result.status).toBe("partial");
    expect(result.errors.some((e) => e.includes("logo"))).toBe(true);
  });

  it("accepts the hint as a promise (the orchestrator threads logos → colors async)", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    const evidence = makeEvidence({ sampledPalette: [PROMO_PINK, "#FFFFFF"] });

    const result = await extractColors(evidence, client, Promise.resolve(NAVY_LOGO));

    expect(result.data?.primary).toBe(NAVY_LOGO);
  });

  it("caps confidence at medium when the logo overrides a high-confidence (CSS-var) read", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    // CSS vars present (high evidence confidence) but none named brand/primary,
    // so the wash guard can't pin the primary — the logo override applies and
    // the result must surface as medium for human review.
    const evidence = makeEvidence({
      sampledPalette: [PROMO_PINK, "#FFFFFF"],
      cssVarPaletteHints: [{ name: "--color-border", value: "#E2E8F0" }],
    });

    const result = await extractColors(evidence, client, NAVY_LOGO);

    expect(result.data?.primary).toBe(NAVY_LOGO);
    expect(result.confidence).toBe("medium");
  });

  it("does NOT override a harmonizing primary (small hue distance)", async () => {
    const sky = "#0EA5E9"; // hue ~199, close to the navy logo's ~210
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: sky } }),
    });
    const evidence = makeEvidence({ sampledPalette: [sky, "#FFFFFF"] });

    const result = await extractColors(evidence, client, NAVY_LOGO);

    expect(result.data?.primary).toBe(sky);
    expect(result.confidence).toBe("medium"); // unchanged palette-only confidence
  });

  it("ignores a weak (near-grey) logo dominant — greys say nothing about brand hue", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    const evidence = makeEvidence({ sampledPalette: [PROMO_PINK, "#FFFFFF"] });

    const result = await extractColors(evidence, client, "#888888");

    expect(result.data?.primary).toBe(PROMO_PINK);
  });

  it("a primary pinned to a NAMED brand token outranks the logo dominant", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    const evidence = makeEvidence({
      sampledPalette: [PROMO_PINK, "#FFFFFF"],
      cssVarPaletteHints: [{ name: "--brand-primary", value: "#10B981" }],
    });

    const result = await extractColors(evidence, client, NAVY_LOGO);

    // The wash guard pins primary to the declared brand token; the logo
    // post-validation must leave a token-pinned primary alone.
    expect(result.data?.primary).toBe("#10B981");
  });

  it("rescues a weak primary with the logo dominant when no saturated palette color exists", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: "#111111" } }),
    });
    // Only neutrals sampled — the weak-color guards have nothing saturated to
    // substitute, so the logo dominant is the only usable brand signal.
    const evidence = makeEvidence({ sampledPalette: ["#111111", "#FAFAFA"] });

    const result = await extractColors(evidence, client, NAVY_LOGO);

    expect(result.data?.primary).toBe(NAVY_LOGO);
  });

  it("a hint promise that rejects degrades gracefully (no override, no throw)", async () => {
    const { client } = mockOpenAI({
      respondWith: JSON.stringify({ slots: { primary: PROMO_PINK } }),
    });
    const evidence = makeEvidence({ sampledPalette: [PROMO_PINK, "#FFFFFF"] });

    const result = await extractColors(evidence, client, Promise.reject(new Error("logo fetch failed")));

    expect(result.data?.primary).toBe(PROMO_PINK);
  });
});
