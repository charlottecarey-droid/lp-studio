import { describe, expect, it } from "vitest";
import { extendRoomStage, parseRoomStage, roomStageInfo, setRoomStage, waveKey } from "./partnerRoomStage";

const hub = (props: Record<string, unknown>) => [{ type: "hero", props: {} }, { type: "room-workspace", props: { partnerName: "MB2", ...props } }];
const now = new Date("2026-11-20T15:00:00Z");

describe("hub stage", () => {
  it("starts in rollout and asks to move on once the rollout has run its length", () => {
    expect(roomStageInfo(hub({ kickoffDate: "2026-11-01" }), now)).toMatchObject({ stage: "rollout", day: 20, rolloutDays: 90, prompt: false, stageSince: null });
    expect(roomStageInfo(hub({ kickoffDate: "2026-08-23" }), now)).toMatchObject({ day: 90, prompt: true });
    expect(roomStageInfo(hub({ kickoffDate: "2026-08-01", rolloutDays: 120 }), now)).toMatchObject({ day: 112, prompt: false });
    expect(roomStageInfo(hub({}), now)).toMatchObject({ day: null, prompt: false });
    expect(roomStageInfo([{ type: "hero" }], now)).toBeNull();
  });

  it("moving on records the day and stops the asking; moving back clears it", () => {
    const moved = setRoomStage(hub({ kickoffDate: "2026-08-01", stageExtendUntil: "2026-12-01" }), { stage: "expansion", timelineView: "waves", waves: [] }, now)!;
    expect(roomStageInfo(moved, now)).toMatchObject({ stage: "expansion", stageSince: "2026-11-20", extendUntil: null, prompt: false, timelineView: "waves" });
    // Saving again later (waves edited) keeps the day it moved.
    const later = setRoomStage(moved, { stage: "expansion", timelineView: "practices", waves: [{ key: "1", name: "Wave 1", start: "", target: "2027-03-15" }] }, new Date("2026-12-24T00:00:00Z"))!;
    expect(roomStageInfo(later, now)).toMatchObject({ stageSince: "2026-11-20", waves: [{ key: "1", name: "Wave 1", start: "", target: "2027-03-15" }] });
    const back = setRoomStage(later, { stage: "rollout", timelineView: "practices", waves: [] }, now)!;
    expect(roomStageInfo(back, now)).toMatchObject({ stage: "rollout", stageSince: null, prompt: true });
    expect((back[1] as { props: Record<string, unknown> }).props.partnerName).toBe("MB2");
    expect(setRoomStage([{ type: "hero" }], { stage: "expansion", timelineView: "waves", waves: [] })).toBeNull();
  });

  it("extend keeps it in rollout and asks again after the wait", () => {
    const put = extendRoomStage(hub({ kickoffDate: "2026-08-01" }), undefined, now)!;
    expect(roomStageInfo(put, now)).toMatchObject({ stage: "rollout", extendUntil: "2026-12-20", prompt: false });
    expect(roomStageInfo(put, new Date("2026-12-21T12:00:00Z"))).toMatchObject({ prompt: true });
    expect(roomStageInfo(extendRoomStage(hub({ kickoffDate: "2026-08-01" }), 2, now), now)!.extendUntil).toBe("2026-11-27");
  });

  it("reads waves, drops duplicates and bad dates, and refuses one that ends before it starts", () => {
    const parsed = parseRoomStage({ stage: "expansion", timelineView: "waves", waves: [{ key: "1", name: " Wave 1 ", start: "2026-12-01", target: "2027-02-28" }, { key: "Wave 1", name: "Again" }, { name: "North", target: "soon" }, null, { name: "" }] });
    expect(parsed).toEqual({ ok: true, value: { stage: "expansion", timelineView: "waves", waves: [{ key: "1", name: "Wave 1", start: "2026-12-01", target: "2027-02-28" }, { key: "North", name: "North", start: "", target: "" }] } });
    expect(parseRoomStage({ waves: [{ name: "W", start: "2027-02-01", target: "2027-01-01" }] })).toEqual({ ok: false, error: "W ends before it starts." });
    expect(parseRoomStage({ stage: "growth" })).toMatchObject({ ok: false });
    expect(parseRoomStage({})).toEqual({ ok: true, value: { stage: "rollout", timelineView: "practices", waves: [] } });
    expect(waveKey("Wave 1")).toBe(waveKey(" 1 "));
  });
});
