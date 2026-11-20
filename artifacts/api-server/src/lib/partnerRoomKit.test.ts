import { describe, expect, it } from "vitest";
import { KIT_HEADERS, kitAsanaTask, kitNotice, kitRows, planKits, type KitPractice } from "./partnerRoomKit";
import { pickAsanaTarget } from "./partnerRoomAsanaPick";

const practice = (over: Partial<KitPractice> = {}): KitPractice => ({ id: 1, externalId: "0015d00003UR9S2AAL", name: "Porter Dental", address: "7839 Eastern Ave", city: "Baltimore", state: "MD", zip: "21224", phone: "4035034903", owner: "Harris Russell", kitSentAt: null, ...over });
const ctx = { parentAccount: "Benevis-HQ", parentAccountId: "0015d000041HyYi", date: "2026-11-20" };

describe("welcome kit list", () => {
  it("a new tab gets the template's columns without the blank and second first-name ones, plus the date", () => {
    const { headers, headersChanged, rows } = kitRows(null, [practice()], ctx);
    expect(headers).toEqual([...KIT_HEADERS]);
    expect(headers).not.toContain("");
    expect(headers).not.toContain("FIRSTNAME");
    expect(headers.at(-1)).toBe("Date added");
    expect(headersChanged).toBe(true);
    expect(rows[0]).toEqual(["Harris Russell", "Benevis-HQ", "Doctor", "and Staff", "Porter Dental", "7839 Eastern Ave", "", "Baltimore", "MD", "21224", "US", "", "4035034903", "0015d00003UR9S2AAL", "0015d000041HyYi", "", "0015d00003UR9S2AAL", "", "", "", "2026-11-20"]);
  });

  it("fills a tab that still has the old layout by column name, and adds the date column to it", () => {
    const old = ["Practice BDR", "Parent Account", "", "NameFirst", "NameLast", "CompanyName", "AddressLine1", "AddressLine2", "City", "Province", "PostalCode", "CountryCode", "Email", "Phone", "FIRSTNAME", "VERSION", "Parent Account ID", "Contact18", "Account18", "Welcome kit delivery", "Video Mailer delivery", "Magalog delivery"];
    const { headers, headersChanged, rows } = kitRows(old, [practice({ zip: "02723" })], ctx);
    expect(headersChanged).toBe(true);
    expect(headers).toEqual([...old, "Date added"]);
    const row = Object.fromEntries(headers.map((h, i) => [h || "(blank)", rows[0][i]]));
    expect(row).toMatchObject({ "(blank)": "", NameFirst: "Doctor", NameLast: "and Staff", FIRSTNAME: "Doctor", CompanyName: "Porter Dental", PostalCode: "02723", Account18: "0015d00003UR9S2AAL", "Date added": "2026-11-20" });
    // A tab that already has the date column is left as it is.
    expect(kitRows(headers, [practice()], ctx).headersChanged).toBe(false);
  });

  it("a name can't run as a formula", () => {
    expect(kitRows(null, [practice({ name: "=HYPERLINK(1)" })], ctx).rows[0][4]).toBe("'=HYPERLINK(1)");
  });

  it("sends only practices with a full address that haven't had one", () => {
    const plan = planKits([practice({ id: 1 }), practice({ id: 2, kitSentAt: new Date() }), practice({ id: 3, address: null }), practice({ id: 4, zip: "" }), practice({ id: 5, city: " " })]);
    expect(plan.send.map((p) => p.id)).toEqual([1]);
    expect(plan.already.map((p) => p.id)).toEqual([2]);
    expect(plan.noAddress.map((p) => p.id)).toEqual([3, 4, 5]);
  });

  it("tells marketing who added which practices, and where the list is", () => {
    const n = kitNotice("Benevis", ["Porter Dental", "Pippin Dental"], "Rae Rep", "https://docs.google.com/spreadsheets/d/abc");
    expect(n.title).toBe("2 practices added to the welcome kit list");
    expect(n.lines.join("\n")).toContain("Rae Rep added 2 Benevis practices");
    expect(n.lines).toContain("• Porter Dental");
    expect(n.lines.at(-1)).toBe("List: https://docs.google.com/spreadsheets/d/abc");
    expect(kitNotice("B", Array.from({ length: 30 }, (_, i) => `P${i}`), "R", "u").lines).toContain("…and 5 more");
  });

  it("asks marketing in Asana to send the kits, with the date asked and the list", () => {
    const t = kitAsanaTask("Benevis", ["Porter Dental", "Pippin Dental"], "Rae Rep", "https://docs.google.com/spreadsheets/d/abc", "2026-11-20");
    expect(t.subject).toBe("Send welcome kits to 2 practices (requested 2026-11-20)");
    expect(t.notes).toContain("Please send welcome kits to 2 Benevis practices.");
    expect(t.notes).toContain("Requested: 2026-11-20");
    expect(t.notes).toContain("Requested by: Rae Rep");
    expect(t.notes).toContain("https://docs.google.com/spreadsheets/d/abc");
    expect(t.notes).toContain("- Porter Dental");
  });

  it("files hub requests in the hub's own project, else the workspace's for all hubs, assigned to the workspace's person", () => {
    expect(pickAsanaTarget(null, { projectGid: "1212535445652653", assigneeGid: "1211027313000479" })).toEqual({ projectGid: "1212535445652653", assigneeGid: "1211027313000479" });
    expect(pickAsanaTarget("1299999999999999", { projectGid: "1212535445652653", assigneeGid: "1211027313000479" })).toEqual({ projectGid: "1299999999999999", assigneeGid: "1211027313000479" });
    expect(pickAsanaTarget("", null)).toEqual({ projectGid: null, assigneeGid: null });
    expect(pickAsanaTarget("not an id", { projectGid: " 1212535445652653 ", assigneeGid: "me" })).toEqual({ projectGid: "1212535445652653", assigneeGid: null });
  });
});
