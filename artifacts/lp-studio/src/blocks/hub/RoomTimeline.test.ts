import { describe, expect, it } from "vitest";
import { timelineWaves, waveKey } from "./RoomTimeline";
import { partnerSince } from "../BlockRoomWorkspace";
import { daysAgoLabel } from "./RoomScorecard";
import { hubStageText } from "../../pages/sales/sales-partner-hubs-shared";

describe("post-rollout timeline", () => {
  it("puts the named waves first with their dates and counts, then any other wave the practice list uses", () => {
    const waves = timelineWaves(
      [{ key: "1", name: "Wave 1", target: "2027-01-31" }, { key: "Wave 2", name: "Carolinas", start: "2027-02-01" }],
      [{ wave: "2", total: 20, live: 12 }, { wave: "Wave 1", total: 22, live: 22 }, { wave: "3", total: 9, live: 0 }, { wave: "North", total: 4, live: 1 }],
    );
    expect(waves).toEqual([
      { key: "1", name: "Wave 1", start: "", target: "2027-01-31", total: 22, live: 22, state: "done" },
      { key: "Wave 2", name: "Carolinas", start: "2027-02-01", target: "", total: 20, live: 12, state: "current" },
      { key: "3", name: "Wave 3", start: "", target: "", total: 9, live: 0, state: "upcoming" },
      { key: "North", name: "North", start: "", target: "", total: 4, live: 1, state: "upcoming" },
    ]);
  });

  it("a wave with no practices yet is not done; a hub with no waves has none", () => {
    expect(timelineWaves([{ key: "1", name: "Wave 1" }], [])).toEqual([{ key: "1", name: "Wave 1", start: "", target: "", total: 0, live: 0, state: "current" }]);
    expect(timelineWaves(undefined, undefined)).toEqual([]);
    expect(waveKey(" Wave 2 ")).toBe("2");
  });

  it("the cover says when the partnership began", () => {
    expect(partnerSince("2026-10-25")).toBe("Oct 2026");
    expect(partnerSince("")).toBe("");
    expect(partnerSince("soon")).toBe("");
  });

  it("the Partner Hubs list shows the day during the rollout and practices live after it", () => {
    expect(hubStageText({ day: 48, stage: "rollout", practices: { total: 60, live: 28 } })).toBe("Day 48");
    expect(hubStageText({ day: null, practices: null })).toBe("Not started");
    expect(hubStageText({ day: 120, stage: "expansion", practices: { total: 60, live: 28 } })).toBe("28 of 60 live");
    expect(hubStageText({ day: 120, stage: "expansion", practices: null })).toBe("Expansion");
  });

  it("says how long since a practice last ordered", () => {
    const now = new Date(2026, 10, 20);
    expect(daysAgoLabel("2026-11-20", now)).toEqual({ text: "today", days: 0 });
    expect(daysAgoLabel("2026-11-17", now)).toEqual({ text: "3 days ago", days: 3 });
    expect(daysAgoLabel("2026-10-09", now)).toEqual({ text: "6 weeks ago", days: 42 });
    expect(daysAgoLabel("2026-05-20", now)!.text).toBe("6 months ago");
    expect(daysAgoLabel(null, now)).toBeNull();
  });
});
