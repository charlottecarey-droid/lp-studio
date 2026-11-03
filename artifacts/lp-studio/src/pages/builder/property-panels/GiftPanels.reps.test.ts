import { describe, expect, it } from "vitest";
import { mergeTeamMembers, teamMemberCalendar, type TeamMember } from "./GiftPanels";

describe("gift note rep picker — Sales Reps library records", () => {
  it("reads the booking link from chilipiperUrl, else the older calendlyUrl field", () => {
    expect(teamMemberCalendar({ id: 1, name: "A", content: { chilipiperUrl: "https://cp/a" } })).toBe("https://cp/a");
    expect(teamMemberCalendar({ id: 2, name: "B", content: { chilipiperUrl: "", calendlyUrl: "https://cp/b" } })).toBe("https://cp/b");
    expect(teamMemberCalendar({ id: 3, name: "C", content: {} })).toBe("");
  });

  it("merges duplicate records for one rep, keeping the link from one and the headshot from the other", () => {
    const rows: TeamMember[] = [
      { id: 34, name: "Harrison Corman", content: { name: "Harrison Corman", role: "Business Development", email: "harrison.corman@x.com", calendlyUrl: "https://cp/harrison" } },
      { id: 1626, name: "Harrison Corman", content: { name: "Harrison Corman", role: "Business Development", email: "harrison.corman@x.com", chilipiperUrl: "", photo: "/img/harrison.webp" } },
      { id: 19, name: "Dan MacAdam", content: { name: "Dan MacAdam", role: "Strat AE", email: "dan@x.com", calendlyUrl: "https://cp/dan" } },
    ];
    const merged = mergeTeamMembers(rows);
    expect(merged.map((m) => m.name)).toEqual(["Dan MacAdam", "Harrison Corman"]);
    const harrison = merged[1];
    expect(teamMemberCalendar(harrison)).toBe("https://cp/harrison");
    expect(harrison.content?.photo).toBe("/img/harrison.webp");
  });
});
