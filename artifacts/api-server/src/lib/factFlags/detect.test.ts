/**
 * Task #1138 — unit tests for the Strict Facts detection + normalization core.
 *
 * These exercise the pure functions only (no DB, no network):
 *   • detectFacts — finds stats, named-entity claims, and attributed quotes in
 *     a block list, conservatively (ambiguous quotes are NOT flagged).
 *   • normalizedFormFor / statKernel / quoteKernel — the fuzzy-match keys that
 *     make a paraphrased-but-equivalent fact collapse onto an approved one so
 *     it is never re-flagged.
 */
import { describe, it, expect } from "vitest";
import { detectFacts } from "./detect";
import { normalizedFormFor, statKernel, quoteKernel } from "./normalize";
import type { DetectedFact } from "./types";

function kinds(facts: DetectedFact[]): string[] {
  return facts.map((f) => f.factKind).sort();
}
function byKind(facts: DetectedFact[], kind: string): DetectedFact[] {
  return facts.filter((f) => f.factKind === kind);
}

describe("detectFacts — stats", () => {
  it("detects numeric stats in stat fields and free text", () => {
    const blocks = [
      { type: "trust-bar", props: { items: [{ value: "47%", label: "faster" }, { value: "3,000+", label: "patients" }] } },
      { type: "hero", props: { headline: "We deliver 2.5x ROI in 90 days" } },
    ];
    const facts = detectFacts(blocks);
    const stats = byKind(facts, "stat");
    const texts = stats.map((s) => s.originalText).sort();
    expect(texts).toContain("47%");
    expect(texts).toContain("3,000+");
    // Free-text stat with a unit ("2.5x", "90 days") is picked up too.
    expect(stats.some((s) => /2\.5x|90 days/i.test(s.originalText))).toBe(true);
  });

  it("does not flag plain prose with no numeric/unit content", () => {
    const blocks = [{ type: "hero", props: { headline: "The best dental lab partner" } }];
    expect(detectFacts(blocks)).toHaveLength(0);
  });

  it("records the field path so the flag can be applied back to the block", () => {
    const blocks = [{ id: "b1", type: "trust-bar", props: { items: [{ value: "98%", label: "fit" }] } }];
    const [fact] = byKind(detectFacts(blocks), "stat");
    expect(fact.blockId).toBe("b1");
    expect(fact.fieldPath).toBe("props.items[0].value");
  });
});

describe("detectFacts — stat false positives (Task #1197)", () => {
  it("does NOT flag time/ratio idioms even in a stat value field", () => {
    const blocks = [
      { type: "trust-bar", props: { items: [
        { value: "24/7", label: "support" },
        { value: "9-5", label: "hours" },
        { value: "1-5", label: "range" },
      ] } },
    ];
    expect(byKind(detectFacts(blocks), "stat")).toHaveLength(0);
  });

  it("does NOT flag imperative UI-instruction copy", () => {
    const blocks = [
      { type: "stepper", props: { steps: [
        { subtitle: "Select 1–5 locations" },
        { subtitle: "Choose your plan in 3 clicks" },
        { subtitle: "Pick 2 add-ons" },
        { subtitle: "Enter up to 10 emails" },
      ] } },
    ];
    expect(byKind(detectFacts(blocks), "stat")).toHaveLength(0);
  });

  it("does NOT flag a bare numeric selection range used as an instruction", () => {
    const blocks = [{ type: "stepper", props: { steps: [{ subtitle: "1–5 locations" }] } }];
    expect(byKind(detectFacts(blocks), "stat")).toHaveLength(0);
  });

  it("does NOT flag everyday duration/selection ranges (Task #1200)", () => {
    const blocks = [
      { type: "trust-bar", props: { items: [
        { value: "3-5 business days", label: "turnaround" },
        { value: "3-5 days", label: "shipping" },
        { value: "3-5 locations", label: "coverage" },
      ] } },
    ];
    expect(byKind(detectFacts(blocks), "stat")).toHaveLength(0);
  });

  it("DOES flag a benefit-claim range with no strong stat marker (Task #1200)", () => {
    const blocks = [
      { type: "trust-bar", props: { items: [
        { value: "3-5 more leads", label: "results" },
        { value: "10-20 additional signups", label: "growth" },
      ] } },
    ];
    const texts = byKind(detectFacts(blocks), "stat").map((s) => s.originalText).sort();
    expect(texts).toContain("3-5 more leads");
    expect(texts).toContain("10-20 additional signups");
  });

  it("DOES flag a bare range whose benefit unit lives in the sibling label (Task #1200)", () => {
    const blocks = [
      { type: "trust-bar", props: { stats: [{ value: "3-5", label: "more leads per week" }] } },
    ];
    const texts = byKind(detectFacts(blocks), "stat").map((s) => s.originalText);
    expect(texts).toContain("3-5");
  });

  it("keeps a bare range benign when the sibling label is an everyday unit (Task #1200)", () => {
    const blocks = [
      { type: "trust-bar", props: { stats: [{ value: "3-5", label: "business days to ship" }] } },
    ];
    expect(byKind(detectFacts(blocks), "stat")).toHaveLength(0);
  });

  it("STILL flags a benefit-claim range WITH a strong stat marker (Task #1200)", () => {
    const blocks = [
      { type: "hero", props: { headline: "Get 3-5x more leads every month" } },
    ];
    const texts = byKind(detectFacts(blocks), "stat").map((s) => s.originalText);
    expect(texts.some((t) => /3-5x/.test(t))).toBe(true);
  });

  it("STILL flags genuine stats (no regression from the new guards)", () => {
    const blocks = [
      { type: "trust-bar", props: { items: [
        { value: "$129/arch", label: "price" },
        { value: "98%", label: "fit rate" },
        { value: "4.9/5", label: "rating" },
        { value: "8,000+ dentists", label: "network" },
      ] } },
    ];
    const texts = byKind(detectFacts(blocks), "stat").map((s) => s.originalText).sort();
    expect(texts).toContain("$129/arch");
    expect(texts).toContain("98%");
    expect(texts).toContain("4.9/5");
    expect(texts).toContain("8,000+ dentists");
  });
});

