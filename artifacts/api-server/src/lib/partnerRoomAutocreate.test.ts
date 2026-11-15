import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpPagesTable: {}, lpRoomAutocreateAccountsTable: {}, lpRoomAutocreateTable: {}, lpRoomStandardAssetsTable: {}, lpRoomSettingsTable: {}, lpRoomUploadsTable: {} }));
vi.mock("./slack-service", () => ({ slackService: { postMessage: vi.fn(async () => true) } }));
vi.mock("./partnerRoomService", () => ({ SHEET_ID_RE: /^[A-Za-z0-9_-]{20,}$/, SHEET_TAB_RE: /^[A-Za-z0-9 _&().,'-]{1,80}$/, syncPracticesFromSheet: vi.fn(async () => ({ ok: true, note: "" })) }));

import { accountKey, cleanAccountName, roomBlocksForAccount, roomSlugFor, signedAccountsFromSheet } from "./partnerRoomAutocreate";
import { resolveRoomBlocks, roomKitInfo } from "./partnerRoom";

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
    ];
    for (const [raw, want] of cases) expect(cleanAccountName(raw)).toBe(want);
  });
  it("treats one account as one, however it is written", () => {
    expect(accountKey("Heartland Dental-HQ")).toBe(accountKey("heartland  dental"));
    expect(accountKey("Smith & Jones Dental - Parent")).toBe("smith-and-jones-dental");
    expect(roomSlugFor("MB2 Dental -HQ")).toBe("mb2-dental-room");
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

describe("the room made for an account", () => {
  it("is the template with the account's name everywhere and the workspace's standard guides attached", () => {
    const blocks = roomBlocksForAccount("Southeast Dental Partners", "southeast-dental-partners-room", [{ assetKey: "practice-welcome-guide", fileUrl: "/api/storage/objects/uploads/welcome" }]);
    const room = (blocks as { type: string; props: Record<string, unknown> }[]).find((b) => b.type === "room-workspace")!;
    expect(room.props.partnerName).toBe("Southeast Dental Partners");
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
