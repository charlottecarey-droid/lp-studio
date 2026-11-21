import { describe, expect, it } from "vitest";
import { buildPlanQueue, isDeclineChoice, planRequest, planRequestKeys } from "./partnerRoomPlanQueue";

const at = (d: number) => new Date(Date.UTC(2026, 10, d, 12));
const programs = [
  { key: "mk-announcement", title: "Partnership announcement", description: "Email and social posts", audience: "Practices", when: "Day 5" },
  { key: "mk-welcome-kits", title: "Welcome kits" },
  { key: "mk-lunch-learn", title: "Lunch & Learn program" },
  { key: "mk-welcome-event", title: "Welcome event" },
  { key: "mk-press", title: "Press release" },
];
const choices = [
  { key: "mk-announcement", value: "Include", by: "Dana Ruiz", at: at(10) },
  { key: "mk-welcome-kits", value: "Include", by: "Dana Ruiz", at: at(10) },
  { key: "mk-lunch-learn", value: "Not now", by: "Dana Ruiz", at: at(11) },
  { key: "mk-welcome-event", value: "Onsite training", by: "Kai Lee", at: at(15) },
];
const requests = [
  { id: 7, assetKey: "mk-plan:mk-announcement,mk-welcome-event", status: "in_progress", asanaTaskGid: "123", createdAt: at(12) },
  { id: 8, assetKey: "one-pager", status: "new", asanaTaskGid: null, createdAt: at(13) },
];

describe("marketing plan queue", () => {
  it("reads which programs a request carried", () => {
    expect(planRequestKeys("mk-plan:mk-a, mk-b")).toEqual(["mk-a", "mk-b"]);
    expect(planRequestKeys("one-pager")).toEqual([]);
    expect(planRequestKeys(null)).toEqual([]);
    expect(isDeclineChoice(" Not now ")).toBe(true);
    expect(isDeclineChoice("Dinner")).toBe(false);
  });

  it("puts each program where it stands: sent, waiting, declined, undecided, and waiting again after a changed answer", () => {
    const q = buildPlanQueue(programs, choices, requests);
    expect(q.map((i) => [i.key, i.state, i.changed])).toEqual([
      ["mk-announcement", "sent", false],
      ["mk-welcome-kits", "queued", false],
      ["mk-lunch-learn", "declined", false],
      ["mk-welcome-event", "queued", true], // chosen again on the 15th, sent on the 12th
      ["mk-press", "undecided", false],
    ]);
    expect(q[0].request).toEqual({ id: 7, status: "in_progress", asanaTaskGid: "123", sentAt: at(12).toISOString() });
    expect(q[1].request).toBeNull();
  });

  it("writes one request for several programs", () => {
    const q = buildPlanQueue(programs, choices, requests).filter((i) => i.state === "queued");
    const r = planRequest("Acme Group", q, "Sam Rep", "2026-11-16", "https://hub.example/acme", "Kits by Dec 1 please");
    expect(r.subject).toBe("Marketing plan: 2 programs");
    expect(r.details).toBe("Welcome kits\nWelcome event (Onsite training)");
    expect(r.assetKey).toBe("mk-plan:mk-welcome-kits,mk-welcome-event");
    expect(r.notes).toContain("Acme Group said yes to these 2 programs");
    expect(r.notes).toContain("2. Welcome event\n   Choice: Onsite training (changed since it was last sent)\n   Chosen by: Kai Lee on 2026-11-15");
    expect(r.notes).toContain("Note from Sam Rep: Kits by Dec 1 please");
    expect(r.notes).toContain("Hub: https://hub.example/acme");
    expect(planRequest("Acme Group", q.slice(0, 1), "Sam", "2026-11-16", "", "").subject).toBe("Marketing plan: Welcome kits");
  });
});
