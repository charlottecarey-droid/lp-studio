import { describe, expect, it } from "vitest";
import { parseRoomOverviewHidden, roomOverviewHidden, setRoomOverviewHidden } from "./partnerRoom";

const blocks = [
  { id: "a", type: "hero", props: {} },
  { id: "b", type: "room-workspace", props: { partnerName: "Acme", hiddenOverview: ["feed"] } },
];

describe("hub Overview sections", () => {
  it("keeps only known sections, once, in the standard order", () => {
    expect(parseRoomOverviewHidden(["feed", "nope", "progress", "feed", 3])).toEqual(["progress", "feed"]);
    expect(parseRoomOverviewHidden("feed")).toEqual([]);
    expect(parseRoomOverviewHidden(undefined)).toEqual([]);
  });

  it("reads what a hub hides, and null for a page that is not a hub", () => {
    expect(roomOverviewHidden(blocks)).toEqual(["feed"]);
    expect(roomOverviewHidden([{ id: "a", type: "hero", props: {} }])).toBeNull();
  });

  it("changes only the hidden list on the hub block", () => {
    const next = setRoomOverviewHidden(blocks, ["next", "coming"]) as typeof blocks;
    expect(next[0]).toBe(blocks[0]);
    expect(next[1].props).toEqual({ partnerName: "Acme", hiddenOverview: ["next", "coming"] });
    expect(setRoomOverviewHidden([{ id: "a", type: "hero", props: {} }], [])).toBeNull();
  });
});
