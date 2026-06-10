import { describe, expect, it } from "vitest";

import { buildSystemPrompt, detectDsoVocabMode } from "./generate-microsite";

// Regression guard for the DSO block-variety fix. Dandy DSO segments ship a
// curated micrositeBlockList that previously forced every account's microsite
// into the SAME fixed block order, so every DSO microsite came out identical.
// The fix detects a genuine DSO vocabulary from the curated list and switches
// that segment to "DSO-freeform": the model freely composes a VARIED layout
// from the DSO vocabulary (kept separate per product) instead of filling a
// fixed list. These tests lock in the detection + prompt behaviour.

type BlockEntry = { type: string };

const ENTERPRISE_LIST: BlockEntry[] = [
  { type: "dso-heartland-hero" },
  { type: "dso-stat-bar" },
  { type: "dso-challenges" },
  { type: "dso-insights-dashboard" },
  { type: "dso-final-cta" },
];

const PRACTICES_LIST: BlockEntry[] = [
  { type: "dso-practice-hero" },
  { type: "dso-stat-row" },
  { type: "dso-partnership-perks" },
  { type: "dso-faq" },
  { type: "dso-final-cta" },
];

const NEUTRAL_LIST: BlockEntry[] = [
  { type: "hero" },
  { type: "trust-bar" },
  { type: "benefits-grid" },
  { type: "bottom-cta" },
  { type: "footer" },
];

const SEGMENT = { id: "dso", name: "DSO networks" };
const BRAND = { brandName: "Dandy" };

describe("detectDsoVocabMode", () => {
  it("detects the enterprise DSO vocabulary", () => {
    expect(detectDsoVocabMode(ENTERPRISE_LIST)).toBe("enterprise");
  });

  it("detects the practices DSO vocabulary", () => {
    expect(detectDsoVocabMode(PRACTICES_LIST)).toBe("practices");
  });

  it("returns null for a non-DSO (neutral) block list", () => {
    expect(detectDsoVocabMode(NEUTRAL_LIST)).toBeNull();
  });

  it("returns null for an empty / undefined list", () => {
    expect(detectDsoVocabMode([])).toBeNull();
    expect(detectDsoVocabMode(undefined)).toBeNull();
  });

  it("does not let the shared dso-final-cta alone decide the mode", () => {
    // Only dso-final-cta (shared by both vocabularies) → no disambiguating
    // signal → not a DSO page.
    expect(detectDsoVocabMode([{ type: "dso-final-cta" }])).toBeNull();
  });
});

describe("buildSystemPrompt — DSO-freeform variety", () => {
  it("enterprise mode advertises free block CHOICE, not a fixed order", () => {
    const prompt = buildSystemPrompt(
      SEGMENT,
      BRAND,
      undefined,
      "enterprise",
      false,
      undefined,
      "enterprise",
    );

    // It must NOT use the fixed-list framing that caused the regression.
    expect(prompt).not.toContain("You MUST output EXACTLY these blocks in EXACTLY this order");
    expect(prompt).not.toContain("BLOCKS TO GENERATE (fixed order):");

    // It must invite the model to choose and explicitly vary the layout.
    expect(prompt).toContain("you decide which and in what order");
    expect(prompt).toContain("Vary BOTH the selection AND the order across accounts");

    // The enterprise vocabulary is advertised; the practices-only vocabulary is not.
    expect(prompt).toContain("dso-heartland-hero");
    expect(prompt).toContain("dso-insights-dashboard");
    expect(prompt).not.toContain("dso-practice-hero");
    expect(prompt).not.toContain("dso-partnership-perks");
  });

  it("practices mode advertises the practices vocabulary, not the enterprise one", () => {
    const prompt = buildSystemPrompt(
      SEGMENT,
      BRAND,
      undefined,
      "practices",
      false,
      undefined,
      "practices",
    );

    expect(prompt).toContain("you decide which and in what order");
    expect(prompt).toContain("dso-practice-hero");
    expect(prompt).toContain("dso-partnership-perks");
    expect(prompt).not.toContain("dso-heartland-hero");
    expect(prompt).not.toContain("dso-insights-dashboard");
  });

  it("keeps the two DSO vocabularies disjoint across modes", () => {
    const enterprise = buildSystemPrompt(SEGMENT, BRAND, undefined, "enterprise", false, undefined, "enterprise");
    const practices = buildSystemPrompt(SEGMENT, BRAND, undefined, "practices", false, undefined, "practices");

    // An enterprise-only block never appears in the practices prompt and vice
    // versa — the products stay visually distinct.
    expect(enterprise).toContain("dso-pilot-steps");
    expect(practices).not.toContain("dso-pilot-steps");
    expect(practices).toContain("dso-activation-steps");
    expect(enterprise).not.toContain("dso-activation-steps");
  });
});
