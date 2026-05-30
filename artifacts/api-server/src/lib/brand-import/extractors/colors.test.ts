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
