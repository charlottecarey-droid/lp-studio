import { describe, expect, it } from "vitest";
import { fillRegionalsWord } from "./room-words";
import { resolveRoomProps, type RoomWorkspaceBlockProps } from "../BlockRoomWorkspace";

describe("the customer's word for regional managers on the hub", () => {
  it("matches the server's rule", () => {
    expect(fillRegionalsWord("Regional Managers", "DBOs")).toBe("DBOs");
    expect(fillRegionalsWord("Regional managers book their 1:1s", "regional directors")).toBe("Regional directors book their 1:1s");
    expect(fillRegionalsWord("Regional manager", "RDs")).toBe("RD");
    expect(fillRegionalsWord("Regional managers", "")).toBe("Regional managers");
  });

  it("is applied to what the hub shows, and editing still finds the saved text", () => {
    const row = { key: "r", task: "Regional managers book their 1:1s", partnerOwner: "Regional Managers" };
    const raw = { partnerName: "MB2", regionalsNoun: "DBOs", planGroups: [{ title: "Align", rows: [row] }] } as unknown as RoomWorkspaceBlockProps;
    const { props, rawOf } = resolveRoomProps(raw);
    const shown = props.planGroups![0].rows[0];
    expect(shown).toMatchObject({ task: "DBOs book their 1:1s", partnerOwner: "DBOs" });
    expect(rawOf.get(shown)).toBe(row);
    expect(props.regionalsNoun).toBe("DBOs");
  });
});
