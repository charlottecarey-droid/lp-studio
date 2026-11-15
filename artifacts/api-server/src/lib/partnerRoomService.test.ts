import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, pool: {} }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { parentIdFilter, practicesFromSheetValues, revopsSlackLines, sheetFilterIndex, slackMention } from "./partnerRoomService";
import { normalizePracticeStage, roomCalendarIcs } from "./partnerRoom";

const MB2 = "0015d000041HyXrAAK";
const SHEET = [
  ["Account Owner", "Account Name", "Billing State/Province", "Status", "Parent Account ID", "Parent Account Name"],
  ["A", "Smile Dallas", "TX", "Ramped", MB2, "MB2 Dental"],
  ["B", "Lakeside Family", "CO", "Onboarding", MB2.slice(0, 15), "MB2 Dental"],
  ["C", "Other DSO Office", "FL", "Ramping", "0015d00000ZZZZZAAA", "Someone Else"],
  ["D", "No Parent", "NY", "New", "", ""],
];

describe("a shared Salesforce sheet narrowed to one customer", () => {
  it("filters by the parent account ID column when the room has the account ID", () => {
    const filter = parentIdFilter(SHEET, MB2);
    expect(filter).toMatchObject({ column: "Parent Account ID", mode: "sfid" });
    const rows = practicesFromSheetValues(SHEET, filter);
    // 15- and 18-character forms of the same ID both match; other parents and blanks do not.
    expect(rows.map((r) => r.name)).toEqual(["Smile Dallas", "Lakeside Family"]);
    expect(rows[0]).toMatchObject({ state: "TX", stage: "live" });
    expect(rows[1]).toMatchObject({ stage: "training_booked" });
  });

  it("has no automatic filter without the column or without an account ID", () => {
    expect(parentIdFilter([["Account Name", "Status"], ["X", "New"]], MB2)).toBeNull();
    expect(parentIdFilter(SHEET, "")).toBeNull();
    expect(parentIdFilter(SHEET, "not-an-id")).toBeNull();
  });

  it("filters by a named column containing text, case-insensitively", () => {
    const filter = { column: "parent account name", value: "mb2" };
    expect(sheetFilterIndex(SHEET, filter)).toBe(5);
    expect(practicesFromSheetValues(SHEET, filter).map((r) => r.name)).toEqual(["Smile Dallas", "Lakeside Family"]);
    // A filter on a column the sheet doesn't have keeps nothing rather than everything.
    expect(practicesFromSheetValues(SHEET, { column: "Nope", value: "mb2" })).toEqual([]);
  });

  it("maps Salesforce statuses to room stages", () => {
    expect(normalizePracticeStage("Ramped")).toBe("live");
    expect(normalizePracticeStage("Ramping")).toBe("live");
    expect(normalizePracticeStage("Onboarding")).toBe("training_booked");
    expect(normalizePracticeStage("Pre-Onboarding")).toBe("scheduling");
  });
});

describe("RevOps in Slack", () => {
  it("turns an ID into a Slack mention", () => {
    expect(slackMention("S0123ABCD")).toBe("<!subteam^S0123ABCD>");
    expect(slackMention("<!subteam^S0123ABCD>")).toBe("<!subteam^S0123ABCD>");
    expect(slackMention("U0123ABCD")).toBe("<@U0123ABCD>");
    expect(slackMention("@revops")).toBe("");
    expect(slackMention(null)).toBe("");
  });

  it("writes the gap with the mention, and nothing when there is no gap", () => {
    expect(revopsSlackLines(null, "<@U1>", "MB2 Dental")).toEqual([]);
    expect(revopsSlackLines({ fileName: "list.csv", missing: [], matched: 3, uploaded: 3, doctors: null }, "<@U1>", "MB2 Dental")).toEqual([]);
    const lines = revopsSlackLines({ fileName: "list.csv", missing: ["Brand New Dental", "<!channel> Dental"], matched: 1, uploaded: 3, doctors: 12 }, "<!subteam^S0123ABCD>", "MB2 Dental");
    const text = lines.join("\n");
    expect(lines[0]).toContain("<!subteam^S0123ABCD>");
    expect(lines[0]).toContain("2 child accounts");
    expect(lines[0]).toContain("12 doctors");
    expect(text).toContain("• Brand New Dental");
    // A practice name can't smuggle in a mention of its own.
    expect(text).not.toContain("<!channel>");
  });
});

describe("calendar feed", () => {
  it("lists dated, visible events as all-day entries", () => {
    const ics = roomCalendarIcs([{ type: "room-workspace", props: { calendar: { events: [{ key: "kick", date: "2027-01-31", time: "2:00 pm CT", title: "Kickoff; sponsors, leads" }, { key: "h", date: "2027-02-01", title: "Hidden", hidden: true }, { key: "n", date: "TBD", title: "Undated" }] } } }], "MB2 Dental partnership")!;
    expect(ics).toContain("X-WR-CALNAME:MB2 Dental partnership");
    expect(ics).toContain(String.raw`SUMMARY:Kickoff\; sponsors\, leads`);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270131");
    expect(ics).toContain("DTEND;VALUE=DATE:20270201"); // month rollover
    expect(ics).toContain("DESCRIPTION:2:00 pm CT");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(roomCalendarIcs([{ type: "hero" }], "x")).toBeNull();
  });
});
