/**
 * Measured-CSS → BrandConfig-token mapping (brand-fidelity, July 2026).
 *
 * The extractors have always MEASURED button padding and card surface CSS,
 * but the measurements only reached the read-only "we observed" panels
 * (buttonStyleRaw / surfaceStyle) — the coarse tokens the renderer actually
 * consumes (buttonPaddingX/Y, cardRadius, cardShadow) stayed at defaults
 * until hand-tuned. These tests pin the bucket thresholds and the
 * flattenForProposed wiring that now proposes those tokens at import time.
 * Hermetic: flattenForProposed is a pure mapping over the results payload.
 */
import { describe, it, expect } from "vitest";
import {
  cssLengthToPx,
  bucketButtonPaddingX,
  bucketButtonPaddingY,
  bucketCardRadius,
  bucketShadow,
  flattenForProposed,
} from "./orchestrator";
import type { OrchestratorPayload, ButtonsData, DimensionResult } from "./types";

describe("cssLengthToPx", () => {
  it("parses px, rem/em (16px base), and bare numbers", () => {
    expect(cssLengthToPx("24px")).toBe(24);
    expect(cssLengthToPx("1.5rem")).toBe(24);
    expect(cssLengthToPx("0.5em")).toBe(8);
    expect(cssLengthToPx("12")).toBe(12);
  });

  it("returns null for unusable values", () => {
    expect(cssLengthToPx(null)).toBeNull();
    expect(cssLengthToPx(undefined)).toBeNull();
    expect(cssLengthToPx("")).toBeNull();
    expect(cssLengthToPx("calc(100% - 2px)")).toBeNull();
    expect(cssLengthToPx("50%")).toBeNull();
    expect(cssLengthToPx("var(--pad)")).toBeNull();
  });
});

describe("bucket thresholds sit between the Tailwind stops the tokens render to", () => {
  it("buttonPaddingX: px-4 (16) / px-5 (20) / px-8 (32)", () => {
    expect(bucketButtonPaddingX(12)).toBe("compact");
    expect(bucketButtonPaddingX(16)).toBe("compact");
    expect(bucketButtonPaddingX(20)).toBe("regular");
    expect(bucketButtonPaddingX(24)).toBe("regular");
    expect(bucketButtonPaddingX(32)).toBe("spacious");
  });

  it("buttonPaddingY: py-2 (8) / py-3 (12) / py-4 (16)", () => {
    expect(bucketButtonPaddingY(8)).toBe("compact");
    expect(bucketButtonPaddingY(12)).toBe("regular");
    expect(bucketButtonPaddingY(16)).toBe("spacious");
  });

  it("cardRadius: square (0) / slight (8) / rounded (16) / soft (24)", () => {
    expect(bucketCardRadius(0)).toBe("square");
    expect(bucketCardRadius(2)).toBe("square");
    expect(bucketCardRadius(6)).toBe("slight");
    expect(bucketCardRadius(8)).toBe("slight");
    expect(bucketCardRadius(16)).toBe("rounded");
    expect(bucketCardRadius(24)).toBe("soft");
    expect(bucketCardRadius(999)).toBe("soft");
  });

  it("bucketShadow reads none / depth from the raw declaration", () => {
    expect(bucketShadow("none")).toBe("none");
    expect(bucketShadow("0 0 0 rgba(0,0,0,0)")).toBe("none");
    // Dark hex colors contain "000" — the old inline heuristic mis-read this
    // as a zero shadow (see bucketShadow's anchored-regex note).
    expect(bucketShadow("0 1px 2px #0002")).toBe("sm");
    expect(bucketShadow("0 4px 12px 0px rgba(0, 0, 0, 0.15)")).toBe("md");
    expect(bucketShadow("0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)")).toBe("lg");
  });
});

// ── flattenForProposed wiring ────────────────────────────────────────────────

const failed = <T,>(): DimensionResult<T> =>
  ({ status: "failed", data: null, confidence: "low", errors: ["x"] }) as DimensionResult<T>;

function resultsWithButtons(
  buttons: ButtonsData,
  colorsExtra?: Record<string, unknown>,
): OrchestratorPayload["results"] {
  const colors = colorsExtra
    ? ({
        status: "ok",
        confidence: "medium",
        errors: [],
        data: {
          primary: "#112233", accent: "#445566", pageBackground: "#ffffff",
          cardBackground: "#ffffff", text: "#111111", ctaBackground: "#112233",
          ctaText: "#ffffff", navBgColor: "#ffffff", navText: "#111111",
          borderColor: "#dddddd", secondary: [], ...colorsExtra,
        },
      } as unknown as OrchestratorPayload["results"]["colors"])
    : failed<never>() as OrchestratorPayload["results"]["colors"];
  return {
    logos: failed(),
    colors,
    typography: failed(),
    buttons: { status: "ok", confidence: "high", errors: [], data: buttons },
    photography: failed(),
    voice: failed(),
    content: failed(),
    structure: failed(),
  } as unknown as OrchestratorPayload["results"];
}

const BUTTON: ButtonsData["primaryButton"] = {
  category: "rounded",
  radiusPx: 12,
  paddingX: "32px",
  paddingY: "8px",
  fontWeight: 600,
  textTransform: null,
  background: { type: "solid", value: "#112233" },
  textColor: "#ffffff",
  boxShadow: null,
  raw: {},
  visionAgreed: true,
  visionNotes: "",
};

describe("flattenForProposed — measured values reach the renderer's tokens", () => {
  it("proposes buttonPaddingX/Y from the measured button padding", () => {
    const { proposed, confidence } = flattenForProposed(
      resultsWithButtons({ primaryButton: BUTTON, surface: null }),
    );
    expect(proposed["buttonPaddingX"]).toBe("spacious");
    expect(proposed["buttonPaddingY"]).toBe("compact");
    expect(confidence["buttonPaddingX"]).toBe("high");
  });

  it("skips the padding tokens when the measurement is absent or unusable", () => {
    const { proposed } = flattenForProposed(
      resultsWithButtons({
        primaryButton: { ...BUTTON, paddingX: null, paddingY: "calc(1em + 2px)" },
        surface: null,
      }),
    );
    expect(proposed).not.toHaveProperty("buttonPaddingX");
    expect(proposed).not.toHaveProperty("buttonPaddingY");
  });

  it("proposes cardRadius + cardShadow from the measured surface style", () => {
    const { proposed } = flattenForProposed(
      resultsWithButtons({
        primaryButton: BUTTON,
        surface: { radiusPx: 24, boxShadow: "0 1px 2px #0001", border: null, raw: {} },
      }),
    );
    expect(proposed["cardRadius"]).toBe("soft");
    expect(proposed["cardShadow"]).toBe("sm");
  });

  it("falls back to the harvested design-token radius scale when no card rule was measured", () => {
    const { proposed } = flattenForProposed(
      resultsWithButtons(
        { primaryButton: BUTTON, surface: { radiusPx: null, boxShadow: null, border: null, raw: {} } },
        { designTokens: { radiusScale: { lg: "0.25rem" } } },
      ),
    );
    expect(proposed["cardRadius"]).toBe("slight");
    expect(proposed).not.toHaveProperty("cardShadow");
  });

  it("proposes no card tokens at all when nothing was measured", () => {
    const { proposed } = flattenForProposed(
      resultsWithButtons({ primaryButton: BUTTON, surface: null }),
    );
    expect(proposed).not.toHaveProperty("cardRadius");
    expect(proposed).not.toHaveProperty("cardShadow");
  });
});
