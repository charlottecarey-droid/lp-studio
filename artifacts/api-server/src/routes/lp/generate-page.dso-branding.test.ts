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
