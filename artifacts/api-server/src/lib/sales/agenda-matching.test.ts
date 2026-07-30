import { describe, it, expect } from "vitest";
import {
  matchAgendaSessions,
  labelsMatch,
  sessionsConflict,
  sessionSourceKey,
  catalogRoleOptions,
  type MatchableSession,
  segmentsMatch,
  scoreSession,
  resolveAgendaSegment,
  agendaMatchFacts,
  catalogSegmentOptions,
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

/* ── segment matching (the Procore case) ───────────────────────────────────
   Every account is construction; the axis that differentiates is general
   contractors vs owners vs subcontractors. */

describe("segmentsMatch — strict, because segments partition the audience", () => {
  it("folds the ways people write the SAME segment", () => {
    expect(segmentsMatch("General Contractors", "general contractor")).toBe(true);
    expect(segmentsMatch("Owners", "owners")).toBe(true);
    expect(segmentsMatch("Owner's Representatives", "owner representative")).toBe(true);
    expect(segmentsMatch("Sub-Contractors", "subcontractors")).toBe(true);
    expect(segmentsMatch("The Owners", "owners")).toBe(true);
  });

  it("keeps DIFFERENT segments apart — including the pair labelsMatch gets wrong", () => {
    // labelsMatch("General Contractor", "Specialty Contractors") === true,
    // because it relates the shared token. On a partition that's a wrong
    // agenda, so the segment axis must not use it.
    expect(labelsMatch("General Contractor", "Specialty Contractors")).toBe(true);
    expect(segmentsMatch("General Contractor", "Specialty Contractors")).toBe(false);

    expect(segmentsMatch("General Contractors", "Subcontractors")).toBe(false);
    expect(segmentsMatch("Owners", "General Contractors")).toBe(false);
    expect(segmentsMatch("Subcontractors", "Specialty Contractors")).toBe(false);
  });

  it("an empty segment matches nothing rather than everything", () => {
    expect(segmentsMatch("", "Owners")).toBe(false);
    expect(segmentsMatch("   ", "")).toBe(false);
  });
});

describe("segment scoring and exclusion", () => {
  const session = (id: number, title: string, segments?: string[], extra: Partial<MatchableSession> = {}): MatchableSession => ({
    id, title, day: "2026-05-01", startTime: `0${id}:00`, endTime: `0${id}:45`,
    isReservedSlot: false,
    tags: segments ? { segments } : {},
    ...extra,
  });

  it("a matching segment outranks a role match — wrong segment is wrong for everyone", () => {
    const onSegment = scoreSession(session(1, "GC cost control", ["General Contractors"]), { segment: "General Contractors" }, []);
    const roleOnly = scoreSession(
      { ...session(2, "Ops roundtable"), tags: { roles: ["COO"] } },
      { segment: "General Contractors" },
      ["COO"],
    );
    expect(onSegment.score).toBeGreaterThan(roleOnly.score);
    expect(onSegment.reasons).toContain("Segment: General Contractors");
  });

  it("EXCLUDES a session declared for other segments", () => {
    const scored = scoreSession(session(1, "Owner capital planning", ["Owners"]), { segment: "General Contractors" }, []);
    expect(scored.excludedBySegment).toBe(true);
    expect(scored.reasons.join(" ")).toContain("For other segments");
  });

  it("a session listing SEVERAL segments including ours is included", () => {
    const scored = scoreSession(session(1, "Safety", ["Owners", "General Contractors"]), { segment: "General Contractors" }, []);
    expect(scored.excludedBySegment).toBeUndefined();
    expect(scored.score).toBeGreaterThan(0);
  });

  it("only fires on POSITIVE evidence — no account segment, or no session segments, never excludes", () => {
    expect(scoreSession(session(1, "Owner planning", ["Owners"]), {}, []).excludedBySegment).toBeUndefined();
    expect(scoreSession(session(1, "Untagged"), { segment: "Owners" }, []).excludedBySegment).toBeUndefined();
  });

  it("a RESERVED slot is never off-segment — it's booked for this account", () => {
    const reserved = session(1, "1:1 with your team", ["Owners"], { isReservedSlot: true });
    expect(scoreSession(reserved, { segment: "General Contractors" }, []).excludedBySegment).toBeUndefined();
  });

  it("does NOT exclude on the industries axis — that axis means industry for other tenants", () => {
    const s = { ...session(1, "Dental ops"), tags: { industries: ["Dental"] } };
    const scored = scoreSession(s, { segment: "DSO", industry: "Dental" }, []);
    expect(scored.excludedBySegment).toBeUndefined();
    expect(scored.score).toBeGreaterThan(0);
  });

  it("still SCORES a segment found on industries/topics (catalogs imported before the axis existed)", () => {
    const s = { ...session(1, "GC track"), tags: { industries: ["General Contractors"] } };
    const scored = scoreSession(s, { segment: "General Contractors" }, []);
    expect(scored.reasons).toContain("Segment: General Contractors");
    expect(scored.score).toBeGreaterThan(0);
  });

  it("the draft keeps off-segment sessions out but still reports them for the swap UI", () => {
    const catalog = [
      session(1, "GC cost control", ["General Contractors"]),
      session(2, "Owner capital planning", ["Owners"]),
      session(3, "Subcontractor cash flow", ["Subcontractors"]),
    ];
    const result = matchAgendaSessions(catalog, { segment: "General Contractors" }, []);
    expect(result.selected.map((s) => s.sessionId)).toEqual([1]);
    expect(result.considered.map((s) => s.sessionId).sort()).toEqual([1, 2, 3]);
    expect(result.considered.find((s) => s.sessionId === 2)?.excludedBySegment).toBe(true);
  });

  it("an OFF-SEGMENT keynote is excluded even though keynotes normally score for everyone", () => {
    const keynote = session(1, "Owners keynote", ["Owners"], { sessionType: "Keynote" });
    const result = matchAgendaSessions([keynote], { segment: "Subcontractors" }, []);
    expect(result.selected).toHaveLength(0);
  });

  it("with no segment on the account, matching behaves exactly as before", () => {
    const catalog = [
      session(1, "GC cost control", ["General Contractors"]),
      session(2, "Owner capital planning", ["Owners"]),
    ];
    expect(matchAgendaSessions(catalog, {}, []).selected).toHaveLength(2);
  });
});

describe("resolveAgendaSegment — the rep's override beats the CRM", () => {
  it("uses the account's segment when there's no override", () => {
    expect(resolveAgendaSegment({ segment: "Owners" }, null)).toBe("Owners");
  });

  it("the override wins — the conference names its own audiences", () => {
    expect(resolveAgendaSegment({ segment: "Owner/Developer" }, "Owners")).toBe("Owners");
  });

  it("works with no account row at all (CRM-less agenda)", () => {
    expect(resolveAgendaSegment(null, "Subcontractors")).toBe("Subcontractors");
    expect(resolveAgendaSegment(null, null)).toBeNull();
  });

  it("a blank override CLEARS back to the account instead of matching on empty", () => {
    expect(resolveAgendaSegment({ segment: "Owners" }, "   ")).toBe("Owners");
    expect(resolveAgendaSegment({ segment: null }, "")).toBeNull();
  });

  it("agendaMatchFacts keeps the account's other fields intact", () => {
    const facts = agendaMatchFacts({ segment: "Owner/Developer", industry: "Construction", abmTier: "Tier 1" }, "Owners");
    expect(facts).toEqual({ segment: "Owners", industry: "Construction", abmTier: "Tier 1" });
  });
});

describe("catalogSegmentOptions — the vocabulary the rep picks from", () => {
  const withSegments = (...segs: string[][]) =>
    segs.map((segments) => ({ tags: { segments } }));

  it("counts sessions per segment, most common first", () => {
    const opts = catalogSegmentOptions(withSegments(
      ["General Contractors"], ["General Contractors"], ["Owners"],
    ));
    expect(opts).toEqual([
      { segment: "General Contractors", count: 2 },
      { segment: "Owners", count: 1 },
    ]);
  });

  it("groups spellings the MATCHER treats as one, so the list can't offer a distinction that doesn't exist", () => {
    const opts = catalogSegmentOptions(withSegments(
      ["General Contractors"], ["general contractor"], ["Sub-Contractors"], ["subcontractors"],
    ));
    expect(opts).toHaveLength(2);
    expect(opts.map((o) => o.count)).toEqual([2, 2]);
  });

  it("keeps genuinely different segments separate", () => {
    const opts = catalogSegmentOptions(withSegments(["General Contractors"], ["Specialty Contractors"]));
    expect(opts).toHaveLength(2);
  });

  it("an untagged catalog offers nothing rather than guessing", () => {
    expect(catalogSegmentOptions([{ tags: {} }, { tags: { roles: ["COO"] } }])).toEqual([]);
  });
});
