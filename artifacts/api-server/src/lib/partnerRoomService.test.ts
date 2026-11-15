import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, pool: {} }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { parentIdFilter, practicesFromSheetValues, revopsSlackLines, sheetFilterIndex, slackMention } from "./partnerRoomService";
import { normalizePracticeStage, parseRoomKitAsset, roomCalendarIcs, roomKitInfo, setRoomKitAsset } from "./partnerRoom";

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

describe("launch kit: generated assets", () => {
  const blocks = [
    { id: "a", type: "hero", props: {} },
    { id: "w", type: "room-workspace", props: { partnerName: "MB2 Dental", partnerLogoUrl: "/api/storage/objects/uploads/logo", heroImageUrl: "", links: [{ title: "Hidden", url: "https://x.example.com", hidden: true }, { title: "Sign-up", url: "https://partners.example.com/mb2" }], assets: [{ key: "partnership-one-pager", kind: "pdf", title: "Partnership one-pager", fileUrl: "", hidden: true }, { kind: "text", title: "Announcement email", body: "Hello" }] } },
  ];
  it("reads what the generator needs from the page", () => {
    expect(roomKitInfo(blocks)).toMatchObject({ partnerName: "MB2 Dental", partnerLogoUrl: "/api/storage/objects/uploads/logo", heroImageUrl: "", signupUrl: "https://partners.example.com/mb2" });
    expect(roomKitInfo(blocks)!.assets).toEqual([{ key: "partnership-one-pager", title: "Partnership one-pager", kind: "pdf", hasFile: false, hidden: true }, { key: "announcement-email", title: "Announcement email", kind: "text", hasFile: true, hidden: false }]);
    expect(roomKitInfo([{ type: "hero" }])).toBeNull();
  });
  it("only accepts a file in this app's own storage", () => {
    const ok = { key: "social-image-1", kind: "image", title: "Social graphic", fileUrl: "/api/storage/objects/uploads/abc-123" };
    expect(parseRoomKitAsset(ok)).toMatchObject({ key: "social-image-1", kind: "image" });
    expect(parseRoomKitAsset({ ...ok, fileUrl: "https://evil.example/x.png" })).toBeNull();
    expect(parseRoomKitAsset({ ...ok, fileUrl: "/api/storage/../secrets" })).toBeNull();
    expect(parseRoomKitAsset({ ...ok, fileUrl: "javascript:alert(1)" })).toBeNull();
    expect(parseRoomKitAsset({ ...ok, kind: "text" })).toBeNull();
    expect(parseRoomKitAsset({ ...ok, key: "Bad Key" })).toBeNull();
  });
  it("fills the matching kit entry and shows it, or adds one, and touches nothing else", () => {
    const filled = setRoomKitAsset(blocks, { key: "partnership-one-pager", kind: "pdf", title: "Partnership one-pager", fileUrl: "/api/storage/objects/uploads/pdf1" }) as typeof blocks;
    const assets = (filled[1].props as { assets: Record<string, unknown>[] }).assets;
    expect(assets[0]).toMatchObject({ key: "partnership-one-pager", fileUrl: "/api/storage/objects/uploads/pdf1", hidden: false, title: "Partnership one-pager" });
    expect(assets).toHaveLength(2);
    expect(filled[0]).toBe(blocks[0]);
    expect((filled[1].props as { partnerName: string }).partnerName).toBe("MB2 Dental");
    const added = setRoomKitAsset(blocks, { key: "social-image-2", kind: "image", title: "Social graphic, square", description: "1080", fileUrl: "/api/storage/objects/uploads/img2" }) as typeof blocks;
    expect((added[1].props as { assets: Record<string, unknown>[] }).assets[2]).toEqual({ key: "social-image-2", kind: "image", title: "Social graphic, square", description: "1080", fileUrl: "/api/storage/objects/uploads/img2" });
    expect(setRoomKitAsset([{ type: "hero" }], { key: "x-y", kind: "pdf", title: "X", fileUrl: "/api/storage/a" })).toBeNull();
  });
});
