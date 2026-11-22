import { describe, expect, it } from "vitest";
import { summarySections, type HubSummaryInput } from "./room-summary";

const base: HubSummaryInput = {
  name: "Acme Dental Group",
  status: "Live",
  stage: "rollout",
  day: 21,
  rolloutDays: 90,
  pace: "On track: 9 live, 9 expected by day 21",
  practices: { total: 42, live: 9, trained: 15, scheduling: 10, notStarted: 17 },
  goals: [{ title: "Practices live", status: "on-track", target: "40 by Day 90", current: "9" }, { title: "Launch plan complete", status: "pending" }],
  engagement: { visits: 5, people: 2, seconds: 190, lastAt: "2026-11-21T11:00:00Z", windowDays: 30, top: [{ label: "Scorecard", opens: 6 }, { label: "Overview", opens: 6 }] },
  openRequests: [{ subject: "Extra welcome kits", status: "In progress" }],
  waitingOnCustomer: ["Agree the goals"],
  today: new Date("2026-11-21T12:00:00Z"),
};

describe("a hub's summary", () => {
  it("says where the rollout stands, with the pace", () => {
    const first = summarySections(base)[0];
    expect(first.title).toBe("Where it stands");
    expect(first.lines).toEqual(["Live · Rollout, day 21 of 90", "On track: 9 live, 9 expected by day 21", "9 of 42 practices live · 15 trained or live · 10 being scheduled · 17 not started"]);
  });
  it("lists goals with where each stands", () => {
    expect(summarySections(base).find((s) => s.title === "Goals")?.lines).toEqual(["Practices live: On track (today 9, target 40 by Day 90)", "Launch plan complete: Needs attention"]);
  });
  it("is honest about a quiet customer and an empty hub", () => {
    const quiet = summarySections({ ...base, practices: { total: 0, live: 0, trained: 0, scheduling: 0, notStarted: 0 }, pace: null, goals: [], engagement: { ...base.engagement!, visits: 0 }, openRequests: [], waitingOnCustomer: [] });
    expect(quiet[0].lines).toContain("No practices loaded yet");
    expect(quiet.find((s) => s.title.startsWith("Customer engagement"))?.lines).toEqual(["Nobody from the customer has opened the hub in this period"]);
    expect(quiet.find((s) => s.title === "Open with us")?.lines).toEqual(["No open requests"]);
    expect(quiet.some((s) => s.title === "Goals")).toBe(false);
  });
});
