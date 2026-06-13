/**
 * Account search ranking / dedupe / confidence — pure-function tests.
 */
import { describe, it, expect } from "vitest";
import {
  rankAndDedupeAccounts,
  computeDataRichness,
  computeConfidence,
  normalizeDomain,
  normalizeCompanyKey,
  type AccountSearchCandidate,
} from "./account-search";

describe("normalisation", () => {
  it("normalizeDomain strips scheme/www/path", () => {
    expect(normalizeDomain("https://www.Acme.com/about?x=1")).toBe("acme.com");
    expect(normalizeDomain("WWW.example.org")).toBe("example.org");
    expect(normalizeDomain(null)).toBe("");
  });

  it("normalizeCompanyKey strips suffixes and leading 'the'", () => {
    expect(normalizeCompanyKey("Acme Inc")).toBe("acme");
    expect(normalizeCompanyKey("The Acme Group")).toBe("acme");
    expect(normalizeCompanyKey("Acme, LLC")).toBe("acme");
    expect(normalizeCompanyKey("Acme")).toBe("acme");
  });
});

describe("computeDataRichness", () => {
  it("rewards contacts, opportunities, notes, enriched fields; caps at 100", () => {
    const rich = computeDataRichness({
      name: "A", source: "local",
      contactCount: 10, opportunityCount: 3, hasNotes: true, enrichedFieldCount: 8,
    });
    expect(rich).toBe(100);
  });

  it("empty account scores 0", () => {
    expect(computeDataRichness({ name: "A", source: "local" })).toBe(0);
  });

  it("more context outranks less", () => {
    const more = computeDataRichness({ name: "A", source: "local", contactCount: 5, opportunityCount: 1 });
    const less = computeDataRichness({ name: "B", source: "local", contactCount: 1 });
    expect(more).toBeGreaterThan(less);
  });
});

describe("computeConfidence", () => {
  const acct: AccountSearchCandidate = { name: "Bright Smile Dental", domain: "brightsmile.com", source: "local" };
  it("exact name → 100", () => {
    expect(computeConfidence("Bright Smile Dental", acct)).toBe(100);
  });
  it("prefix → high", () => {
    expect(computeConfidence("Bright Smile", acct)).toBeGreaterThanOrEqual(85);
  });
  it("whole-word inside → 85", () => {
    expect(computeConfidence("smile", acct)).toBe(85);
  });
  it("domain match when name does not contain query", () => {
    expect(computeConfidence("brightsmile", { name: "BSD Holdings", domain: "brightsmile.com", source: "local" }))
      .toBeGreaterThanOrEqual(55);
  });
  it("empty query → 0", () => {
    expect(computeConfidence("", acct)).toBe(0);
  });
});

describe("rankAndDedupeAccounts — richness ordering", () => {
  it("on equal confidence, the richest account ranks first", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme", source: "local", contactCount: 0 },
      { id: 2, name: "Acme", domain: "acme2.com", source: "local", contactCount: 6, opportunityCount: 1, hasNotes: true },
    ];
    const ranked = rankAndDedupeAccounts("Acme", candidates);
    // id 1 and 2 share company key "acme" → grouped; richest (id 2) is canonical
    // and the only non-dup row, so it ranks first.
    expect(ranked[0].id).toBe(2);
    expect(ranked[0].dataRichness).toBeGreaterThan(0);
  });

  it("higher confidence beats higher richness", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme Dental", domain: "acmedental.com", source: "local", contactCount: 10 },
      { id: 2, name: "Acme", domain: "acme.com", source: "local", contactCount: 0 },
    ];
    const ranked = rankAndDedupeAccounts("Acme", candidates);
    // "Acme" is an exact match (100) > "Acme Dental" prefix; exact wins.
    expect(ranked[0].id).toBe(2);
  });
});

describe("rankAndDedupeAccounts — duplicate grouping", () => {
  it("groups by normalized domain across sources and flags duplicates", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme Inc", domain: "https://www.acme.com", source: "local", contactCount: 5 },
      { crmId: "001abc", name: "ACME", domain: "acme.com", source: "crm", contactCount: 0 },
    ];
    const ranked = rankAndDedupeAccounts("acme", candidates);
    const local = ranked.find((r) => r.id === 1)!;
    const crm = ranked.find((r) => r.id === "001abc")!;
    // Local row is richer → canonical; CRM row flagged as a duplicate of it.
    expect(local.isLikelyDuplicateOf).toBeUndefined();
    expect(crm.isLikelyDuplicateOf).toBe(1);
  });

  it("groups by company name when no domain present", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme Inc", source: "local", contactCount: 3 },
      { id: 2, name: "The Acme Group", source: "local", contactCount: 0 },
    ];
    const ranked = rankAndDedupeAccounts("acme", candidates);
    const dup = ranked.find((r) => r.id === 2)!;
    expect(dup.isLikelyDuplicateOf).toBe(1);
  });

  it("collapseDuplicates drops non-canonical rows (one per company)", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme", domain: "acme.com", source: "local", contactCount: 5 },
      { crmId: "x", name: "Acme", domain: "acme.com", source: "crm" },
      { id: 2, name: "Globex", domain: "globex.com", source: "local" },
    ];
    const ranked = rankAndDedupeAccounts("a", candidates, { collapseDuplicates: true });
    expect(ranked.find((r) => r.id === "x")).toBeUndefined();
    expect(ranked.length).toBe(2);
  });

  it("different companies are NOT grouped", () => {
    const candidates: AccountSearchCandidate[] = [
      { id: 1, name: "Acme", domain: "acme.com", source: "local" },
      { id: 2, name: "Globex", domain: "globex.com", source: "local" },
    ];
    const ranked = rankAndDedupeAccounts("", candidates);
    expect(ranked.every((r) => r.isLikelyDuplicateOf === undefined)).toBe(true);
  });

  it("respects limit", () => {
    const candidates: AccountSearchCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      id: i, name: `Company ${i}`, domain: `c${i}.com`, source: "local" as const,
    }));
    const ranked = rankAndDedupeAccounts("company", candidates, { limit: 3 });
    expect(ranked.length).toBe(3);
  });
});
