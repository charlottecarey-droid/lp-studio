import { describe, expect, it } from "vitest";
import { mergeTeamMembers, parseTeamList } from "./room-team-import";

describe("team list import", () => {
  it("reads named columns in any order, with a team column", () => {
    const { people, skipped } = parseTeamList("Email,Title,Name,Team\ndana@mb2.com,COO,Dana Ruiz,MB2 Dental\nsam@dandy.com,Account Manager,Sam Rep,Dandy\n,,,\ndana@mb2.com,COO,Dana Again,MB2", { ourName: "Dandy" });
    expect(people).toEqual([
      { name: "Dana Ruiz", role: "COO", email: "dana@mb2.com", side: "partner" },
      { name: "Sam Rep", role: "Account Manager", email: "sam@dandy.com", side: "ours" },
    ]);
    expect(skipped).toBe(2);
  });

  it("joins first and last name, and reads tabs pasted from a sheet", () => {
    expect(parseTeamList("First Name\tLast Name\tJob Title\tWork Email\nDana\tRuiz\tChief Operating Officer\tDana@MB2.com").people).toEqual([{ name: "Dana Ruiz", role: "Chief Operating Officer", email: "dana@mb2.com" }]);
  });

  it("reads a plain pasted list with no column names", () => {
    expect(parseTeamList('Dana Ruiz, COO, dana@mb2.com\nKai Lee <kai@mb2.com>\n"Ruiz, Pat", Director of Ops\nJust A Name').people).toEqual([
      { name: "Dana Ruiz", role: "COO", email: "dana@mb2.com" },
      { name: "Kai Lee", email: "kai@mb2.com" },
      { name: "Ruiz, Pat", role: "Director of Ops" },
      { name: "Just A Name" },
    ]);
  });

  it("adds people once and clears the template's placeholders", () => {
    const current = [{ name: "[Name]", role: "Executive Sponsor" }, { name: "Dana Ruiz", role: "COO", email: "dana@mb2.com" }];
    const r = mergeTeamMembers(current, [{ name: "Dana R.", email: "DANA@mb2.com".toLowerCase() }, { name: "Kai Lee", role: "Ops", email: "kai@mb2.com" }]);
    expect(r.added).toBe(1);
    expect(r.members.map((m) => m.name)).toEqual(["Dana Ruiz", "Kai Lee"]);
    expect(mergeTeamMembers(current, [{ name: "dana ruiz" }])).toEqual({ members: current, added: 0 });
  });
});
