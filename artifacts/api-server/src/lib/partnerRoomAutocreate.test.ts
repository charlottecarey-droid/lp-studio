import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpRoomPracticesTable: {}, salesAccountsTable: {}, salesContactsTable: {}, appUsersTable: {}, tenantMembersTable: {}, tenantsTable: {}, lpPagesTable: {}, lpRoomAutocreateAccountsTable: {}, lpRoomAutocreateTable: {}, lpRoomStandardAssetsTable: {}, lpRoomSettingsTable: {}, lpRoomUploadsTable: {} }));
vi.mock("./notifications", () => ({ sendRoomDigestEmail: vi.fn(async () => true) }));
vi.mock("./sfdc-service", () => ({ sfdcService: {} }));
vi.mock("./tenantHosts", () => ({ WILDCARD_BASE_HOSTS: ["app.example.com", "example.com"] }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));
vi.mock("./partnerRoomService", () => ({ SHEET_ID_RE: /^[A-Za-z0-9_-]{20,}$/, SHEET_TAB_RE: /^[A-Za-z0-9 _&().,'-]{1,80}$/, syncPracticesFromSheet: vi.fn(async () => ({ ok: true, note: "" })) }));

import { ROOM_LOG_HEADERS, accountKey, cleanAccountName, hubBlocksFromTemplate, isSfdcFieldName, roomBlocksForAccount, roomCreatedEmail, roomLogRow, roomSlugFor, signedAccountsFromSheet } from "./partnerRoomAutocreate";
import { resolveRoomBlocks, roomKitInfo } from "./partnerRoom";
import { setRoomStage } from "./partnerRoomStage";

describe("signed accounts from the sheet", () => {
  it("drops Salesforce's bookkeeping words from account names", () => {
    const cases: [string, string][] = [
      ["Heartland Dental-HQ", "Heartland Dental"],
      ["MB2 Dental -HQ", "MB2 Dental"],
      ["Signature Dental Partners- Enterprise DSO Parent", "Signature Dental Partners"],
      ["Smile Brands DSO Enterprise Parent", "Smile Brands"],
      ["PepperPointe Partnerships - National DSO", "PepperPointe Partnerships"],
      ["Independence Dental Services Parent DSO", "Independence Dental Services"],
      ["Southern Dental Alliance DSO Enterprise Parent", "Southern Dental Alliance"],
      ["Envisage Dental UK Limited - Parent", "Envisage Dental UK Limited"],
      ["Southeast Dental Partners", "Southeast Dental Partners"],
      ["Lakewood Dental Services LLC (Indianapolis)", "Lakewood Dental Services LLC (Indianapolis)"],
      ["HQ", "HQ"],
      // Names written in capitals are written normally; real acronyms, states and suffixes keep theirs.
      ["MB2 DENTAL SOLUTIONS - DSO PARENT ENTERPRISE", "MB2 Dental Solutions"],
      ["SIGNATURE DENTAL PARTNERS (DSO)", "Signature Dental Partners"],
      ["PDS HEALTH DSO PARENT ACCOUNT", "PDS Health"],
      ["SMILE DOCTORS OF TX, LLC", "Smile Doctors of TX, LLC"],
      ["ASPEN DENTAL MANAGEMENT INC - CORPORATE", "Aspen Dental Management Inc"],
      ["DENTAL CARE ALLIANCE", "Dental Care Alliance"],
      ["SOUTH-EAST DENTAL (INDIANAPOLIS)", "South-East Dental (Indianapolis)"],
      // A name with lower-case letters is left as written.
      ["PepperPointe Partnerships", "PepperPointe Partnerships"],
      // Nothing but bookkeeping words: the last one is kept, in capitals.
      ["DSO PARENT", "DSO"],
    ];
    for (const [raw, want] of cases) expect(cleanAccountName(raw)).toBe(want);
  });
  it("treats one account as one, however it is written", () => {
    expect(accountKey("Heartland Dental-HQ")).toBe(accountKey("heartland  dental"));
    expect(accountKey("Smith & Jones Dental - Parent")).toBe("smith-and-jones-dental");
    expect(roomSlugFor("MB2 Dental -HQ")).toBe("mb2-dental-hub");
  });
  it("reads the report's columns, skips blanks and repeats, and needs an Account Name column", () => {
    const values = [
      ["Last Activity", "Account Owner", "Account Name", "", "", "", "Contract Signed Date", ""],
      ["10/27/2026", "Samantha M", "Southeast Dental Partners", "", "", "", "1/14/2026", ""],
      ["11/10/2026", "Taigh P", "Signature Dental Partners- Enterprise DSO Parent", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["1/1/2026", "Someone", "Southeast Dental Partners - HQ", "", "", "", "2/2/2026", ""],
    ];
    expect(signedAccountsFromSheet(values)).toEqual([
      { key: "southeast-dental-partners", name: "Southeast Dental Partners", signedDate: "1/14/2026", owner: "Samantha M", sfdcId: null },
      { key: "signature-dental-partners", name: "Signature Dental Partners", signedDate: null, owner: "Taigh P", sfdcId: null },
    ]);
    // With an id column, each account carries its Salesforce id; anything that isn't one is ignored.
    const withIds = signedAccountsFromSheet([["Account Name", "Account ID"], ["MB2 Dental -HQ", "0015d000041HyXrAAK"], ["Heartland Dental", "n/a"]])!;
    expect(withIds.map((a) => [a.name, a.sfdcId])).toEqual([["MB2 Dental", "0015d000041HyXrAAK"], ["Heartland Dental", null]]);
    expect(signedAccountsFromSheet([["Owner", "Stage"], ["a", "b"]])).toBeNull();
    expect(signedAccountsFromSheet(null)).toBeNull();
  });
});

describe("a hub made from the workspace's own template", () => {
  const template = [
    { id: "hero", type: "hub-hero", props: { headline: "x" } },
    {
      id: "w1",
      type: "room-workspace",
      props: {
        partnerName: "MB2 Dental", partnerShort: "MB2", headline: "{{account}} × Dandy", kickoffDate: "2026-10-25", stage: "expansion", stageSince: "2026-11-01", waves: [{ key: "1", name: "Wave 1" }], requireEmail: false,
        planGroups: [{ title: "Our phase", rows: [{ key: "a", task: "Our own step", status: "done", target: "2026-11-03" }, { key: "b", task: "Another", status: "blocking", target: "Week 2" }] }],
        onboarding: { steps: [{ key: "onboard-logo", title: "Upload your logo", done: true }] },
        calendar: { events: [{ key: "k", date: "2026-11-03", title: "Kickoff" }] },
        meetings: { items: [{ key: "m", date: "2026-11-03", title: "Sync" }] },
        assets: [{ key: "dandy-logos", kind: "link", title: "Dandy logos", externalUrl: "" }, { key: "custom", kind: "text", title: "Our note", body: "Hello" }],
        links: [],
      },
    },
  ];

  it("copies the template's wording and sections, with this account's name and nothing left over from the page it was saved from", () => {
    const out = hubBlocksFromTemplate(template, "Southeast Dental Partners") as { type: string; props: Record<string, any> }[];
    const room = out.find((b) => b.type === "room-workspace")!.props;
    expect(room.partnerName).toBe("Southeast Dental Partners");
    expect(room.partnerShort).toBe("");
    expect(room.headline).toBe("{{account}} × Dandy");
    for (const k of ["kickoffDate", "stage", "stageSince", "waves"]) expect(room[k]).toBeUndefined();
    expect(room.planGroups[0].rows).toEqual([{ key: "a", task: "Our own step", status: "not-started" }, { key: "b", task: "Another", status: "not-started", target: "Week 2" }]);
    expect(room.onboarding.steps[0].done).toBe(false);
    expect(room.calendar.events).toEqual([]);
    expect(room.meetings.items).toEqual([]);
    expect(room.requireEmail).toBe(false); // the template's own choice is kept
    expect(out[0]).toEqual(template[0]);
    // The template itself is untouched.
    expect((template[1].props as any).planGroups[0].rows[0].status).toBe("done");
  });

  it("is what a new hub starts from when given, with the workspace's files and links and the practice site added as usual", () => {
    const blocks = roomBlocksForAccount("Southeast Dental Partners", "southeast-hub", [{ assetKey: "dandy-logos", fileUrl: "https://drive.example/logos" }], "https://partners.example.com/southeast-practices", template);
    const room = (blocks as { type: string; props: Record<string, any> }[]).find((b) => b.type === "room-workspace")!.props;
    expect(room.planGroups[0].rows.map((r: any) => r.task)).toEqual(["Our own step", "Another"]);
    expect(room.assets.find((a: any) => a.key === "dandy-logos").externalUrl).toBe("https://drive.example/logos");
    expect(room.assets.find((a: any) => a.key === "custom").body).toBe("Hello");
    expect(JSON.stringify(room.links)).toContain("https://partners.example.com/southeast-practices");
    // With no template, the built-in one is used as before.
    const builtIn = (roomBlocksForAccount("Southeast Dental Partners", "southeast-hub", []) as { type: string; props: Record<string, any> }[]).find((b) => b.type === "room-workspace")!.props;
    expect(builtIn.planGroups.length).toBe(5);
  });
});

describe("a pinned note on the hub template", () => {
  it("comes into every new hub, pinned the day the hub is made; other sections and the order come as they are", () => {
    const template = [{ type: "room-workspace", props: { partnerName: "Template", overviewOrder: ["n1", "progress"], overviewExtras: [
      { key: "n1", kind: "text", title: "Book your kickoff call", body: "Hi {first name}", pinnedAt: "2026-01-02T00:00:00.000Z", signedBy: "Someone Else", items: [{ title: "Book", url: "{booking link}" }] },
      { key: "v1", kind: "video", title: "Welcome", videos: [{ title: "Welcome", url: "https://youtu.be/dQw4w9WgXcQ" }] },
    ] } }];
    const before = Date.now();
    const [b] = hubBlocksFromTemplate(template, "Acme Dental") as { props: Record<string, any> }[];
    const note = b.props.overviewExtras[0];
    expect(note.title).toBe("Book your kickoff call");
    expect(note.items).toEqual([{ title: "Book", url: "{booking link}" }]);
    expect(Date.parse(note.pinnedAt)).toBeGreaterThanOrEqual(before);
    expect(b.props.overviewExtras[1]).toEqual(template[0].props.overviewExtras[1]);
    expect(b.props.overviewOrder).toEqual(["n1", "progress"]);
    // The template itself is untouched.
    expect(template[0].props.overviewExtras[0].pinnedAt).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("the room made for an account", () => {
  it("is the template with the account's name everywhere and the workspace's standard guides attached", () => {
    const blocks = roomBlocksForAccount("Southeast Dental Partners", "southeast-dental-partners-hub", [{ assetKey: "practice-welcome-guide", fileUrl: "/api/storage/objects/uploads/welcome" }]);
    const room = (blocks as { type: string; props: Record<string, unknown> }[]).find((b) => b.type === "room-workspace")!;
    expect(room.props.partnerName).toBe("Southeast Dental Partners");
    expect(room.props.heroImageUrl).toBe("/room/default-cover.jpg");
    expect(room.props.nextMilestoneLabel).toBe(""); // blank: the cover shows the next open plan item
    // The stored page keeps the variables; what anyone reads has the name.
    const shown = JSON.stringify(resolveRoomBlocks(blocks));
    expect(shown).not.toMatch(/\[Partner( name)?\]/);
    expect(shown).toContain("Southeast Dental Partners");
    const kit = roomKitInfo(resolveRoomBlocks(blocks))!;
    expect(kit.assets.find((a) => a.key === "practice-welcome-guide")).toMatchObject({ hasFile: true, hidden: false });
    expect(kit.texts.length).toBeGreaterThan(0);
    expect(kit.texts.every((t) => !/\[Partner/.test(t.body))).toBe(true);
  });
});

describe("after a room is created", () => {
  const account = { key: "mb2-dental", name: "MB2 <Dental>", signedDate: "2/2/2026", owner: "Molly Reilly", sfdcId: "0015d000041HyXrAAK" };
  const links = { room: "https://partners.example.com/mb2-dental-hub", edit: "https://app.example.com/builder/42" };
  it("writes one log row per room, matching the tab's columns", () => {
    const row = roomLogRow(account, links, { now: new Date("2026-11-16T15:00:00Z") });
    expect(row).toHaveLength(ROOM_LOG_HEADERS.length);
    expect(row).toEqual(["2026-11-16", "MB2 <Dental>", "Draft", links.room, links.edit, "Molly Reilly", "2/2/2026", "0015d000041HyXrAAK", ""]);
    expect(roomLogRow({ ...account, owner: null, signedDate: null, sfdcId: null }, links, { test: true }).slice(5)).toEqual(["", "", "", "Test run"]);
  });
  it("writes the alert email with the edit link, escaped, and marks a test", () => {
    const mail = roomCreatedEmail(account, links);
    expect(mail.subject).toBe("New Partner Hub: MB2 <Dental>");
    expect(mail.html).toContain("MB2 &lt;Dental&gt;");
    expect(mail.html).not.toContain("<Dental>");
    expect(mail.html).toContain('href="https://app.example.com/builder/42"');
    expect(mail.html).toContain("Account owner: Molly Reilly");
    expect(mail.html).toContain("Connect your calendar");
    expect(roomCreatedEmail(account, links, { facts: { standardFiles: 2, teamFilled: 3, contacts: 9, domain: "mb2dental.com", practicesLinked: true, ownerNamed: false } }).html).toContain("Customer email domain set to mb2dental.com");
    expect(roomCreatedEmail(account, links, { test: true }).subject.startsWith("[Test] ")).toBe(true);
  });
  it("reads the real signed-accounts tab: the id column is called “18 digit ID”", () => {
    const tab = [
      ["18 digit ID", "Account Owner", "Account Name", "ABM Org Tier", "ABM Org Stage", "Number of Practice Locations", "Number of Locations on Contract", "Enterprise MSA Signed", "Enterprise Pilot", "Contract Signed Date", "Practice Profile Segment", "ABM Tier", "Last Activity"],
      ["0015d00003OioNlAAJ", "Samantha Mackinnon", "Southeast Dental Partners", "Tier 3", "Closed - Won", 52, 25, 1, 0, "1/13/2026", "Large Enterprise", "Tier 3", "10/26/2026"],
    ];
    expect(signedAccountsFromSheet(tab)).toEqual([{ key: "southeast-dental-partners", name: "Southeast Dental Partners", signedDate: "1/13/2026", owner: "Samantha Mackinnon", sfdcId: "0015d00003OioNlAAJ" }]);
  });
  it("accepts only a Salesforce field API name", () => {
    expect(isSfdcFieldName("Digital_Sales_Room__c")).toBe(true);
    expect(isSfdcFieldName("Website")).toBe(true);
    expect(isSfdcFieldName("Name; DROP")).toBe(false);
    expect(isSfdcFieldName("1Field")).toBe(false);
    expect(isSfdcFieldName("")).toBe(false);
  });
});

describe("a hub past its rollout saved as a template", () => {
  it("gives new hubs the launch plan, not its later one", () => {
    const launch = [{ title: "Days 0–5", rows: [{ key: "a", task: "A", status: "done" }, { key: "b", task: "B", status: "not-started" }] }];
    const moved = setRoomStage([{ type: "room-workspace", props: { partnerName: "MB2", planGroups: launch } }], { stage: "expansion", timelineView: "practices", waves: [] }, new Date("2026-11-22T15:00:00Z"), { decisions: { b: "retire" } })!;
    const fresh = hubBlocksFromTemplate(moved, "Next DSO") as { props: Record<string, unknown> }[];
    expect((fresh[0].props.planGroups as { title: string }[]).map((g) => g.title)).toEqual(["Days 0–5"]);
    expect(fresh[0].props).not.toHaveProperty("rolloutPlanGroups");
    expect(JSON.stringify(fresh[0].props.planGroups)).not.toContain("retired");
  });
});
