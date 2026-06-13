/**
 * P0-A — Segment → core messaging hierarchy + persona threading.
 *
 * Asserts (pure, no DB):
 *   • buildSegmentSection emits the hard MESSAGING HIERARCHY override directive
 *     + the segment's value props when a segment is given.
 *   • A selected persona is injected with role + pains + caresAbout and the
 *     model is told to address THAT persona.
 *   • findSelectedPersona resolves by id and by role (case-insensitive).
 *   • The DSO failure guard: a DSO segment's section centers same-store growth /
 *     standardization / margin etc. and carries the override directive; a
 *     brand-defined segment avoid-phrase ("transform your practice with Dandy")
 *     is surfaced as a DO-NOT-USE line.
 *   • buildSystemPrompt with a segment contains the override directive +
 *     segment value props (+ persona when chosen); with no usable segment data
 *     the override directive is absent (core path).
 */
import { describe, it, expect } from "vitest";
import {
  buildSegmentSection,
  findSelectedPersona,
  buildSystemPrompt,
  type BrandAudienceSegment,
} from "./generate-microsite";

const DSO_SEGMENT: BrandAudienceSegment = {
  id: "dso",
  name: "DSO",
  description: "Dental Support Organizations operating many locations",
  messagingAngle: "Operational efficiency and standardization at scale",
  valueProps: [
    "Same-store growth across every location",
    "Standardization and margin expansion",
    "Enterprise rollout with central oversight",
  ],
  avoidPhrases: ["transform your practice with Dandy"],
  personas: [
    { id: "exec", role: "VP of Operations", painPoints: ["inconsistent quality across locations"], caresAbout: ["margin", "standardization"] },
    { id: "clin", role: "Regional Clinical Director", painPoints: ["remake rates"] },
  ],
};

describe("buildSegmentSection — messaging hierarchy override", () => {
  it("emits the hard override directive + segment value props", () => {
    const section = buildSegmentSection(DSO_SEGMENT);
    expect(section).toContain("MESSAGING HIERARCHY");
    expect(section.toUpperCase()).toContain("OVERRIDES");
    expect(section).toContain("Same-store growth across every location");
    expect(section).toContain("Standardization and margin expansion");
  });

  it("surfaces segment avoid-phrases as a DO-NOT-USE line (DSO failure guard)", () => {
    const section = buildSegmentSection(DSO_SEGMENT);
    expect(section.toLowerCase()).toContain("do not use");
    expect(section).toContain("transform your practice with Dandy");
  });

  it("centers DSO operational vocabulary, not practice-level core messaging", () => {
    const section = buildSegmentSection(DSO_SEGMENT).toLowerCase();
    expect(section).toContain("same-store growth");
    expect(section).toContain("standardization");
    expect(section).toContain("margin");
    expect(section).toContain("enterprise rollout");
  });

  it("injects the selected persona with role + pains + caresAbout", () => {
    const persona = findSelectedPersona(DSO_SEGMENT, "exec");
    const section = buildSegmentSection(DSO_SEGMENT, persona);
    expect(section).toContain("SELECTED PERSONA");
    expect(section).toContain("VP of Operations");
    expect(section).toContain("inconsistent quality across locations");
    expect(section).toContain("margin");
    expect(section.toLowerCase()).toContain("address this person");
  });

  it("returns empty string when no segment", () => {
    expect(buildSegmentSection(undefined)).toBe("");
  });
});

describe("findSelectedPersona", () => {
  it("resolves by id", () => {
    expect(findSelectedPersona(DSO_SEGMENT, "clin")?.role).toBe("Regional Clinical Director");
  });
  it("resolves by role, case-insensitive", () => {
    expect(findSelectedPersona(DSO_SEGMENT, "vp of operations")?.id).toBe("exec");
  });
  it("returns undefined for unknown persona", () => {
    expect(findSelectedPersona(DSO_SEGMENT, "nope")).toBeUndefined();
  });
  it("returns undefined when no personaId", () => {
    expect(findSelectedPersona(DSO_SEGMENT, undefined)).toBeUndefined();
  });
});

