/**
 * Pure-function unit tests for the signal-attribution canonicalizers.
 *
 * `normalizeLinkedinUrl` and `normalizeDomain` are the JS half of the
 * exact/canonical (never fuzzy) matching contract in `resolveSignalLinkage` and
 * the retroactive backfill. The SQL half is asserted to AGREE with these in the
 * hermetic integration test; here we lock in the JS behaviour on its own (no DB)
 * so a regression surfaces fast.
 *
 * The single most important guarantee: the LinkedIn canonicalizer must KEEP THE
 * PATH (only strip query/fragment + trailing slash) — collapsing a profile URL
 * to the bare `linkedin.com` would make every contact match every signal →
 * mass mis-attribution.
 */
import { describe, it, expect } from "vitest";
import { normalizeLinkedinUrl, normalizeDomain, normalizeCompanyName, matchAccountByName } from "./signalAttribution";

describe("normalizeLinkedinUrl", () => {
  it("returns null for empty / whitespace / nullish input", () => {
    expect(normalizeLinkedinUrl(null)).toBeNull();
    expect(normalizeLinkedinUrl(undefined)).toBeNull();
    expect(normalizeLinkedinUrl("")).toBeNull();
    expect(normalizeLinkedinUrl("   ")).toBeNull();
  });

  it("KEEPS the profile path (never collapses to the bare domain)", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/jane-doe")).toBe(
      "linkedin.com/in/jane-doe",
    );
    // Two different profiles must NOT canonicalize to the same value.
    expect(normalizeLinkedinUrl("https://linkedin.com/in/jane-doe")).not.toBe(
      normalizeLinkedinUrl("https://linkedin.com/in/john-roe"),
    );
  });

  it("strips protocol, www., query, fragment, and trailing slash", () => {
    const variants = [
      "https://www.linkedin.com/in/jane-doe",
      "http://www.linkedin.com/in/jane-doe/",
      "https://linkedin.com/in/jane-doe?utm_source=x&trk=y",
      "https://www.linkedin.com/in/jane-doe#about",
      "LinkedIn.com/in/jane-doe",
      "  https://www.linkedin.com/in/jane-doe/  ",
    ];
    for (const v of variants) {
      expect(normalizeLinkedinUrl(v)).toBe("linkedin.com/in/jane-doe");
    }
  });

  it("lowercases the whole URL", () => {
    expect(normalizeLinkedinUrl("HTTPS://WWW.LinkedIn.com/in/Jane-Doe")).toBe(
      "linkedin.com/in/jane-doe",
    );
  });
});

describe("normalizeDomain", () => {
  it("returns null for empty / nullish input", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("strips protocol, www., and any path/query/fragment down to the host", () => {
    const variants = [
      "acme.com",
      "www.acme.com",
      "https://acme.com",
      "https://www.acme.com/",
      "https://www.acme.com/careers?ref=x",
      "http://acme.com#top",
      "  ACME.com  ",
    ];
    for (const v of variants) {
      expect(normalizeDomain(v)).toBe("acme.com");
    }
  });

  it("keeps subdomains distinct (exact match, no fuzz)", () => {
    expect(normalizeDomain("eu.acme.com")).toBe("eu.acme.com");
    expect(normalizeDomain("eu.acme.com")).not.toBe(normalizeDomain("acme.com"));
  });
});


// July 2026 — the name tier regression: exact equality never matched
// decorated CRM account names, so rb2b signals (companyName + linkedin only)
// stopped linking. These cases are copied verbatim from the production data
// that diagnosed it.
describe("normalizeCompanyName", () => {
  it("strips -HQ decorations, corporate suffixes and punctuation", () => {
    expect(normalizeCompanyName("Heartland Dental-HQ")).toBe("heartland dental");
    expect(normalizeCompanyName("Bridge Dental Group- HQ")).toBe("bridge dental group");
    expect(normalizeCompanyName("Dental Care Alliance-HQ")).toBe("dental care alliance");
    expect(normalizeCompanyName("Btydental Group Llc")).toBe("btydental group");
    expect(normalizeCompanyName("Smith & Jones, Inc.")).toBe("smith and jones");
  });
});

describe("matchAccountByName (tiered, fail-closed)", () => {
  const ACCOUNTS = [
    { id: 1, name: "Bridge Dental Group- HQ" },
    { id: 2, name: "Dental Care Alliance-HQ" },
    { id: 3, name: "Elite Dental Partners-HQ" },
    { id: 4, name: "Heartland Dental-HQ" },
    { id: 5, name: "TAG - The Aspen Group (Aspen Dental)-HQ" },
    { id: 6, name: "The Smilist Dental-HQ" },
  ];

  it("tier 1 — normalized exact equality", () => {
    expect(matchAccountByName("Heartland Dental", ACCOUNTS)).toBe(4);
    expect(matchAccountByName("Dental Care Alliance", ACCOUNTS)).toBe(2);
    expect(matchAccountByName("Bridge Dental Group", ACCOUNTS)).toBe(1);
    expect(matchAccountByName("elite dental partners", ACCOUNTS)).toBe(3);
  });

  it("tier 2 — signal name is a prefix of the account name", () => {
    expect(matchAccountByName("The Smilist", ACCOUNTS)).toBe(6);
  });

  it("tier 3 — word-boundary containment inside a decorated account name", () => {
    expect(matchAccountByName("Aspen Dental", ACCOUNTS)).toBe(5);
  });

  it("fails closed on no match and on ambiguity", () => {
    expect(matchAccountByName("Sudo Research Labs", ACCOUNTS)).toBeNull();
    expect(matchAccountByName("Independent Consultant", ACCOUNTS)).toBeNull();
    const ambiguous = [
      { id: 10, name: "Acme Dental-HQ" },
      { id: 11, name: "Acme Dental (West)-HQ" },
      { id: 12, name: "Acme Dental (East)-HQ" },
    ];
    // exact tier picks the single exact normalization even when others contain it
    expect(matchAccountByName("Acme Dental", ambiguous)).toBe(10);
    // but two EXACT-equal normalizations = ambiguity = no match
    expect(matchAccountByName("Acme Dental", [
      { id: 20, name: "Acme Dental-HQ" },
      { id: 21, name: "Acme Dental LLC" },
    ])).toBeNull();
  });

  it("word boundaries — never matches inside larger words", () => {
    expect(matchAccountByName("Tend", [{ id: 30, name: "Tendon Health Partners" }])).toBeNull();
  });
});
