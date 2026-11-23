import { describe, expect, it } from "vitest";
import { waveBreakdowns } from "./partnerRoomService";

const row = (wave: string, stage: string, region: string | null, n: number, scannerKnown = 0, scanners = 0, scannerPractices = 0) => ({ wave, stage, region, n, scanners, scannerPractices, scannerKnown });

describe("waveBreakdowns", () => {
  it("folds (wave, stage, region) counts into one breakdown per wave, with \"\" for no wave", () => {
    const b = waveBreakdowns([row("1", "live", "AZ", 6), row("1", "not_started", "AZ", 2), row("1", "live", "CA", 1, 1, 2, 1), row("", "scheduling", null, 4)]);
    expect(b.get("1")).toEqual({
      byStage: { live: 7, not_started: 2 },
      byRegion: [{ region: "AZ", total: 8, live: 6, trained: 6 }, { region: "CA", total: 1, live: 1, trained: 1 }],
      scanners: { total: 2, practices: 1 },
    });
    expect(b.get("")).toEqual({ byStage: { scheduling: 4 }, byRegion: [] });
  });
});
