import { describe, expect, it } from "vitest";
import { parsePracticeRow, roomSharesMap } from "./partnerRoom";
import { splitAddress, usingDandyStage, zip5 } from "./partnerRoomGeo";
import { parseRoster } from "./partnerRoomRoster";
import { zipCentroid } from "./zipCentroids";

describe("an address on one line", () => {
  it("gives the street, city, state and ZIP when commas set the city apart", () => {
    expect(splitAddress("166 Furman Road Ste B, Boone, NC 28607")).toEqual({ street: "166 Furman Road Ste B", city: "Boone", state: "NC", zip: "28607" });
    expect(splitAddress("244 Latitude Lane, Suite 103, Lake Wylie, SC 29710")).toEqual({ street: "244 Latitude Lane, Suite 103", city: "Lake Wylie", state: "SC", zip: "29710" });
    expect(splitAddress("1210 E Marion St, Shelby, NC 28150-4321").zip).toBe("28150");
  });

  it("keeps the city with the street when nothing separates them, and never takes a suite for a city", () => {
    expect(splitAddress("816 1st Ave S Conover, NC 28613")).toEqual({ street: "816 1st Ave S Conover", city: null, state: "NC", zip: "28613" });
    expect(splitAddress("19824 W. Catawba Ave, Suite B2 NC 28031")).toMatchObject({ city: null, state: "NC", zip: "28031" });
  });

  it("reads what it can from anything else", () => {
    expect(splitAddress("100 Main St")).toEqual({ street: "100 Main St", city: null, state: null, zip: null });
    expect(splitAddress("somewhere 75201")).toMatchObject({ zip: "75201", state: null });
    expect(splitAddress(null)).toEqual({ street: "", city: null, state: null, zip: null });
  });
});

describe("ZIP codes", () => {
  it("places a ZIP at its middle and says nothing for one it doesn't know", () => {
    const boone = zipCentroid("28607")!;
    expect(boone.lat).toBeGreaterThan(36);
    expect(boone.lat).toBeLessThan(36.5);
    expect(boone.lng).toBeLessThan(-81);
    expect(boone.lng).toBeGreaterThan(-82);
    expect(zipCentroid("28607-1234")).toEqual(boone);
    expect(zipCentroid("00000")).toBeNull();
    expect(zipCentroid("Boone")).toBeNull();
    expect(zipCentroid(null)).toBeNull();
    expect(zip5("2860")).toBeNull();
  });
});

describe("a location list with addresses (the Southeast Dental Partners sheet)", () => {
  const row = (over: Record<string, string> = {}) =>
    parsePracticeRow({ office: "Appalachian Dental Care", rdo: "Laken", "using dandy": "Yes", "office type": "General", "sdp scanner status": "yes", phone: "828-264-9938", address: "166 Furman Road Ste B, Boone, NC 28607", state: "NC", ...over })!;

  it("reads the office, its regional, where it is and whether it orders", () => {
    expect(row()).toMatchObject({ name: "Appalachian Dental Care", regionalManager: "Laken", stage: "live", stageGiven: true, officeType: "General", phone: "828-264-9938", address: "166 Furman Road Ste B", city: "Boone", state: "NC", zip: "28607" });
    expect(row({ "using dandy": "No" })).toMatchObject({ stage: "not_started", stageGiven: true });
  });

  it("leaves the saved status alone when the file doesn't say", () => {
    expect(row({ "using dandy": "" })).toMatchObject({ stage: "not_started", stageGiven: false });
    expect(usingDandyStage("maybe")).toBeNull();
  });

  it("prefers a ZIP column over the address", () => {
    expect(row({ zip: "28150" }).zip).toBe("28150");
  });

  it("a Salesforce report: the shipping address is where the practice is, billing is the fallback", () => {
    const sf = { "account name": "Gold Hill Family Dentistry", "billing address line 1": "1 Head Office Way", "billing city": "Charlotte", "billing state/province": "NC", "billing zip/postal code": "28202", "shipping street": "12 Gold Hill Rd", "shipping address line 1": "12 Gold Hill Rd", "shipping city": "Fort Mill", "shipping state/province": "SC", "shipping zip/postal code": "29708-1234" };
    expect(parsePracticeRow(sf)).toMatchObject({ address: "12 Gold Hill Rd", city: "Fort Mill", state: "SC", zip: "29708", region: "SC" });
    expect(parsePracticeRow({ ...sf, "shipping street": "", "shipping address line 1": "", "shipping city": "", "shipping state/province": "", "shipping zip/postal code": "" })).toMatchObject({ address: "1 Head Office Way", city: "Charlotte", state: "NC", zip: "28202" });
  });

  it("a customer's roster fills the ZIP, office type and phone the same way", () => {
    const parsed = parseRoster("roster.csv", Buffer.from(["Practice name,Address,Office type,Phone,RDO", '"Broad River Dental","1210 E Marion St, Shelby, NC 28150",General,704-484-0611,Hollie'].join("\n")))!;
    expect(parsed.rows[0]).toMatchObject({ practiceName: "Broad River Dental", address: "1210 E Marion St", city: "Shelby", state: "NC", zip: "28150", officeType: "General", phone: "704-484-0611", regionalManager: "Hollie" });
  });
});

describe("sharing the map", () => {
  it("is off unless the hub's own switch is on", () => {
    expect(roomSharesMap([{ type: "room-workspace", props: { partnerName: "MB2" } }])).toBe(false);
    expect(roomSharesMap([{ type: "room-workspace", props: { shareMap: "yes" } }])).toBe(false);
    expect(roomSharesMap([{ type: "hub-hero", props: { shareMap: true } }])).toBe(false);
    expect(roomSharesMap([{ type: "room-workspace", props: { shareMap: true } }])).toBe(true);
    expect(roomSharesMap(null)).toBe(false);
  });
});

describe("order columns on the locations report", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const base = { "account name": "Gold Hill Dentistry", status: "Ramped" };

  it("reads which product lines a practice has ordered, its last order and its tenth", () => {
    const row = parsePracticeRow({ ...base, "01st simple restorative order placed": "9/13/2021", "01st implant order placed": "3/9/2022", "01st aligner order placed": "", "01st full denture order placed": "", "days since non canceled orders(for flow)": "3", "date of tenth order delivered": "4/2/2026, 8:00 PM", "# orders (all-time)": "15", "# orders (this month)": "" }, now)!;
    expect(row).toMatchObject({ products: ["Simple restorative", "Implant"], lastOrderDay: "2026-11-17", tenthOrderDay: "2026-04-02", ordersAllTime: 15, ordersThisMonth: null });
  });

  it("says 'none yet' when the columns are there and blank, and nothing at all when they aren't", () => {
    expect(parsePracticeRow({ ...base, "01st implant order placed": "", "days since non canceled orders(for flow)": "" }, now)).toMatchObject({ products: [], lastOrderDay: null });
    const plain = parsePracticeRow(base, now)!;
    expect("products" in plain).toBe(false);
    expect("lastOrderDay" in plain).toBe(false);
  });
});
