import { describe, it, expect } from "vitest";
import {
  matchAgendaSessions,
  labelsMatch,
  sessionsConflict,
  sessionSourceKey,
  catalogRoleOptions,
  type MatchableSession,
} from "./agenda-matching";

function session(partial: Partial<MatchableSession> & { id: number; title: string }): MatchableSession {
  return {
    day: "2026-10-20",
    startTime: "09:00",
    endTime: "10:00",
    isReservedSlot: false,
    tags: {},
    ...partial,
  };
}

describe("labelsMatch", () => {
  it("matches exact labels case-insensitively", () => {
    expect(labelsMatch("COO", "coo")).toBe(true);
  });

  it("matches containment both ways", () => {
    expect(labelsMatch("Clinical Director", "clinical directors")).toBe(true);
    expect(labelsMatch("Operations", "VP of Operations")).toBe(true);
  });

  it("rejects containment on very short strings so 'IT' doesn't match everything", () => {
    expect(labelsMatch("IT", "auditor")).toBe(false);
  });

  it("rejects unrelated labels", () => {
    expect(labelsMatch("COO", "CFO")).toBe(false);
  });
});

describe("sessionsConflict", () => {
  it("detects overlap on the same day", () => {
    const a = session({ id: 1, title: "A", startTime: "09:00", endTime: "10:30" });
    const b = session({ id: 2, title: "B", startTime: "10:00", endTime: "11:00" });
    expect(sessionsConflict(a, b)).toBe(true);
  });

  it("back-to-back sessions do not conflict", () => {
    const a = session({ id: 1, title: "A", startTime: "09:00", endTime: "10:00" });
    const b = session({ id: 2, title: "B", startTime: "10:00", endTime: "11:00" });
    expect(sessionsConflict(a, b)).toBe(false);
  });

  it("different days never conflict", () => {
    const a = session({ id: 1, title: "A", day: "2026-10-20" });
    const b = session({ id: 2, title: "B", day: "2026-10-21" });
    expect(sessionsConflict(a, b)).toBe(false);
  });

  it("treats a missing end time as 60 minutes", () => {
    const a = session({ id: 1, title: "A", startTime: "09:00", endTime: null });
    const b = session({ id: 2, title: "B", startTime: "09:30", endTime: "10:30" });
    expect(sessionsConflict(a, b)).toBe(true);
  });
});

