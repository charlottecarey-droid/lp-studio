import { describe, it, expect } from "vitest";
import {
  normalizeProgramSettings,
  computeBacklogGap,
  planScheduleSlots,
  nextPublishSlot,
  decideTick,
  runQualityGate,
  canTransitionTopic,
  isTopicStatus,
  QUALITY_MIN_WORDS,
  type ProgramSettings,
} from "./blogProgram";

function settings(over: Partial<ProgramSettings> = {}): ProgramSettings {
  return normalizeProgramSettings({
    mode: "autonomous",
    postsPerWeek: 2,
    targetBacklogDays: 45,
    publishDays: [2, 4],
    publishHour: 9,
    maxAutonomousPerWeek: 3,
    autopublishEnabled: false,
    ...over,
  });
}

describe("normalizeProgramSettings", () => {
  it("clamps backlog days to 30–90", () => {
    expect(normalizeProgramSettings({ targetBacklogDays: 5 }).targetBacklogDays).toBe(30);
    expect(normalizeProgramSettings({ targetBacklogDays: 200 }).targetBacklogDays).toBe(90);
    expect(normalizeProgramSettings({ targetBacklogDays: 60 }).targetBacklogDays).toBe(60);
  });
  it("defaults mode to review (safest) and autopublish off", () => {
    const s = normalizeProgramSettings({});
    expect(s.mode).toBe("review");
    expect(s.autopublishEnabled).toBe(false);
  });
  it("only accepts 'autonomous' to leave review mode", () => {
    expect(normalizeProgramSettings({ mode: "AUTONOMOUS" }).mode).toBe("review");
    expect(normalizeProgramSettings({ mode: "autonomous" }).mode).toBe("autonomous");
  });
  it("never leaves publishDays empty", () => {
    expect(normalizeProgramSettings({ publishDays: [] }).publishDays).toEqual([2, 4]);
    expect(normalizeProgramSettings({ publishDays: [9, -1, 3] }).publishDays).toEqual([3]);
  });
  it("clamps the per-week cap", () => {
    expect(normalizeProgramSettings({ maxAutonomousPerWeek: -5 }).maxAutonomousPerWeek).toBe(0);
    expect(normalizeProgramSettings({ maxAutonomousPerWeek: 99 }).maxAutonomousPerWeek).toBe(14);
  });
});

describe("computeBacklogGap", () => {
  it("targets postsPerWeek * backlogDays / 7", () => {
    const gap = computeBacklogGap({ upcomingScheduled: 0, approvedQueue: 0, draftedReady: 0 }, settings({ postsPerWeek: 2, targetBacklogDays: 49 }));
    expect(gap.targetScheduled).toBe(14); // 2 * 49 / 7
    expect(gap.scheduledShortfall).toBe(14);
    expect(gap.hasGap).toBe(true);
  });
  it("no gap when fully scheduled", () => {
    const gap = computeBacklogGap({ upcomingScheduled: 14, approvedQueue: 0, draftedReady: 0 }, settings({ postsPerWeek: 2, targetBacklogDays: 49 }));
    expect(gap.scheduledShortfall).toBe(0);
    expect(gap.hasGap).toBe(false);
  });
  it("needsMoreTopics only when shortfall outstrips approved + drafted supply", () => {
    const s = settings({ postsPerWeek: 2, targetBacklogDays: 49 }); // target 14
    expect(computeBacklogGap({ upcomingScheduled: 0, approvedQueue: 14, draftedReady: 0 }, s).needsMoreTopics).toBe(false);
    expect(computeBacklogGap({ upcomingScheduled: 0, approvedQueue: 5, draftedReady: 4 }, s).needsMoreTopics).toBe(true);
    expect(computeBacklogGap({ upcomingScheduled: 10, approvedQueue: 2, draftedReady: 2 }, s).needsMoreTopics).toBe(false);
  });
});

describe("nextPublishSlot", () => {
  it("snaps forward to an allowed weekday at the publish hour", () => {
    // Sunday 2024-06-02. publishDays Tue(2)/Thu(4), hour 9.
    const sun = new Date(2024, 5, 2, 12, 0, 0);
    const slot = nextPublishSlot(sun, [2, 4], 9);
    expect(slot.getDay()).toBe(2); // Tuesday
    expect(slot.getHours()).toBe(9);
    expect(slot.getTime()).toBeGreaterThan(sun.getTime());
  });
  it("rolls to next day when same day is past the hour", () => {
    const tueLate = new Date(2024, 5, 4, 18, 0, 0); // Tue 6pm
    const slot = nextPublishSlot(tueLate, [2, 4], 9);
    expect(slot.getDay()).toBe(4); // Thursday
  });
});