describe("detectFacts — context capture (Task #1197)", () => {
  it("captures a sibling label as the fact's context", () => {
    const blocks = [{ type: "trust-bar", props: { stats: [{ value: "$129/arch", label: "per implant arch" }] } }];
    const [fact] = byKind(detectFacts(blocks), "stat");
    expect(fact.contextLabel).toBe("per implant arch");
  });

  it("falls back to the block heading when there is no sibling label", () => {
    const blocks = [{ type: "feature", props: { headline: "Proven results", body: "We deliver 2.5x ROI in 90 days" } }];
    const [fact] = byKind(detectFacts(blocks), "stat");
    expect(fact.contextLabel).toBe("Proven results");
  });
});

describe("detectFacts — claims", () => {
  it("detects a named-entity claim with a trigger phrase", () => {
    const blocks = [{ type: "richtext", props: { body: "Trusted by Fortune 500 companies nationwide." } }];
    const claims = byKind(detectFacts(blocks), "claim");
    expect(claims).toHaveLength(1);
  });

  it("does NOT treat superlatives without a trigger+entity as a claim", () => {
    const blocks = [{ type: "richtext", props: { body: "The fastest and most reliable service around." } }];
    expect(byKind(detectFacts(blocks), "claim")).toHaveLength(0);
  });
});

