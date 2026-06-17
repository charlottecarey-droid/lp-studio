import { describe, it, expect } from "vitest";
import {
  buildAccountWhere,
  buildContactWhere,
  buildLeadWhere,
  buildOpportunityWhere,
  applyWhere,
  escapeSoqlString,
  parseSyncFilters,
} from "./sfdc-sync-filters";

describe("sfdc-sync-filters WHERE builders", () => {
  it("returns empty clauses for empty filters (sync everything)", () => {
    expect(buildAccountWhere({})).toBe("");
    expect(buildContactWhere({})).toBe("");
    expect(buildLeadWhere({})).toBe("");
    expect(buildOpportunityWhere({})).toBe("");
  });

  it("builds account IN clauses joined by AND", () => {
    expect(
      buildAccountWhere({
        accounts: { types: ["Enterprise", "SMB"], industries: ["Healthcare"], owners: ["Jane Doe"] },
      }),
    ).toBe(
      "Type IN ('Enterprise', 'SMB') AND Industry IN ('Healthcare') AND Owner.Name IN ('Jane Doe')",
    );
  });

  it("scopes contacts to the account filter via the Account relationship", () => {
    expect(
      buildContactWhere({
        accounts: { types: ["Enterprise"] },
        contacts: { createdWithinYears: 2 },
      }),
    ).toMatch(/^Account\.Type IN \('Enterprise'\) AND CreatedDate >= \d{4}-\d{2}-\d{2}T00:00:00Z$/);
  });

  it("builds lead status + created-date window", () => {
    expect(buildLeadWhere({ leads: { statuses: ["Open", "Working"] } })).toBe(
      "Status IN ('Open', 'Working')",
    );
    expect(buildLeadWhere({ leads: { createdWithinYears: 1 } })).toMatch(
      /^CreatedDate >= \d{4}-\d{2}-\d{2}T00:00:00Z$/,
    );
  });

  it("builds opportunity stage, close-date window, and open/won toggles", () => {
    expect(buildOpportunityWhere({ opportunities: { status: "open" } })).toBe("IsClosed = false");
    expect(buildOpportunityWhere({ opportunities: { status: "won" } })).toBe("IsWon = true");
    expect(buildOpportunityWhere({ opportunities: { status: "all" } })).toBe("");
    expect(
      buildOpportunityWhere({ opportunities: { stages: ["Closed Won"], closedWithinYears: 3 } }),
    ).toMatch(/^StageName IN \('Closed Won'\) AND CloseDate >= \d{4}-\d{2}-\d{2}$/);
  });

  it("uses a SOQL Date literal (no time) for opportunity close date", () => {
    const clause = buildOpportunityWhere({ opportunities: { closedWithinYears: 2 } });
    expect(clause).toMatch(/^CloseDate >= \d{4}-\d{2}-\d{2}$/);
    expect(clause).not.toContain("T00:00:00Z");
  });
});

describe("sfdc-sync-filters SOQL injection safety", () => {
  it("escapes single quotes and backslashes in string values", () => {
    expect(escapeSoqlString("O'Brien")).toBe("O\\'Brien");
    expect(escapeSoqlString("a\\b")).toBe("a\\\\b");
  });

  it("neutralises a SOQL injection attempt in a filter value", () => {
    const clause = buildAccountWhere({
      accounts: { types: ["Enterprise') OR (Name LIKE '%"] },
    });
    // The malicious quote is escaped, so the whole payload stays one literal.
    expect(clause).toBe("Type IN ('Enterprise\\') OR (Name LIKE \\'%')");
    expect(clause).not.toMatch(/'\) OR \(/);
  });

  it("strips control characters from values", () => {
    expect(escapeSoqlString("line1\nline2\tend")).toBe("line1 line2 end");
  });
});

describe("applyWhere", () => {
  it("splices WHERE before LIMIT", () => {
    expect(applyWhere("SELECT Id FROM Account LIMIT 10000", "Type IN ('Enterprise')")).toBe(
      "SELECT Id FROM Account WHERE Type IN ('Enterprise') LIMIT 10000",
    );
  });

  it("leaves the query untouched when the clause is empty", () => {
    expect(applyWhere("SELECT Id FROM Account LIMIT 10000", "")).toBe(
      "SELECT Id FROM Account LIMIT 10000",
    );
  });

  it("appends WHERE when there is no LIMIT", () => {
    expect(applyWhere("SELECT Id FROM Account", "Type IN ('Enterprise')")).toBe(
      "SELECT Id FROM Account WHERE Type IN ('Enterprise')",
    );
  });
});

describe("parseSyncFilters validation", () => {
  it("accepts a valid payload and round-trips it", () => {
    const input = {
      accounts: { types: ["Enterprise"] },
      opportunities: { status: "won" as const, closedWithinYears: 2 },
    };
    expect(parseSyncFilters(input)).toEqual(input);
  });

  it("treats empty/undefined as an empty filter set", () => {
    expect(parseSyncFilters(undefined)).toEqual({});
    expect(parseSyncFilters({})).toEqual({});
  });

  it("rejects unknown top-level keys (fails closed)", () => {
    expect(parseSyncFilters({ bogus: true })).toBeNull();
  });

  it("rejects an out-of-range year window", () => {
    expect(parseSyncFilters({ leads: { createdWithinYears: 0 } })).toBeNull();
    expect(parseSyncFilters({ leads: { createdWithinYears: 999 } })).toBeNull();
  });

  it("rejects an invalid opportunity status", () => {
    expect(parseSyncFilters({ opportunities: { status: "lost" } })).toBeNull();
  });
});