describe("planScheduleSlots — cadence + per-week cap", () => {
  const now = new Date(2024, 5, 2, 0, 0, 0); // Sunday

  it("returns the requested count when budget allows", () => {
    const slots = planScheduleSlots({ count: 3, now, lastScheduledAt: null, settings: settings({ postsPerWeek: 2, maxAutonomousPerWeek: 5 }) });
    expect(slots).toHaveLength(3);
  });

  it("only schedules on allowed publish days", () => {
    const slots = planScheduleSlots({ count: 6, now, lastScheduledAt: null, settings: settings({ postsPerWeek: 3, maxAutonomousPerWeek: 6, publishDays: [1] }) });
    for (const s of slots) expect(s.scheduledAt.getDay()).toBe(1); // Monday only
  });

  it("never exceeds maxAutonomousPerWeek in any rolling 7-day window", () => {
    const cap = 2;
    const slots = planScheduleSlots({ count: 8, now, lastScheduledAt: null, settings: settings({ postsPerWeek: 7, maxAutonomousPerWeek: cap, publishDays: [0, 1, 2, 3, 4, 5, 6] }) });
    const times = slots.map((s) => s.scheduledAt.getTime());
    for (const t of times) {
      const inWindow = times.filter((x) => Math.abs(x - t) < 7 * 24 * 60 * 60 * 1000).length;
      expect(inWindow).toBeLessThanOrEqual(cap);
    }
  });

  it("schedules nothing when the per-week cap is 0", () => {
    const slots = planScheduleSlots({ count: 3, now, lastScheduledAt: null, settings: settings({ maxAutonomousPerWeek: 0 }) });
    expect(slots).toHaveLength(0);
  });

  it("starts after the last already-scheduled post", () => {
    const last = new Date(2024, 5, 20, 9, 0, 0);
    const slots = planScheduleSlots({ count: 1, now, lastScheduledAt: last, settings: settings({ maxAutonomousPerWeek: 5 }) });
    expect(slots[0].scheduledAt.getTime()).toBeGreaterThan(last.getTime());
  });

  it("spaces slots in chronological, non-decreasing order", () => {
    const slots = planScheduleSlots({ count: 4, now, lastScheduledAt: null, settings: settings({ postsPerWeek: 2, maxAutonomousPerWeek: 6 }) });
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].scheduledAt.getTime()).toBeGreaterThanOrEqual(slots[i - 1].scheduledAt.getTime());
    }
  });
});

describe("decideTick — review vs autonomous + guardrails", () => {
  const thinBacklog = { upcomingScheduled: 0, approvedQueue: 0, draftedReady: 0 };
  const healthyBacklog = { upcomingScheduled: 100, approvedQueue: 0, draftedReady: 0 };

  it("REVIEW mode never generates or schedules — only recommends", () => {
    const plan = decideTick({ settings: settings({ mode: "review" }), backlog: thinBacklog, autonomousThisWeek: 0 });
    expect(plan.mode).toBe("review");
    expect(plan.generateDrafts).toBe(false);
    expect(plan.scheduleDrafts).toBe(false);
    expect(plan.recommendTopics).toBe(true); // queue thin → top up for human approval
  });

  it("REVIEW mode does nothing when backlog healthy", () => {
    const plan = decideTick({ settings: settings({ mode: "review" }), backlog: healthyBacklog, autonomousThisWeek: 0 });
    expect(plan.recommendTopics).toBe(false);
    expect(plan.generateDrafts).toBe(false);
  });

  it("AUTONOMOUS mode generates + schedules when there is a gap and budget", () => {
    const plan = decideTick({ settings: settings({ mode: "autonomous" }), backlog: { upcomingScheduled: 0, approvedQueue: 5, draftedReady: 0 }, autonomousThisWeek: 0 });
    expect(plan.generateDrafts).toBe(true);
    expect(plan.scheduleDrafts).toBe(true);
    expect(plan.draftBudget).toBeGreaterThan(0);
  });

  it("AUTONOMOUS mode respects the weekly cap (no drafts when budget exhausted)", () => {
    const plan = decideTick({ settings: settings({ mode: "autonomous", maxAutonomousPerWeek: 3 }), backlog: thinBacklog, autonomousThisWeek: 3 });
    expect(plan.remainingWeeklyBudget).toBe(0);
    expect(plan.generateDrafts).toBe(false);
    expect(plan.draftBudget).toBe(0);
  });

  it("AUTONOMOUS draftBudget never exceeds remaining weekly budget", () => {
    const plan = decideTick({ settings: settings({ mode: "autonomous", maxAutonomousPerWeek: 3 }), backlog: { upcomingScheduled: 0, approvedQueue: 100, draftedReady: 0 }, autonomousThisWeek: 1 });
    expect(plan.draftBudget).toBeLessThanOrEqual(2); // 3 - 1
  });

  it("AUTONOMOUS mode does nothing when backlog at target", () => {
    const plan = decideTick({ settings: settings({ mode: "autonomous" }), backlog: healthyBacklog, autonomousThisWeek: 0 });
    expect(plan.generateDrafts).toBe(false);
    expect(plan.scheduleDrafts).toBe(false);
  });

  it("reason mentions autopublish state for the audit log", () => {
    const off = decideTick({ settings: settings({ mode: "autonomous", autopublishEnabled: false }), backlog: { upcomingScheduled: 0, approvedQueue: 5, draftedReady: 0 }, autonomousThisWeek: 0 });
    expect(off.reason).toMatch(/autopublish OFF/i);
    const on = decideTick({ settings: settings({ mode: "autonomous", autopublishEnabled: true }), backlog: { upcomingScheduled: 0, approvedQueue: 5, draftedReady: 0 }, autonomousThisWeek: 0 });
    expect(on.reason).toMatch(/autopublish ON/i);
  });
});