describe("matchAgendaSessions", () => {
  const account = { industry: "Dental", abmTier: "Tier 1" };

  it("picks role-matched sessions and explains why", () => {
    const sessions = [
      session({ id: 1, title: "Ops at scale", tags: { roles: ["COO", "Operations"] } }),
      session({ id: 2, title: "Untagged filler", startTime: "11:00", endTime: "12:00" }),
    ];
    const result = matchAgendaSessions(sessions, account, ["COO"]);
    expect(result.selected[0].sessionId).toBe(1);
    expect(result.selected[0].reasons).toContain("Targets COO");
    // An UNTAGGED session is now proposed too — an imported catalog is mostly
    // untagged, and scoring those 0 produced near-empty agendas. It ranks below
    // the real role match.
    const untagged = result.considered.find((c) => c.sessionId === 2);
    expect(untagged?.reasons).toContain("Open to all attendees");
    expect(untagged?.score).toBeLessThan(result.considered.find((c) => c.sessionId === 1)!.score);
    expect(result.considered).toHaveLength(2);
  });

  it("resolves slot conflicts by score, keeping the winner only", () => {
    const sessions = [
      session({ id: 1, title: "Weak match", tags: { industries: ["Dental"] } }),          // score 2
      session({ id: 2, title: "Strong match", tags: { roles: ["COO"], industries: ["Dental"] } }), // score 5, same slot
    ];
    const result = matchAgendaSessions(sessions, account, ["COO"]);
    expect(result.selected.map((s) => s.sessionId)).toEqual([2]);
  });

  it("always pins reserved slots even with zero score, and they win their slot", () => {
    const sessions = [
      session({ id: 1, title: "Scored session", tags: { roles: ["COO"] } }),
      session({ id: 2, title: "Account team 1:1", isReservedSlot: true }), // same slot, no tags
    ];
    const result = matchAgendaSessions(sessions, account, ["COO"]);
    expect(result.selected.map((s) => s.sessionId)).toEqual([2]);
    expect(result.selected[0].reasons).toContain("Reserved for this account");
  });

  it("returns selections in chronological order regardless of score order", () => {
    const sessions = [
      session({ id: 1, title: "Late big score", day: "2026-10-21", tags: { roles: ["COO", "CFO"], industries: ["Dental"], tiers: ["Tier 1"] } }),
      session({ id: 2, title: "Early small score", day: "2026-10-20", tags: { industries: ["Dental"] } }),
    ];
    const result = matchAgendaSessions(sessions, account, ["COO", "CFO"]);
    expect(result.selected.map((s) => s.sessionId)).toEqual([2, 1]);
  });

  it("is deterministic on ties (alphabetical title wins the slot)", () => {
    const sessions = [
      session({ id: 1, title: "Zeta workshop", tags: { industries: ["Dental"] } }),
      session({ id: 2, title: "Alpha workshop", tags: { industries: ["Dental"] } }),
    ];
    const a = matchAgendaSessions(sessions, account, []);
    const b = matchAgendaSessions([...sessions].reverse(), account, []);
    expect(a.selected.map((s) => s.sessionId)).toEqual([2]);
    expect(b.selected.map((s) => s.sessionId)).toEqual([2]);
  });

  it("selects nothing (but considers everything) when nothing matches", () => {
    const sessions = [session({ id: 1, title: "Unrelated", tags: { roles: ["BIM/VDC"] } })];
    const result = matchAgendaSessions(sessions, { industry: "Dental" }, ["COO"]);
    expect(result.selected).toEqual([]);
    expect(result.considered).toHaveLength(1);
  });
});

describe("sessionSourceKey", () => {
  it("is stable across cosmetic whitespace/case changes", () => {
    expect(sessionSourceKey("Scaling Lab Operations", "2026-10-20", "09:00"))
      .toBe(sessionSourceKey("  scaling   lab operations ", "2026-10-20", "09:00"));
  });

  it("distinguishes the same title at different times", () => {
    expect(sessionSourceKey("Office Hours", "2026-10-20", "09:00"))
      .not.toBe(sessionSourceKey("Office Hours", "2026-10-20", "14:00"));
  });
});

describe("labelsMatch — vocabulary mismatch was the top cause of empty agendas", () => {
  it("resolves executive acronyms against spelled-out titles", () => {
    expect(labelsMatch("COO", "Chief Operating Officer")).toBe(true);
    expect(labelsMatch("Chief Financial Officer", "CFO")).toBe(true);
    expect(labelsMatch("VP Operations", "Vice President, Operations")).toBe(true);
  });

  it("matches an acronym against the catalog's plain-word tag", () => {
    // A rep picks "COO"; the conference tagged the session "Operations".
    expect(labelsMatch("COO", "Operations")).toBe(true);
    expect(labelsMatch("Operations", "Operational Leaders")).toBe(true);
  });

  it("matches across word forms and punctuation", () => {
    expect(labelsMatch("Clinical Director", "Director, Clinical Operations")).toBe(true);
    expect(labelsMatch("IT", "Information Technology")).toBe(true);
  });

  it("does NOT match two unrelated roles that share only a rank word", () => {
    expect(labelsMatch("Marketing Director", "Clinical Director")).toBe(false);
    expect(labelsMatch("Chief Financial Officer", "Chief Nursing Officer")).toBe(false);
    expect(labelsMatch("VP Sales", "VP Engineering")).toBe(false);
  });
});

