import { describe, expect, it } from "vitest";

import { buildResearchQueries, type ResearchQueryInputs } from "./draft-email";

// ─── Fixtures ──────────────────────────────────────────────
// A prospect with NO industry/segment set — the common multi-tenant case.
// The research prompts must stay vertical-neutral here (regression guard for
// the dental/DSO-hardcoded queries that once broke research for every
// non-dental account).
const NEUTRAL_INPUT: ResearchQueryInputs = {
  fullName: "Marc Benioff",
  title: "CEO",
  accountName: "Salesforce",
  industry: "",
  segment: "",
  numLocations: null,
  privateEquityFirm: "",
  linkedinUrl: "",
  domain: "salesforce.com",
};

// Any vertical-specific vocabulary that must NEVER be baked into the prompts.
// Derived from the original hardcoded bug (dental/DSO terms + trade pubs).
const VERTICAL_TERMS = [
  /dental/i,
  /\bDSO\b/i,
  /dentist/i,
  /healthcare ops/i,
  /Dental Economics/i,
  /Group Dentistry Now/i,
];

describe("buildResearchQueries — stays vertical-neutral", () => {
  it("bakes no hardcoded vertical terms when the account has no industry", () => {
    const q = buildResearchQueries(NEUTRAL_INPUT);

    // Empty account industry/segment → empty hint → "search the whole web".
    expect(q.industryHint).toBe("");

    const allQueries = [q.personQuery, q.companyQuery, q.linkedinQuery, q.siteQuery].join("\n\n");
    for (const term of VERTICAL_TERMS) {
      expect(allQueries).not.toMatch(term);
    }

    // With no hint, the person query must not append a parenthetical industry
    // filter to the conference/talk line.
    expect(q.personQuery).toContain('"Marc Benioff" conference talk, keynote, panel, or presentation\n');
    // The company query's industry-news line stays generic (no leading hint).
    expect(q.companyQuery).toContain('"Salesforce" industry news, job postings signaling growth');
  });

  it("injects the account's own industry hint when industry/segment are set", () => {
    const q = buildResearchQueries({
      ...NEUTRAL_INPUT,
      industry: "Renewable Energy",
      segment: "Enterprise",
      linkedinUrl: "https://www.linkedin.com/in/marcbenioff",
    });

    expect(q.industryHint).toBe("Renewable Energy, Enterprise");

    // The hint is woven into the person, company, and linkedin queries —
    // derived solely from the account, never a hardcoded vertical.
    expect(q.personQuery).toContain("(Renewable Energy, Enterprise)");
    expect(q.companyQuery).toContain('"Salesforce" Renewable Energy, Enterprise industry news');
    expect(q.linkedinQuery).toContain("Renewable Energy, Enterprise industry trends");

    // Still no leakage of an unrelated baked-in vertical.
    const allQueries = [q.personQuery, q.companyQuery, q.linkedinQuery, q.siteQuery].join("\n\n");
    for (const term of VERTICAL_TERMS) {
      expect(allQueries).not.toMatch(term);
    }
  });

  it("derives the hint from segment alone when industry is empty", () => {
    const q = buildResearchQueries({ ...NEUTRAL_INPUT, segment: "Mid-Market" });
    expect(q.industryHint).toBe("Mid-Market");
    expect(q.personQuery).toContain("(Mid-Market)");
  });

  it("uses the LinkedIn-URL variant only when a profile URL is provided", () => {
    const withUrl = buildResearchQueries({
      ...NEUTRAL_INPUT,
      linkedinUrl: "https://www.linkedin.com/in/marcbenioff",
    });
    expect(withUrl.linkedinQuery).toContain("https://www.linkedin.com/in/marcbenioff");

    const withoutUrl = buildResearchQueries(NEUTRAL_INPUT);
    expect(withoutUrl.linkedinQuery).not.toContain("linkedin.com/in/");
    expect(withoutUrl.linkedinQuery).toContain('Search for "Marc Benioff" "Salesforce" on LinkedIn');
  });
});
