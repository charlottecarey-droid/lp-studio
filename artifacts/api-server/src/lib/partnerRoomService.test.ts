import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, pool: {} }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));

import { parentIdFilter, parentNameFilter, practicesFromSheetValues, revopsSlackLines, sheetFilterIndex, slackMention } from "./partnerRoomService";
import { gateRoomBlocks, roomRequiresEmail, roomWorkspaceProps, extractRoomTasks, fillAccountName, normalizePracticeStage, parsePracticeRow, parseRoomKitAsset, resolveRoomBlocks, roomCalendarIcs, roomKitInfo, setRoomKitAsset } from "./partnerRoom";

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

  it("falls back to the parent account NAME when there is no ID, however the name is decorated", () => {
    const sheet = [...SHEET, ["E", "Uptown Smiles", "TX", "New", "", "MB2 Dental-HQ"], ["F", "Not Ours", "TX", "New", "", "MB2 Dental Partners West"]];
    const filter = parentNameFilter(sheet, "MB2 Dental -HQ");
    expect(filter).toMatchObject({ column: "Parent Account Name", mode: "account", value: "MB2 Dental" });
    // The whole name must match: "MB2 Dental Partners West" is another account.
    expect(practicesFromSheetValues(sheet, filter).map((r) => r.name)).toEqual(["Smile Dallas", "Lakeside Family", "Uptown Smiles"]);
    expect(parentNameFilter([["Account Name"], ["X"]], "MB2 Dental")).toBeNull();
    expect(parentNameFilter(sheet, "")).toBeNull();
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
    expect(roomKitInfo(blocks)!.assets).toEqual([{ key: "partnership-one-pager", title: "Partnership one-pager", kind: "pdf", hasFile: false, hidden: true, url: "" }, { key: "announcement-email", title: "Announcement email", kind: "text", hasFile: true, hidden: false, url: "" }]);
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

describe("the account name as a variable", () => {
  const page = (props: Record<string, unknown>) => [{ id: "w", type: "room-workspace", props }];
  it("fills both spellings of both variables", () => {
    expect(fillAccountName("Welcome, {{account}}. [Partner name] and Dandy; every {{ account_short }} practice, every [partner] team.", "MB2 Dental", "MB2")).toBe("Welcome, MB2 Dental. MB2 Dental and Dandy; every MB2 practice, every MB2 team.");
    expect(fillAccountName("No variables here [see note]", "MB2 Dental", "MB2")).toBe("No variables here [see note]");
    expect(fillAccountName("{{account_name}}, {{company}} and {{ company_name }}", "MB2 Dental", "MB2")).toBe("MB2 Dental, MB2 Dental and MB2 Dental");
  });
  it("fills every text on the page from the customer name, and leaves the name fields alone", () => {
    const blocks = page({ partnerName: "MB2 Dental", partnerShort: "MB2", planIntro: "Every milestone has an owner at Dandy and at [Partner].", assets: [{ kind: "text", title: "Announcement email", body: "{{account}} is partnering with Dandy." }], planGroups: [{ title: "P", rows: [{ task: "Kickoff with [Partner name]", customerAction: "check" }] }] });
    const out = resolveRoomBlocks(blocks) as typeof blocks;
    expect(out[0].props).toMatchObject({ partnerName: "MB2 Dental", partnerShort: "MB2", planIntro: "Every milestone has an owner at Dandy and at MB2." });
    expect(roomKitInfo(out)!.texts[0].body).toBe("MB2 Dental is partnering with Dandy.");
    expect([...extractRoomTasks(out).values()].map((t) => t.title)).toEqual(["Kickoff with MB2 Dental"]);
    expect(blocks[0].props.planIntro).toContain("[Partner]"); // the stored page keeps its variables
  });
  it("uses the full name when there is no short name, and waits while the name is blank or still a placeholder", () => {
    expect((resolveRoomBlocks(page({ partnerName: "Heartland Dental", planIntro: "At [Partner]." })) as unknown as { props: { planIntro: string } }[])[0].props.planIntro).toBe("At Heartland Dental.");
    for (const name of ["", "[Partner name]", "{{account}}"]) {
      const blocks = page({ partnerName: name, planIntro: "At [Partner]." });
      expect(resolveRoomBlocks(blocks)).toEqual(blocks);
    }
    const other = [{ id: "h", type: "hero", props: { title: "[Partner]" } }];
    expect(resolveRoomBlocks(other)[0]).toBe(other[0]);
  });
});

describe("practice rows with scanner and manager data", () => {
  it("reads Salesforce's scanner columns and a regional manager", () => {
    expect(parsePracticeRow({ "account name": "Lakeside Family", status: "Ramped", "scanner delivered": "3/4/2026", "scanner connected": "3/9/2026", "regional manager": "Dana Ruiz" })).toMatchObject({ name: "Lakeside Family", stage: "live", stageGiven: true, scannerSent: "3/4/2026", scannerActivated: "3/9/2026", regionalManager: "Dana Ruiz", scannerCount: null });
  });
  it("reads the scanner tracker's office breakdown without touching the rollout stage", () => {
    const row = parsePracticeRow({ office: "Ohio Cosmetic Dentists", status: "Active", "current total": "4", "trios 3": "1", "trios 5": "0", "dandy vision": "3", "first opp": "2023-03-28", "last opp": "2026-11-13" })!;
    expect(row).toMatchObject({ name: "Ohio Cosmetic Dentists", scannerCount: 4, scannerModels: "1 Trios 3 · 3 Dandy Vision", scannerSent: "2023-03-28" });
    // "Active" there means the office is open, not that it is live in this rollout.
    expect(row.stageGiven).toBe(false);
    expect(parsePracticeRow({ office: "No scanners yet", "current total": "0" })).toMatchObject({ scannerCount: 0, scannerModels: null });
    expect(parsePracticeRow({ office: "Odd", "current total": "lots" })!.scannerCount).toBeNull();
  });
});

describe("a hub that asks for an email first", () => {
  const hub = (extra: object = {}) => [
    { id: "n", type: "nav-header", props: { logoText: "Dandy" } },
    { id: "w", type: "room-workspace", props: { partnerName: "MB2 Dental", title: "launch plan", heroImageUrl: "/room/default-cover.jpg", coverStyle: "split", planGroups: [{ title: "P", rows: [{ task: "Secret milestone" }] }], team: [{ title: "Dandy", members: [{ name: "Rae Rep", email: "rae@vendor.com" }] }], assets: [{ kind: "text", title: "Email", body: "Confidential copy" }], scheduleUrl: "https://calendly.com/rae", ...extra } },
  ];

  it("sends a stranger the cover and nothing under it", () => {
    const gated = gateRoomBlocks(hub({ requireEmail: true })) as { type: string; props: Record<string, unknown> }[];
    expect(gated[0]).toEqual(hub()[0]); // other blocks pass through
    expect(gated[1].props).toEqual({ requireEmail: true, gated: true, partnerName: "MB2 Dental", title: "launch plan", heroImageUrl: "/room/default-cover.jpg", coverStyle: "split" });
    const sent = JSON.stringify(gated);
    for (const secret of ["Secret milestone", "rae@vendor.com", "Confidential copy", "calendly.com"]) expect(sent).not.toContain(secret);
  });

  it("leaves an open hub, and pages with no hub, exactly as they are", () => {
    const open = hub();
    expect(gateRoomBlocks(open)).toBe(open);
    expect(roomRequiresEmail(open)).toBe(false);
    expect(roomRequiresEmail(hub({ requireEmail: true }))).toBe(true);
    expect(roomRequiresEmail(hub({ requireEmail: "yes" }))).toBe(false); // only a real true turns it on
    expect(gateRoomBlocks(null)).toBeNull();
    expect(roomWorkspaceProps(hub({ requireEmail: true }))).toMatchObject({ partnerName: "MB2 Dental", scheduleUrl: "https://calendly.com/rae" });
    expect(roomWorkspaceProps([{ type: "hero" }])).toBeNull();
  });
});
