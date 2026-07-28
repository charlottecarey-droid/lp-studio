import { describe, expect, it } from "vitest";
import {
  normalizeDomain,
  normalizeName,
  parseAccountList,
  matchAccountList,
  matchedAccountIds,
  type SystemAccount,
} from "./account-list-match";

const ACCOUNTS: SystemAccount[] = [
  { id: 1, name: "Acme Dental Group, Inc.", displayName: "Acme Dental", domain: "https://www.acmedental.com/about" },
  { id: 2, name: "Northwind Systems LLC", displayName: null, domain: "northwind.io" },
  { id: 3, name: "Cornerstone Partners", displayName: null, domain: null },
  { id: 4, name: "Summit Health", displayName: null, domain: "summit.health" },
  // Same name as #3, different company — the classic ambiguity.
  { id: 5, name: "Cornerstone Partners", displayName: null, domain: "cornerstone-uk.co.uk" },
];

describe("normalizeDomain", () => {
  it("reduces URLs, emails and stray parts to a bare host", () => {
    for (const v of [
      "https://www.acmedental.com/about",
      "http://acmedental.com",
      "ACMEDENTAL.COM",
      "www.acmedental.com:443/x?y=1",
      "jane@acmedental.com",
      " acmedental.com. ",
    ]) {
      expect(normalizeDomain(v)).toBe("acmedental.com");
    }
  });

  it("keeps a real subdomain distinct — that's a different host", () => {
    expect(normalizeDomain("shop.acme.com")).toBe("shop.acme.com");
    expect(normalizeDomain("shop.acme.com")).not.toBe(normalizeDomain("acme.com"));
  });

  it("rejects things that aren't domains", () => {
    for (const v of ["", "Acme Dental", "localhost", "not a domain", "123"]) {
      expect(normalizeDomain(v)).toBe("");
    }
  });
});

describe("normalizeName", () => {
  it("folds legal suffixes, punctuation and decorations", () => {
    expect(normalizeName("Acme Dental Group, Inc.")).toBe("acme dental");
    expect(normalizeName("ACME DENTAL")).toBe("acme dental");
    expect(normalizeName("The Acme Dental Co.")).toBe("acme dental");
    expect(normalizeName("Acme  Dental   LLC")).toBe("acme dental");
  });

  it("treats & and 'and' the same", () => {
    expect(normalizeName("Smith & Jones")).toBe(normalizeName("Smith and Jones"));
  });

  it("does not fold two genuinely different names together", () => {
    expect(normalizeName("Acme Dental")).not.toBe(normalizeName("Acme Medical"));
  });
});

describe("parseAccountList", () => {
  it("reads a header row in any order or casing", () => {
    const rows = parseAccountList("Domain,Account Name\nacme.com,Acme Dental\nnorthwind.io,Northwind");
    expect(rows).toEqual([
      { raw: "acme.com,Acme Dental", name: "Acme Dental", domain: "acme.com" },
      { raw: "northwind.io,Northwind", name: "Northwind", domain: "northwind.io" },
    ]);
  });

  it("works with no header, classifying each value by shape", () => {
    const rows = parseAccountList("Acme Dental,acme.com\nnorthwind.io");
    expect(rows[0]).toMatchObject({ name: "Acme Dental", domain: "acme.com" });
    expect(rows[1]).toMatchObject({ domain: "northwind.io" });
    expect(rows[1].name).toBeUndefined();
  });

  it("accepts a bare list of names, or a bare list of domains", () => {
    expect(parseAccountList("Acme Dental\nNorthwind Systems").map((r) => r.name))
      .toEqual(["Acme Dental", "Northwind Systems"]);
    expect(parseAccountList("acme.com\nnorthwind.io").map((r) => r.domain))
      .toEqual(["acme.com", "northwind.io"]);
  });

  it("handles tabs, quoted cells containing commas, and blank lines", () => {
    const rows = parseAccountList('Account\tDomain\n"Acme, Dental"\tacme.com\n\n\nNorthwind\tnorthwind.io');
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Acme, Dental");
  });

  it("treats a URL sitting in the name column as a domain", () => {
    const rows = parseAccountList("Account Name\nhttps://acme.com");
    expect(rows[0]).toMatchObject({ domain: "https://acme.com" });
    expect(rows[0].name).toBeUndefined();
  });

  it("empty input yields no rows rather than one blank one", () => {
    expect(parseAccountList("")).toEqual([]);
    expect(parseAccountList("\n\n  \n")).toEqual([]);
  });
});

