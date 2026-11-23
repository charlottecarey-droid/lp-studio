import { describe, expect, it } from "vitest";
import { setTeamOwner } from "./partnerRoomTeam";

const hub = (ours: Record<string, unknown>[]) => [{ type: "room-workspace", props: { team: [{ title: "Dandy team", members: ours }, { title: "[Partner] team", members: [{ name: "Pat Partner", role: "COO" }] }] } }];
const ours = (blocks: unknown[] | null) => ((blocks as { props: { team: { members: Record<string, unknown>[] }[] } }[])[0].props.team[0].members);

describe("setTeamOwner", () => {
  it("swaps the Account owner for the sheet's owner, keeping everyone else", () => {
    const next = setTeamOwner(hub([{ name: "Faith Iacone", role: "Account owner", email: "faith@x.com" }, { name: "Sam Support", role: "Implementation" }]), { name: "Nifemi Ojutalayo", email: "Nifemi@X.com" });
    expect(ours(next)).toEqual([{ name: "Nifemi Ojutalayo", role: "Account owner", email: "nifemi@x.com" }, { name: "Sam Support", role: "Implementation" }]);
  });
  it("drops the old owner's email when the new one's isn't known", () => {
    expect(ours(setTeamOwner(hub([{ name: "Old Owner", role: "Account owner", email: "old@x.com" }]), { name: "New Owner" }))).toEqual([{ name: "New Owner", role: "Account owner" }]);
  });
  it("adds the owner first when there's no Account owner yet; no change when it already names them", () => {
    expect(ours(setTeamOwner(hub([{ name: "Sam Support", role: "Implementation" }]), { name: "Molly Reilly" }))[0]).toEqual({ name: "Molly Reilly", role: "Account owner" });
    expect(setTeamOwner(hub([{ name: "Molly Reilly", role: "Account owner" }]), { name: "molly reilly" })).toBeNull();
    expect(setTeamOwner(hub([]), { name: " " })).toBeNull();
  });
});
