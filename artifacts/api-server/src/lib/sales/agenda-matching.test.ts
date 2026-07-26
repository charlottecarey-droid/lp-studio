import { describe, it, expect } from "vitest";
import {
  matchAgendaSessions,
  labelsMatch,
  sessionsConflict,
  sessionSourceKey,
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
    expect(result.selected.map((s) => s.sessionId)).toEqual([1]);
    expect(result.selected[0].reasons).toContain("Targets COO");
    // Unmatched sessions still appear in considered for the swap UI.
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