describe("runQualityGate", () => {
  const longBody = Array.from({ length: QUALITY_MIN_WORDS + 50 }, () => "word").join(" ");

  it("passes a complete, clean, long-enough draft", () => {
    const r = runQualityGate({ title: "A real title", bodyHtml: "<p>x</p>", bodyText: longBody, checklistOk: true, bannedPhrases: ["revolutionary"] });
    expect(r.pass).toBe(true);
    expect(r.failures).toHaveLength(0);
  });

  it("fails on banned phrases (strict facts / brand voice)", () => {
    const r = runQualityGate({ title: "Revolutionary new thing", bodyHtml: "", bodyText: longBody, checklistOk: true, bannedPhrases: ["revolutionary"] });
    expect(r.pass).toBe(false);
    expect(r.bannedHits).toContain("revolutionary");
  });

  it("fails a too-short body", () => {
    const r = runQualityGate({ title: "Title", bodyHtml: "", bodyText: "too short", checklistOk: true, bannedPhrases: [] });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => /too short/.test(f))).toBe(true);
  });

  it("fails an incomplete checklist", () => {
    const r = runQualityGate({ title: "Title", bodyHtml: "", bodyText: longBody, checklistOk: false, bannedPhrases: [] });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => /checklist/.test(f))).toBe(true);
  });

  it("fails a missing title", () => {
    const r = runQualityGate({ title: "  ", bodyHtml: "", bodyText: longBody, checklistOk: true, bannedPhrases: [] });
    expect(r.pass).toBe(false);
  });
});

describe("topic status machine", () => {
  it("allows suggested → approved/rejected only", () => {
    expect(canTransitionTopic("suggested", "approved")).toBe(true);
    expect(canTransitionTopic("suggested", "rejected")).toBe(true);
    expect(canTransitionTopic("suggested", "drafting")).toBe(false);
    expect(canTransitionTopic("suggested", "scheduled")).toBe(false);
  });
  it("requires approval before drafting", () => {
    expect(canTransitionTopic("approved", "drafting")).toBe(true);
    expect(canTransitionTopic("rejected", "drafting")).toBe(false);
  });
  it("walks drafting → drafted → scheduled → published", () => {
    expect(canTransitionTopic("drafting", "drafted")).toBe(true);
    expect(canTransitionTopic("drafted", "scheduled")).toBe(true);
    expect(canTransitionTopic("scheduled", "published")).toBe(true);
  });
  it("rejected + published are terminal", () => {
    expect(canTransitionTopic("rejected", "approved")).toBe(false);
    expect(canTransitionTopic("published", "scheduled")).toBe(false);
  });
  it("treats same-status as a no-op (allowed)", () => {
    expect(canTransitionTopic("approved", "approved")).toBe(true);
  });
  it("isTopicStatus guards unknown values", () => {
    expect(isTopicStatus("approved")).toBe(true);
    expect(isTopicStatus("bogus")).toBe(false);
    expect(isTopicStatus(42)).toBe(false);
  });
});
