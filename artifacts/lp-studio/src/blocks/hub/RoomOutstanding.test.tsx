// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OutstandingView, outstandingSections, ownerSide, roomMeetingActionKey, sortOutstanding, type OutstandingItem } from "./RoomOutstanding";
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

describe("Outstanding in sections", () => {
  afterEach(cleanup);
  const mk = (id: string, source: OutstandingItem["source"], side: OutstandingItem["side"], overdue = false): OutstandingItem => ({ id, title: `Item ${id}`, source, side, overdue, module: "plan" });
  const items: OutstandingItem[] = [
    mk("m1", "Meeting", "us"),
    mk("p1", "Action plan", "you"),
    mk("p2", "Action plan", "you", true),
    mk("s1", "Setup", "you"),
    mk("r1", "Request", "us"),
    mk("k1", "Marketing plan", "both"),
  ];

  it("lays the items out: overdue first, then a section per kind in a fixed order, empty ones left out", () => {
    expect(outstandingSections(items, "all").map((s) => [s.key, s.items.map((i) => i.id)])).toEqual([
      ["overdue", ["p2"]],
      ["Setup", ["s1"]],
      ["Request", ["r1"]],
      ["Action plan", ["p1"]],
      ["Marketing plan", ["k1"]],
      ["Meeting", ["m1"]],
    ]);
    expect(outstandingSections(items, "us").map((s) => s.key)).toEqual(["Request", "Meeting"]);
    expect(outstandingSections([], "all")).toEqual([]);
  });

  const view = (isTeam: boolean, list = items) =>
    render(<OutstandingView items={list} ourName="Dandy" theirName="Acme" isTeam={isTeam} canAct onOpen={() => {}} onTick={async () => null} onApprove={async () => null} />);

  it("a customer starts on their own items; the filter shows each side's count and switches", () => {
    view(false);
    expect(screen.getByRole("button", { name: /Waiting on you/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Item r1")).toBeNull();
    expect(screen.getByText("Getting started")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Waiting on Dandy/ }));
    expect(screen.getByText("Item r1")).toBeTruthy();
    expect(screen.queryByText("Item p1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(screen.getByText("Item p1")).toBeTruthy();
    // Under All, each line says whose move it is.
    expect(document.querySelector('[data-room-outstanding-side="us"]')?.textContent).toBe("Dandy");
  });

  it("the team starts on All; the customer is named", () => {
    view(true);
    expect(screen.getByRole("button", { name: /^All/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Waiting on Acme/ })).toBeTruthy();
  });

  it("long sections show a few with Show all, and big later sections start folded but open on click", () => {
    const many = [mk("s1", "Setup", "you"), ...Array.from({ length: 12 }, (_, n) => mk(`p${n}`, "Action plan", "you")), ...Array.from({ length: 9 }, (_, n) => mk(`m${n}`, "Meeting", "you"))];
    view(false, many);
    // Action plan (the second section) is open but trimmed.
    expect(screen.getByText("Show all 12")).toBeTruthy();
    expect(screen.queryByText("Item p6")).toBeNull();
    fireEvent.click(screen.getByText("Show all 12"));
    expect(screen.getByText("Item p11")).toBeTruthy();
    // Meeting action items (the third, and big) start folded.
    expect(screen.queryByText("Item m0")).toBeNull();
    fireEvent.click(screen.getByText("Meeting action items"));
    expect(screen.getByText("Item m0")).toBeTruthy();
  });
});
