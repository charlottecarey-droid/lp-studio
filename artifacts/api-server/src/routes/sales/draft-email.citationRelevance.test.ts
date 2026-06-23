import { describe, expect, it } from "vitest";

import {
  buildCitationRelevanceCheck,
  deriveVerticalSourceTerms,
  type CitationRelevanceInputs,
} from "./draft-email";

// ─── Fixtures ──────────────────────────────────────────────
// A prospect with NO industry/segment set — the common multi-tenant case.
// Citation source ranking must stay vertical-neutral here (regression guard for
// the dental/DSO-hardcoded trusted-domains list + regex that once biased source
// ranking toward dental for every non-dental tenant).
const NEUTRAL_INPUT: CitationRelevanceInputs = {
  firstName: "Marc",
  lastName: "Benioff",
  accountName: "Salesforce",
  domain: "salesforce.com",
  industry: "",
  segment: "",
};

// Dental/DSO trade-pub URLs that the old hardcoded list always kept. A
// non-dental account must NOT get these boosted as relevant sources.
const DENTAL_SOURCE_URLS = [
  "https://www.groupdentistrynow.com/dso-news/some-article",
  "https://www.dentaleconomics.com/practice/article",
  "https://www.dentistrytoday.com/news/industry",
  "https://www.dsonews.com/story",
  "https://www.beckersdental.com/dental/123-article.html",
  "https://example.com/dental-practice-orthodontics-guide",
];

describe("buildCitationRelevanceCheck — stays vertical-neutral", () => {
  it("gives non-dental accounts no dental-specific source boosting", () => {
    const isRelevant = buildCitationRelevanceCheck(NEUTRAL_INPUT);

    // None of the dental trade pubs / dental keyword URLs should be kept just
    // for being dental — the account has no dental industry/segment.
    for (const url of DENTAL_SOURCE_URLS) {
      expect(isRelevant(url)).toBe(false);
    }
  });

  it("still keeps vertical-neutral trusted news/business sources", () => {
    const isRelevant = buildCitationRelevanceCheck(NEUTRAL_INPUT);

    expect(isRelevant("https://www.linkedin.com/in/marcbenioff")).toBe(true);
    expect(isRelevant("https://www.bloomberg.com/news/salesforce")).toBe(true);
    expect(isRelevant("https://www.reuters.com/markets/companies/abc")).toBe(true);
    expect(isRelevant("https://www.prnewswire.com/news-releases/xyz")).toBe(true);
    expect(isRelevant("https://www.crunchbase.com/organization/foo")).toBe(true);
  });

  it("keeps the company's own domain and name/person matches", () => {
    const isRelevant = buildCitationRelevanceCheck(NEUTRAL_INPUT);

    expect(isRelevant("https://www.salesforce.com/products")).toBe(true);
    expect(isRelevant("https://news.site/articles/marc-benioff-keynote")).toBe(true);
  });

  it("filters out irrelevant junk citations", () => {
    const isRelevant = buildCitationRelevanceCheck(NEUTRAL_INPUT);

    expect(isRelevant("https://www.cdc.gov/diseases/flu.pdf")).toBe(false);
    expect(isRelevant("https://www.fda.gov/drugs/some-pharma")).toBe(false);
    expect(isRelevant("https://en.wikipedia.org/wiki/Random_topic")).toBe(false);
  });

  it("derives vertical keep-terms ONLY from the account's industry/segment", () => {
    // A dental account DOES get dental sources boosted — but because the
    // preference comes from its own industry field, not a hardcoded vertical.
    const dentalAccount = buildCitationRelevanceCheck({
      ...NEUTRAL_INPUT,
      industry: "Dental",
    });
    expect(dentalAccount("https://www.dentaleconomics.com/practice/article")).toBe(true);

    // A renewable-energy account boosts energy sources, not dental ones.
    const energyAccount = buildCitationRelevanceCheck({
      ...NEUTRAL_INPUT,
      industry: "Renewable Energy",
    });
    expect(energyAccount("https://www.greentechmedia.com/renewable-news")).toBe(true);
    expect(energyAccount("https://www.dentaleconomics.com/practice/article")).toBe(false);
  });
});

describe("deriveVerticalSourceTerms", () => {
  it("returns no terms for an empty industry/segment (neutral)", () => {
    expect(deriveVerticalSourceTerms("", "")).toEqual([]);
  });

  it("splits the account industry/segment into keep-terms", () => {
    expect(deriveVerticalSourceTerms("Renewable Energy", "")).toEqual([
      "renewable",
      "energy",
    ]);
  });

  it("drops common size/legal stopwords so segments can't over-match", () => {
    // "Enterprise" / "Mid-Market" / "Inc" are noise, not vertical signal.
    expect(deriveVerticalSourceTerms("", "Enterprise")).toEqual([]);
    expect(deriveVerticalSourceTerms("", "Mid-Market")).toEqual([]);
    expect(deriveVerticalSourceTerms("Acme Inc", "")).toEqual(["acme"]);
  });

  it("dedupes overlapping industry + segment words", () => {
    expect(deriveVerticalSourceTerms("Healthcare", "Healthcare Providers")).toEqual([
      "healthcare",
      "providers",
    ]);
  });
});