describe("matchAccountList", () => {
  const run = (text: string) => matchAccountList(parseAccountList(text), ACCOUNTS);

  it("matches on domain, however the domain was written", () => {
    const r = run("Domain\nhttps://www.acmedental.com/pricing");
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({ accountId: 1, method: "domain", accountName: "Acme Dental" });
  });

  it("matches on an exact name", () => {
    const r = run("Account\nNorthwind Systems LLC");
    expect(r.matched[0]).toMatchObject({ accountId: 2, method: "name-exact" });
  });

  it("matches on a normalised name — suffixes and case don't matter", () => {
    const r = run("Account\nACME DENTAL GROUP INC");
    expect(r.matched[0]).toMatchObject({ accountId: 1, method: "name-normalized" });
  });

  it("matches against the display name as well as the raw name", () => {
    expect(run("Account\nAcme Dental").matched[0]).toMatchObject({ accountId: 1 });
  });

  it("DOMAIN WINS over name — it's the only identifier that's actually unique", () => {
    // Name says Northwind, domain says Acme. Both resolve; domain decides…
    const r = matchAccountList(
      [{ raw: "x", name: "Northwind Systems LLC", domain: "acmedental.com" }],
      ACCOUNTS,
    );
    // …but only after being reported as a conflict, because they disagree.
    expect(r.matched).toHaveLength(0);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].byDomain.accountId).toBe(1);
    expect(r.conflicts[0].byName.accountId).toBe(2);
  });

  it("a domain and name that AGREE just match once", () => {
    const r = matchAccountList(
      [{ raw: "x", name: "Acme Dental", domain: "acmedental.com" }],
      ACCOUNTS,
    );
    expect(r.matched).toHaveLength(1);
    expect(r.conflicts).toHaveLength(0);
    expect(r.matched[0].method).toBe("domain");
  });

  it("AMBIGUITY IS SURFACED, NOT GUESSED", () => {
    // Two real accounts share this name; picking one would mail the wrong company.
    const r = run("Account\nCornerstone Partners");
    expect(r.matched).toHaveLength(0);
    expect(r.ambiguous).toHaveLength(1);
    expect(r.ambiguous[0].candidates.map((c) => c.accountId).sort()).toEqual([3, 5]);
  });

  it("a domain disambiguates a duplicated name", () => {
    const r = matchAccountList(
      [{ raw: "x", name: "Cornerstone Partners", domain: "cornerstone-uk.co.uk" }],
      ACCOUNTS,
    );
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].accountId).toBe(5);
  });

  it("reports rows that don't match anything", () => {
    const r = run("Account,Domain\nWho Even,whoever.example\nAcme Dental,");
    expect(r.unmatched.map((u) => u.name)).toEqual(["Who Even"]);
    expect(r.matched).toHaveLength(1);
  });

  it("reports a second row hitting an already-claimed account instead of double-adding", () => {
    const r = run("Account\nAcme Dental\nAcme Dental Group, Inc.");
    expect(r.matched).toHaveLength(1);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].accountId).toBe(1);
    expect(matchedAccountIds(r)).toEqual([1]);
  });

  it("produces a clean, deduped id list for the audience filter", () => {
    const r = run("Domain\nacmedental.com\nnorthwind.io\nsummit.health");
    expect(matchedAccountIds(r).sort()).toEqual([1, 2, 4]);
  });

  it("an account with no domain still matches by name", () => {
    const r = matchAccountList([{ raw: "x", name: "Summit Health" }], ACCOUNTS);
    expect(r.matched[0].accountId).toBe(4);
  });

  it("an empty list matches nothing and throws nothing", () => {
    const r = matchAccountList([], ACCOUNTS);
    expect(r).toEqual({ matched: [], ambiguous: [], conflicts: [], unmatched: [], duplicates: [] });
  });

  it("no accounts in the system means everything is unmatched, not an error", () => {
    const r = matchAccountList(parseAccountList("Acme Dental"), []);
    expect(r.unmatched).toHaveLength(1);
    expect(r.matched).toHaveLength(0);
  });
});
