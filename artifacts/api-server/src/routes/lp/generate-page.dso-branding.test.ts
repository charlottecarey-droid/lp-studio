/**
 * Task #871 — the enterprise-dental (DSO) generation paths must not leak Dandy
 * product references into NON-Dandy tenants' pages, while the real Dandy tenant
 * still gets the full Dandy/dental experience.
 *
 * These tests exercise the pure prompt builders (no DB, no network):
 *   1. Dandy tenant → Dandy product names, "Dandy Hub" comparison example, and
 *      dental imagery steering are all present (no regression).
 *   2. Non-Dandy tenant → none of "AI Scan Review", "Dandy Hub", "Dandy Pilot
 *      Program", "The Dandy Way", "meetdandy", or forced dental-photo steering;
 *      the selling brand name is threaded through when provided.
 */
import { describe, it, expect } from "vitest";
import {
  buildDsoSystemPrompt,
  buildDsoPracticesSystemPrompt,
  buildSegmentSection,
} from "./generate-page";

const DANDY_MARKERS = [
  "AI Scan Review",
  "Dandy Hub",
  "Dandy Pilot Program",
  "The Dandy Way",
  "Dandy scanner",
  "DANDY-INTERNAL",
  "meetdandy",
];

describe("buildDsoSystemPrompt — Dandy tenant keeps Dandy specifics", () => {
  const prompt = buildDsoSystemPrompt({ isDandyTenant: true, brandName: "Dandy" });

  it("references real Dandy products and the Dandy Hub comparison example", () => {
    expect(prompt).toContain("AI Scan Review");
    expect(prompt).toContain("Dandy Pilot Program");
    expect(prompt).toContain("Dandy Hub");
  });

  it("steers dso-problem imagery toward dental/clinical photos", () => {
    expect(prompt).toContain("clinical, dental-team, or in-practice photos");
  });

  it("keeps the DANDY-INTERNAL video rule", () => {
    expect(prompt).toContain("DANDY-INTERNAL VIDEO ASSETS");
  });
});

describe("buildDsoSystemPrompt — Dandy Insights blocks are Dandy-only (Task #935)", () => {
  it("advertises the Dandy Insights blocks and the anti-relabel rule for Dandy", () => {
    const prompt = buildDsoSystemPrompt({ isDandyTenant: true, brandName: "Dandy" });
    expect(prompt).toContain('"dso-insights-dashboard"');
    expect(prompt).toContain('"dso-insights-video"');
    // The anti-relabel rule keeps the model from renaming AI Scan Review.
    expect(prompt).toContain("DANDY INSIGHTS vs AI SCAN REVIEW");
  });

  it("never exposes the Dandy Insights blocks to a non-Dandy tenant", () => {
    const prompt = buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" });
    expect(prompt).not.toContain("dso-insights-dashboard");
    expect(prompt).not.toContain("dso-insights-video");
    expect(prompt).not.toContain("DANDY INSIGHTS vs AI SCAN REVIEW");
  });
});

describe("buildSegmentSection — preferred block list (Task #935)", () => {
  it("emits the PREFERRED BLOCK LIST in order with optional schema hints", () => {
    const section = buildSegmentSection({
      name: "DSO Operators",
      micrositeBlockList: [
        { type: "dso-heartland-hero", schemaHint: "lead with the network value prop" },
        { type: "dso-insights-dashboard" },
      ],
    });
    expect(section).toContain("PREFERRED BLOCK LIST");
    expect(section).toContain('- "dso-heartland-hero" — lead with the network value prop');
    expect(section).toContain('- "dso-insights-dashboard"');
  });

  it("omits the section entirely when no block list is provided", () => {
    const section = buildSegmentSection({ name: "DSO Operators" });
    expect(section).not.toContain("PREFERRED BLOCK LIST");
  });

  it("skips malformed entries without a usable type", () => {
    const section = buildSegmentSection({
      name: "DSO Operators",
      micrositeBlockList: [{ type: "" }, { type: "dso-problem" }],
    });
    expect(section).toContain('- "dso-problem"');
    expect(section).not.toContain('- ""');
  });
});

describe("buildDsoSystemPrompt — non-Dandy tenant is neutral", () => {
  const prompt = buildDsoSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" });

  it("contains no Dandy product references or links", () => {
    for (const marker of DANDY_MARKERS) {
      expect(prompt).not.toContain(marker);
    }
  });

  it("does not force dental-clinic imagery", () => {
    expect(prompt).not.toContain("clinical, dental-team, or in-practice photos");
  });

  it("threads the selling brand name through the copy guidance", () => {
    expect(prompt).toContain("Acme Dental");
  });

  it("still advertises the full DSO block set (structure unchanged)", () => {
    for (const t of [
      "dso-heartland-hero", "dso-problem", "dso-comparison",
      "dso-success-stories", "dso-final-cta",
    ]) {
      expect(prompt).toContain(`"${t}"`);
    }
  });
});

describe("buildDsoSystemPrompt — non-Dandy with no brand name stays neutral", () => {
  const prompt = buildDsoSystemPrompt({ isDandyTenant: false, brandName: "" });

  it("never falls back to the word Dandy", () => {
    for (const marker of DANDY_MARKERS) {
      expect(prompt).not.toContain(marker);
    }
    // The bare word "Dandy" must not appear anywhere either.
    expect(/\bDandy\b/.test(prompt)).toBe(false);
  });
});

describe("buildDsoPracticesSystemPrompt — Dandy tenant keeps Dandy specifics", () => {
  const prompt = buildDsoPracticesSystemPrompt({ isDandyTenant: true, brandName: "Dandy" });

  it("references real Dandy products and 'The Dandy Way'", () => {
    expect(prompt).toContain("AI Scan Review");
    expect(prompt).toContain("The Dandy Way");
    expect(prompt).toContain("Dandy scanner");
  });
});

describe("buildDsoPracticesSystemPrompt — non-Dandy tenant is neutral", () => {
  const prompt = buildDsoPracticesSystemPrompt({ isDandyTenant: false, brandName: "Acme Dental" });

  it("contains no Dandy product references", () => {
    for (const marker of DANDY_MARKERS) {
      expect(prompt).not.toContain(marker);
    }
    expect(/\bDandy\b/.test(prompt)).toBe(false);
  });

  it("threads the selling brand name through the copy guidance", () => {
    expect(prompt).toContain("Acme Dental");
  });

  it("still advertises the full DSO Practices block set (structure unchanged)", () => {
    for (const t of [
      "dso-practice-hero", "dso-paradigm-shift", "dso-products-grid",
      "dso-meet-team", "dso-promises",
    ]) {
      expect(prompt).toContain(`"${t}"`);
    }
  });
});
