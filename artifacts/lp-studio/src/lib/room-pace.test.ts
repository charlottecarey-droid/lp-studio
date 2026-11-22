import { describe, expect, it } from "vitest";
import { rolloutPace } from "./room-pace";

describe("rollout pace", () => {
  it("is on track near the straight line, and says the numbers", () => {
    expect(rolloutPace({ live: 14, total: 42, day: 30, rolloutDays: 90 })).toMatchObject({ state: "on-track", expected: 14, line: "On track: 14 live, 14 expected by day 30" });
    expect(rolloutPace({ live: 11, total: 42, day: 30, rolloutDays: 90 })?.state).toBe("on-track");
  });
  it("is behind when well short, and ahead when well past", () => {
    expect(rolloutPace({ live: 5, total: 42, day: 45, rolloutDays: 90 })).toMatchObject({ state: "behind", line: "Behind plan: 5 live, 21 expected by day 45 (16 short)" });
    expect(rolloutPace({ live: 30, total: 42, day: 30, rolloutDays: 90 })?.state).toBe("ahead");
  });
  it("uses the practices-live goal as the target when there is one", () => {
    expect(rolloutPace({ live: 20, total: 60, day: 45, rolloutDays: 90, target: 40 })).toMatchObject({ state: "on-track", target: 40, expected: 20 });
  });
  it("is done once the target is live, and past the last day expects all of it", () => {
    expect(rolloutPace({ live: 42, total: 42, day: 80, rolloutDays: 90 })?.state).toBe("done");
    expect(rolloutPace({ live: 30, total: 42, day: 120, rolloutDays: 90 })).toMatchObject({ state: "behind", expected: 42 });
  });
  it("says nothing before kickoff or with no practices", () => {
    expect(rolloutPace({ live: 0, total: 42, day: null, rolloutDays: 90 })).toBeNull();
    expect(rolloutPace({ live: 0, total: 0, day: 10, rolloutDays: 90 })).toBeNull();
  });
});
