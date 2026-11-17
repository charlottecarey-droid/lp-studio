import { describe, expect, it } from "vitest";
import { ownerSide, roomMeetingActionKey, sortOutstanding, type OutstandingItem } from "./RoomOutstanding";
import { flagOrText, updatedLabel } from "./RoomScorecard";

describe("outstanding items", () => {
  it("keys a meeting action the way the server does, for typed and synced meetings", () => {
    expect(roomMeetingActionKey("m3", "Approve the education event venue")).toBe("ma-m3-approve-the-education-event-venue");
    expect(roomMeetingActionKey("sync-412", "Send the roster!")).toBe("ev-412-send-the-roster");
    expect(roomMeetingActionKey("Weekly Sync #2", "A".repeat(80))).toBe(`ma-weekly-sync-2-${"a".repeat(48)}`);
  });

  it("works out whose move it is from the owner's name", () => {
    const ours = ["Dandy", "Sam Rep"];
    const theirs = ["MB2", "MB2 Dental", "Dana Ruiz"];
    expect(ownerSide("Sam Rep", ours, theirs)).toBe("us");
    expect(ownerSide("Dandy Marketing", ours, theirs)).toBe("us");
    expect(ownerSide("MB2 Operations", ours, theirs)).toBe("you");
    expect(ownerSide("dana ruiz", ours, theirs)).toBe("you");
    expect(ownerSide("Levi", ours, theirs)).toBe("both");
    expect(ownerSide("", ours, theirs)).toBe("both");
    expect(ownerSide("—", ours, theirs)).toBe("both");
  });

  it("puts overdue first, then the customer's, keeping the order otherwise", () => {
    const item = (id: string, side: OutstandingItem["side"], overdue = false): OutstandingItem => ({ id, title: id, source: "Meeting", side, overdue, module: "meetings" });
    expect(sortOutstanding([item("a", "us"), item("b", "you"), item("c", "us", true), item("d", "both"), item("e", "you")]).map((i) => i.id)).toEqual(["c", "b", "e", "d", "a"]);
  });
});

describe("scorecard yes/no cells", () => {
  it("shows a tick for yes, nothing for no, and anything else as written", () => {
    for (const v of ["true", "TRUE", "1", "Yes"]) expect(flagOrText(v)).toEqual({ tick: true, text: "" });
    for (const v of ["false", "0", "No"]) expect(flagOrText(v)).toEqual({ tick: false, text: "" });
    expect(flagOrText("11/2/2026")).toEqual({ tick: false, text: "11/2/2026" });
    expect(flagOrText(null)).toEqual({ tick: false, text: "" });
  });
});

describe("scorecard freshness", () => {
  it("says when the list was last refreshed, in plain words", () => {
    const now = new Date(2026, 10, 17, 9, 30);
    expect(updatedLabel(new Date(2026, 10, 17, 8, 5).toISOString(), now)).toMatch(/^today, 8:05/);
    expect(updatedLabel(new Date(2026, 10, 16, 21, 14).toISOString(), now)).toMatch(/^Nov 16, 9:14/);
    expect(updatedLabel("not a date", now)).toBe("");
  });
});
