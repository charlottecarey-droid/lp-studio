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
