import { describe, expect, it } from "vitest";
import { fillRegionalsWord, resolveRoomBlocks, extractRoomTasks } from "./partnerRoom";
import { collectDigest } from "./partnerRoomDigest";

describe("the customer's word for regional managers", () => {
  it("keeps the sentence's capitals and the acronym's", () => {
    expect(fillRegionalsWord("Regional Managers", "DBOs")).toBe("DBOs");
    expect(fillRegionalsWord("Regional managers book their 1:1s", "DBOs")).toBe("DBOs book their 1:1s");
    expect(fillRegionalsWord("Introduce your regional managers to your Dandy team", "RDs")).toBe("Introduce your RDs to your Dandy team");
    expect(fillRegionalsWord("Regional manager", "RDs")).toBe("RD");
    expect(fillRegionalsWord("For regional leaders and practices", "regional directors")).toBe("For regional directors and practices");
    expect(fillRegionalsWord("Regional Managers", "regional directors")).toBe("Regional Directors");
    expect(fillRegionalsWord("Regional managers introduced", "Regional Directors")).toBe("Regional directors introduced");
    expect(fillRegionalsWord("your regional manager", "area leads")).toBe("your area lead");
  });

  it("leaves text alone without a word, and other regional phrases alone", () => {
    expect(fillRegionalsWord("Regional managers", "")).toBe("Regional managers");
    expect(fillRegionalsWord("Regional events by territory", "DBOs")).toBe("Regional events by territory");
  });

  it("reaches tasks and the hub's text, even before the customer's name is set; the word itself is not rewritten", () => {
    const blocks = [{ type: "room-workspace", props: { partnerName: "", regionalsNoun: "DBOs", planGroups: [{ title: "Align", checkpoint: "Regional managers introduced", rows: [{ key: "r", task: "Regional managers book their 1:1s", partnerOwner: "Regional Managers", customerAction: "check" }] }] } }];
    const out = resolveRoomBlocks(blocks) as { props: Record<string, any> }[];
    expect(out[0].props.planGroups[0]).toMatchObject({ checkpoint: "DBOs introduced", rows: [{ task: "DBOs book their 1:1s", partnerOwner: "DBOs" }] });
    expect(out[0].props.regionalsNoun).toBe("DBOs");
    expect(extractRoomTasks(out).get("r")?.title).toBe("DBOs book their 1:1s");
  });

  it("names the milestone in the weekly digest in their word", () => {
    const blocks = [{ type: "room-workspace", props: { partnerName: "MB2", regionalsNoun: "DBOs", planGroups: [{ title: "Align", rows: [{ key: "regional-kickoff", task: "Introduce your regional managers", customerAction: "check" }] }] } }];
    const d = collectDigest(blocks, { tasks: [], requests: [], choices: [], wins: [], practices: { total: 0, byStage: {} } }, new Date("2026-11-22T12:00:00Z"))!;
    expect(d.milestones.map((m) => m.label)).toEqual(["DBOs introduced"]);
  });
});