describe("buildSystemPrompt — segment vs core path", () => {
  const brand = { brandName: "Dandy", segments: [DSO_SEGMENT] };

  it("with a selected segment, the prompt contains the override directive + segment props", () => {
    const prompt = buildSystemPrompt(
      DSO_SEGMENT, brand, undefined, "dso", false, undefined, null, [], false, undefined, undefined,
    );
    expect(prompt).toContain("MESSAGING HIERARCHY");
    expect(prompt).toContain("Same-store growth across every location");
  });

  it("with a selected persona, the prompt addresses that persona", () => {
    const persona = findSelectedPersona(DSO_SEGMENT, "exec");
    const prompt = buildSystemPrompt(
      DSO_SEGMENT, brand, undefined, "dso", false, undefined, null, [], false, undefined, persona,
    );
    expect(prompt).toContain("SELECTED PERSONA");
    expect(prompt).toContain("VP of Operations");
  });

  it("with no usable segment data, the override directive is absent (core path)", () => {
    const emptySeg: BrandAudienceSegment = { id: "x", name: "X" };
    const prompt = buildSystemPrompt(
      emptySeg, { brandName: "Acme", segments: [] }, undefined, null, false, undefined, null, [], false, undefined, undefined,
    );
    expect(prompt).not.toContain("MESSAGING HIERARCHY");
  });
});

describe("buildSystemPrompt — brand-core context parity (June 2026 copy audit)", () => {
  const richBrand = {
    brandName: "Acme",
    segments: [DSO_SEGMENT],
    positioningStatement: "For multi-location practices, Acme is the lab that guarantees the seat.",
    valuePropositions: ["96% first-time seat rate", "5-day crown delivery"],
    terminologyPreferred: ["clinicians", "cases"],
    terminologyAvoid: ["users", "tickets"],
    ctaGuidance: "Always ask for a scan, never a demo.",
    writingDos: ["Lead with the seat-rate number"],
    writingDonts: ["Never call it a platform"],
    voiceProfile: { profile: { summary: "Plain, confident, lab-operator voice.", signaturePhrases: ["zero lab drama"] } },
    aiStrictFactsMode: true,
    scrapedStats: [{ value: "96%", label: "first-time seat rate", approvedForAi: true }],
    scrapedTestimonials: [{ quote: "Best lab we've used.", author: "Dr. Lee", approvedForAi: true }],
  };

  const prompt = buildSystemPrompt(
    DSO_SEGMENT, richBrand, undefined, "dso", false, undefined, null, [], false, undefined, undefined,
  );

  it("injects an ordered CONTEXT PRIORITY preamble", () => {
    expect(prompt).toContain("CONTEXT PRIORITY");
    expect(prompt).toMatch(/TARGET SEGMENT[\s\S]*OVERRIDES the brand core/);
  });

  it("injects positioning, value propositions, terminology, CTA guidance, dos/donts", () => {
    expect(prompt).toContain("POSITIONING");
    expect(prompt).toContain("For multi-location practices, Acme is the lab that guarantees the seat.");
    expect(prompt).toContain("Core value propositions");
    expect(prompt).toContain("PREFERRED TERMINOLOGY");
    expect(prompt).toContain("clinicians");
    expect(prompt).toContain("AVOID THIS TERMINOLOGY");
    expect(prompt).toContain("CTA GUIDANCE");
    expect(prompt).toContain("DO — follow these brand writing rules");
    expect(prompt).toContain("DON'T");
    expect(prompt).toContain("Never call it a platform");
  });

  it("injects the imported voice profile + scraped stats/quotes", () => {
    expect(prompt).toContain("Voice summary: Plain, confident, lab-operator voice.");
    expect(prompt).toContain("zero lab drama");
    expect(prompt).toContain("Approved brand stats");
    expect(prompt).toContain("96% first-time seat rate");
    expect(prompt).toContain("Approved customer quotes");
    expect(prompt).toContain("Best lab we've used.");
  });

  it("carries the specificity directive + the four new banned openers", () => {
    expect(prompt).toContain("SPECIFICITY & SUBSTANCE");
    for (const p of [
      "transform your business",
      "unlock your potential",
      "revolutionize your workflow",
      "take things to the next level",
    ]) {
      expect(prompt.toLowerCase()).toContain(p);
    }
  });
});
