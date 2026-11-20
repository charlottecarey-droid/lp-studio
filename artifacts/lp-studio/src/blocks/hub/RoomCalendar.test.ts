import { describe, expect, it } from "vitest";
import { eventKinds, groupTrainings, syncedEventToRoomEvent, type RoomEvent } from "../BlockRoomWorkspace";

const training = (id: number, day: string, practice: string) => syncedEventToRoomEvent({ id: -id, title: `Training: ${practice}`, startsAt: `${day}T00:00:00.000Z`, endsAt: null, allDay: true, kind: "training" });

describe("hub calendar", () => {
  it("a practice training from the practice list is a training on its own day", () => {
    expect(training(7, "2026-12-03", "Main Street Dental")).toMatchObject({ key: "sync--7", date: "2026-12-03", title: "Training: Main Street Dental", kind: "training", practice: "Main Street Dental" });
    expect(syncedEventToRoomEvent({ id: 4, title: "Kickoff", startsAt: "2026-12-03T15:00:00.000Z", endsAt: null, allDay: false }).kind).toBe("meeting");
  });

  it("several trainings on one day become one row naming the practices; one stays as it is; nothing else moves", () => {
    const typed: RoomEvent = { key: "t", date: "2026-12-03", title: "Regional training", kind: "training" };
    const meeting: RoomEvent = { key: "m", date: "2026-12-03", title: "Business review", kind: "meeting" };
    const out = groupTrainings([meeting, training(2, "2026-12-03", "Summit Dental"), typed, training(1, "2026-12-03", "Main Street Dental"), training(3, "2026-12-09", "Lakeside")]);
    expect(out.map((e) => e.title)).toEqual(["Business review", "2 trainings", "Regional training", "Training: Lakeside"]);
    expect(out[1]).toMatchObject({ key: "trainings-2026-12-03", date: "2026-12-03", kind: "training", practices: ["Main Street Dental", "Summit Dental"] });
    expect(groupTrainings([])).toEqual([]);
  });

  it("offers a filter for the kinds a calendar holds, in a fixed order", () => {
    expect(eventKinds([{ key: "a", date: "2026-12-01", title: "x", kind: "training" }, { key: "b", date: "2026-12-01", title: "y", kind: "meeting" }, { key: "c", date: "2026-12-01", title: "z" }, { key: "d", date: "2026-12-01", title: "h", kind: "milestone", hidden: true }])).toEqual(["meeting", "training"]);
  });
});