describe("matchAgendaSessions — a real imported catalog still produces a draft", () => {
  /** What a URL import actually looks like: mostly untagged, a keynote, one tagged breakout. */
  const importedCatalog = [
    session({ id: 1, title: "Opening keynote: the year ahead", sessionType: "Keynote", startTime: "09:00", endTime: "10:00" }),
    session({ id: 2, title: "Scaling operations", sessionType: "Breakout", startTime: "11:00", endTime: "12:00", tags: { roles: ["Operations"] } }),
    session({ id: 3, title: "Untagged workshop", sessionType: "Workshop", startTime: "13:00", endTime: "14:00" }),
    session({ id: 4, title: "Another untagged talk", sessionType: "Breakout", startTime: "15:00", endTime: "16:00" }),
  ];

  it("no longer returns an almost-empty agenda when tags are sparse", () => {
    const result = matchAgendaSessions(importedCatalog, { industry: "Dental" }, ["COO"]);
    // Previously only id 2 could score; now the keynote and the untagged
    // sessions are proposed too, so the rep gets a real draft to trim.
    expect(result.selected.length).toBe(4);
  });

  it("ranks a genuine role match above 'everyone attends' above 'open to all'", () => {
    const scored = matchAgendaSessions(importedCatalog, {}, ["COO"]).considered;
    const byId = new Map(scored.map((s) => [s.sessionId, s]));
    expect(byId.get(2)!.score).toBeGreaterThan(byId.get(1)!.score); // role beats keynote
    expect(byId.get(1)!.score).toBeGreaterThan(byId.get(3)!.score); // keynote beats untagged
  });

  it("labels a plenary session as everyone-attends", () => {
    const scored = matchAgendaSessions(importedCatalog, {}, []).considered;
    expect(scored.find((s) => s.sessionId === 1)?.reasons).toContain("Everyone attends");
  });

  it("a role-tagged session that does NOT match still ranks below the picks", () => {
    const sessions = [
      session({ id: 1, title: "Clinician only", startTime: "09:00", endTime: "10:00", tags: { roles: ["Clinical Director"] } }),
      session({ id: 2, title: "Ops track", startTime: "11:00", endTime: "12:00", tags: { roles: ["Operations"] } }),
    ];
    const scored = matchAgendaSessions(sessions, {}, ["COO"]).considered;
    const byId = new Map(scored.map((s) => [s.sessionId, s]));
    // Tagged-but-irrelevant scores 0 and is not proposed.
    expect(byId.get(1)!.score).toBe(0);
    expect(byId.get(2)!.score).toBeGreaterThan(0);
  });
});

describe("catalogRoleOptions — chips come from the catalog's own tags", () => {
  it("returns roles by frequency with counts", () => {
    const sessions = [
      session({ id: 1, title: "A", tags: { roles: ["Operations", "COO"] } }),
      session({ id: 2, title: "B", tags: { roles: ["Operations"] } }),
      session({ id: 3, title: "C", tags: { roles: ["Clinical"] } }),
    ];
    // Frequency first, then alphabetical for a stable list.
    expect(catalogRoleOptions(sessions)).toEqual([
      { role: "Operations", count: 2 },
      { role: "Clinical", count: 1 },
      { role: "COO", count: 1 },
    ]);
  });

  it("groups spellings case-insensitively and never double-counts one session", () => {
    const sessions = [
      session({ id: 1, title: "A", tags: { roles: ["operations", "Operations"] } }),
      session({ id: 2, title: "B", tags: { roles: ["OPERATIONS"] } }),
      session({ id: 3, title: "C", tags: { roles: ["Operations"] } }),
    ];
    const opts = catalogRoleOptions(sessions);
    expect(opts).toHaveLength(1);
    expect(opts[0].count).toBe(3);
    expect(opts[0].role).toBe("Operations"); // most common spelling wins
  });

  it("is empty for an untagged catalog", () => {
    expect(catalogRoleOptions([session({ id: 1, title: "A" })])).toEqual([]);
  });
});