describe("detectFacts — claim false positives (CTA + self-positioning)", () => {
  it("does NOT flag the imperative CTA 'Partner with Dandy today' as a claim", () => {
    const blocks = [{ type: "hero", props: { headline: "Partner with Dandy today" } }];
    expect(byKind(detectFacts(blocks), "claim")).toHaveLength(0);
  });

  it("does NOT flag a CTA after a sentence break ('Ready to transform? — Partner with Dandy today')", () => {
    const blocks = [{ type: "cta", props: { headline: "Ready to transform? — Partner with Dandy today" } }];
    expect(byKind(detectFacts(blocks), "claim")).toHaveLength(0);
  });

  it("does NOT flag other imperative CTAs ('Join the future of dentistry')", () => {
    const blocks = [{ type: "cta", props: { headline: "Join the future of dentistry" } }];
    expect(byKind(detectFacts(blocks), "claim")).toHaveLength(0);
  });

  it("does NOT flag self-positioning when the only entity is the selling brand", () => {
    const blocks = [{ type: "richtext", props: { body: "Acme is your preferred partner for digital dentistry." } }];
    // No brand name → conservative default does not match this phrasing as a claim
    // (no declarative claim trigger fires on "preferred partner"); with the brand
    // name supplied it is unambiguously self-positioning, not external validation.
    expect(byKind(detectFacts(blocks, "Acme"), "claim")).toHaveLength(0);
  });

  it("suppresses a declarative-trigger claim when its only entity is the selling brand", () => {
    // "partners with Acme" is a declarative trigger + entity, but the entity IS
    // the selling brand → self-positioning, not external validation.
    const blocks = [{ type: "richtext", props: { body: "Every practice partners with Acme to grow." } }];
    expect(byKind(detectFacts(blocks, "Acme"), "claim")).toHaveLength(0);
    // A DIFFERENT selling brand → "Acme" is now an external entity → real claim.
    expect(byKind(detectFacts(blocks, "Globex"), "claim")).toHaveLength(1);
  });

  it("PRESERVES external-validation claims (true positives)", () => {
    const cases: Array<[string, string]> = [
      ["Trusted by Fortune 500 companies", "Trusted by Fortune 500 companies"],
      ["Partnered with Microsoft", "We are Partnered with Microsoft on this."],
      ["In partnership with AWS", "Built in partnership with AWS."],
      ["Featured in Forbes", "As featured in Forbes and elsewhere."],
      ["Rated #1 by G2", "Rated #1 by G2 in 2025."],
    ];
    for (const [name, body] of cases) {
      const blocks = [{ type: "richtext", props: { body } }];
      expect(byKind(detectFacts(blocks), "claim").length, name).toBeGreaterThanOrEqual(1);
    }
  });

  it("STILL flags 'Trusted by Acme' when the SELLING brand is different", () => {
    const blocks = [{ type: "richtext", props: { body: "Trusted by Acme nationwide." } }];
    expect(byKind(detectFacts(blocks, "Globex"), "claim")).toHaveLength(1);
  });
});

describe("detectFacts — quotes", () => {
  it("detects a quote field inside a testimonial block with attribution", () => {
    const blocks = [
      { type: "testimonial", props: { quote: "Best decision our practice ever made.", author: "Dr. Lopez", company: "Smile Co." } },
    ];
    const quotes = byKind(detectFacts(blocks), "quote");
    expect(quotes).toHaveLength(1);
    expect(quotes[0].attribution?.name).toBe("Dr. Lopez");
    expect(quotes[0].attribution?.company).toBe("Smile Co.");
  });

  it("detects an attributed quoted span in free text", () => {
    const blocks = [
      { type: "richtext", props: { body: '"This platform paid for itself in a month." — Jane Doe, Acme' } },
    ];
    const quotes = byKind(detectFacts(blocks), "quote");
    expect(quotes).toHaveLength(1);
    expect(quotes[0].attribution?.name).toMatch(/Jane Doe/);
  });

  it("is conservative: an unattributed quoted span is NOT flagged as a quote", () => {
    const blocks = [{ type: "richtext", props: { body: 'She said "hello there" and left.' } }];
    expect(byKind(detectFacts(blocks), "quote")).toHaveLength(0);
  });
});

describe("detectFacts — guards", () => {
  it("returns empty for non-array input", () => {
    expect(detectFacts(null)).toEqual([]);
    expect(detectFacts(undefined)).toEqual([]);
    expect(detectFacts({} as unknown)).toEqual([]);
  });
});

describe("normalization / fuzzy matching", () => {
  it("statKernel collapses written-out units onto the symbol form", () => {
    expect(statKernel("47 percent")).toBe(statKernel("47%"));
    expect(statKernel("3000+")).toBe(statKernel("3000 plus"));
  });

  it("normalizedFormFor makes equivalent stats share a key", () => {
    expect(normalizedFormFor("stat", "47%")).toBe(normalizedFormFor("stat", "47 percent"));
  });

  it("quote normalized form keys on first words + attribution name", () => {
    const a = normalizedFormFor("quote", "Best decision our practice ever made for our team", { name: "Dr. Lopez" });
    const b = normalizedFormFor("quote", "Best decision our practice ever made for our patients", { name: "Dr. Lopez" });
    // Same first-N words + same name → same fuzzy key (paraphrased tail ignored).
    expect(a).toBe(b);
    expect(quoteKernel("Best decision our practice ever made for everyone")).toContain("best decision");
  });

  it("different attribution names produce different quote keys", () => {
    const a = normalizedFormFor("quote", "Loved working with this team", { name: "Alice" });
    const b = normalizedFormFor("quote", "Loved working with this team", { name: "Bob" });
    expect(a).not.toBe(b);
  });
});
