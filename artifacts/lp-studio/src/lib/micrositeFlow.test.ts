import { describe, it, expect } from "vitest";
import {
  OBJECTIVE_CARDS,
  objectiveToEnum,
  inferPersonaCategory,
  inferPersonaFromContacts,
  recommendSegmentPersona,
  duplicateWarning,
  type FlowSegment,
  type DuplicateCandidate,
} from "./micrositeFlow";

describe("objectiveToEnum", () => {
  it("passes through every valid card objective unchanged", () => {
    for (const card of OBJECTIVE_CARDS) {
      expect(objectiveToEnum(card.objective)).toBe(card.objective);
    }
  });

  it("maps the eight expected enum values", () => {
    expect(OBJECTIVE_CARDS.map((c) => c.objective)).toEqual([
      "book-meeting",
      "advance-opportunity",
      "re-engage-stalled",
      "support-proposal",
      "share-business-case",
      "exec-presentation",
      "drive-expansion",
      "from-scratch",
    ]);
  });

  it("degrades unknown/blank/null to from-scratch (fail-open)", () => {
    expect(objectiveToEnum("nonsense")).toBe("from-scratch");
    expect(objectiveToEnum("")).toBe("from-scratch");
    expect(objectiveToEnum("   ")).toBe("from-scratch");
    expect(objectiveToEnum(null)).toBe("from-scratch");
    expect(objectiveToEnum(undefined)).toBe("from-scratch");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(objectiveToEnum("  book-meeting  ")).toBe("book-meeting");
  });
});

describe("inferPersonaCategory", () => {
  it("maps titles from the spec's examples", () => {
    expect(inferPersonaCategory("COO")).toBe("Operations");
    expect(inferPersonaCategory("CEO")).toBe("Executive");
    expect(inferPersonaCategory("Clinical Director")).toBe("Clinical");
    expect(inferPersonaCategory("Procurement Lead")).toBe("Procurement");
  });

  it("prefers clinical intent over generic chief seniority", () => {
    expect(inferPersonaCategory("Chief Clinical Officer")).toBe("Clinical");
  });

  it("classifies finance and marketing leaders", () => {
    expect(inferPersonaCategory("CFO")).toBe("Finance");
    expect(inferPersonaCategory("VP of Marketing")).toBe("Marketing");
  });

  it("returns unknown for blank or unrecognised titles", () => {
    expect(inferPersonaCategory("")).toBe("unknown");
    expect(inferPersonaCategory(null)).toBe("unknown");
    expect(inferPersonaCategory("Receptionist")).toBe("unknown");
  });
});

describe("inferPersonaFromContacts", () => {
  it("returns unknown for empty / missing input", () => {
    expect(inferPersonaFromContacts([])).toBe("unknown");
    expect(inferPersonaFromContacts(null)).toBe("unknown");
  });

  it("picks the highest-priority category across the buyer committee", () => {
    expect(
      inferPersonaFromContacts([{ title: "Office Manager" }, { title: "CEO" }]),
    ).toBe("Executive");
  });

  it("infers operations when only an operator title is present", () => {
    expect(
      inferPersonaFromContacts([{ title: "Receptionist" }, { title: "Practice Manager" }]),
    ).toBe("Operations");
  });

  it("falls back to the role field when title is absent", () => {
    expect(inferPersonaFromContacts([{ role: "Clinical Director" }])).toBe("Clinical");
  });

  it("returns unknown when no contact is classifiable", () => {
    expect(inferPersonaFromContacts([{ title: "Receptionist" }])).toBe("unknown");
  });
});

describe("recommendSegmentPersona", () => {
  const segments: FlowSegment[] = [
    {
      id: "dso",
      name: "DSO",
      personas: [
        { id: "p-exec", role: "Executive / Economic Buyer" },
        { id: "p-ops", role: "Operations Manager" },
      ],
    },
    {
      id: "indie",
      name: "Independent practice",
      personas: [{ id: "p-clin", role: "Clinical Director" }],
    },
  ];

  it("pre-selects the segment + persona matching the inferred category", () => {
    expect(recommendSegmentPersona(segments, "Operations")).toEqual({
      segmentId: "dso",
      personaId: "p-ops",
    });
    expect(recommendSegmentPersona(segments, "Clinical")).toEqual({
      segmentId: "indie",
      personaId: "p-clin",
    });
  });

  it("falls back to the first segment with no persona when the category is unknown", () => {
    expect(recommendSegmentPersona(segments, "unknown")).toEqual({
      segmentId: "dso",
      personaId: "",
    });
  });

  it("falls back to the first segment when no persona matches the category", () => {
    expect(recommendSegmentPersona(segments, "Procurement")).toEqual({
      segmentId: "dso",
      personaId: "",
    });
  });

  it("returns empty ids when there are no segments", () => {
    expect(recommendSegmentPersona([], "Executive")).toEqual({
      segmentId: "",
      personaId: "",
    });
  });
});

describe("duplicateWarning", () => {
  it("does not warn with no results", () => {
    expect(duplicateWarning("acme", []).warn).toBe(false);
    expect(duplicateWarning("acme", null).warn).toBe(false);
  });

  it("warns and suggests the canonical row when a duplicate is flagged", () => {
    const results: DuplicateCandidate[] = [
      { id: 1, name: "Acme Inc", confidence: 90, dataRichness: 80 },
      { id: 2, name: "Acme", confidence: 88, dataRichness: 10, isLikelyDuplicateOf: 1 },
    ];
    const w = duplicateWarning("acme", results);
    expect(w.warn).toBe(true);
    expect(w.suggested?.id).toBe(1);
    expect(w.message).toContain("same company");
  });

  it("warns on a single strong (>=80) match even without a flagged duplicate", () => {
    const results: DuplicateCandidate[] = [
      { id: 5, name: "Bright Smile Dental", confidence: 100, dataRichness: 40 },
    ];
    const w = duplicateWarning("bright smile dental", results);
    expect(w.warn).toBe(true);
    expect(w.suggested?.id).toBe(5);
    expect(w.message).toContain("Bright Smile Dental");
  });

  it("does not warn when only weak matches exist", () => {
    const results: DuplicateCandidate[] = [
      { id: 9, name: "Totally Different Co", confidence: 30, dataRichness: 5 },
    ];
    expect(duplicateWarning("acme", results).warn).toBe(false);
  });

  it("prefers the richest canonical row as the suggestion", () => {
    const results: DuplicateCandidate[] = [
      { id: 1, name: "Acme East", confidence: 85, dataRichness: 30 },
      { id: 2, name: "Acme West", confidence: 82, dataRichness: 70 },
    ];
    const w = duplicateWarning("acme", results);
    expect(w.warn).toBe(true);
    expect(w.suggested?.id).toBe(2);
  });
});
