import { describe, expect, it } from "vitest";
import { matchRoster, parseRoster, rosterTemplateCsv, ROSTER_COLUMNS } from "./partnerRoomRoster";

const OURS = [
  { id: 11, externalId: "0015d00000AAAAAAAA", name: "Main Street Dental, P.C." },
  { id: 12, externalId: "0015d00000BBBBBAAA", name: "Lakeside Family Dentistry of Denver" },
  { id: 13, externalId: null, name: "Summit Dental" },
];
const csv = (lines: string[]) => Buffer.from(lines.join("\n"));

describe("roster template", () => {
  it("lists every practice with its ID, ready for a row per doctor; values can't run as formulas", () => {
    const text = rosterTemplateCsv([
      { id: 11, externalId: "0015d00000AAAAAAAA", name: "Main Street Dental, P.C.", address: null, city: "Dallas", state: "TX", zip: null, regionalManager: "Dana Ruiz", officeManager: null },
      { id: 13, externalId: null, name: "=HYPERLINK(1)", address: null, city: null, state: null, zip: null, regionalManager: null, officeManager: null },
    ]);
    const lines = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(ROSTER_COLUMNS.join(","));
    expect(lines[1]).toBe('0015d00000AAAAAAAA,"Main Street Dental, P.C.",,Dallas,TX,,,,Dana Ruiz,,,,,');
    expect(lines[2].startsWith(`13,"'=HYPERLINK(1)"`)).toBe(true);
    // The template reads back as a roster with those practices and no doctors.
    const back = parseRoster("roster.csv", Buffer.from(text))!;
    expect(back.rows.map((r) => r.practiceId)).toEqual(["0015d00000AAAAAAAA", "13"]);
    expect(matchRoster(back.rows, OURS).result).toMatchObject({ practices: 2, matched: 2, doctors: 0 });
  });
});

describe("reading a roster", () => {
  it("ties each doctor to a practice by ID, then name, then a close name; and fills in regionals and addresses", () => {
    const parsed = parseRoster(
      "MB2 roster.csv",
      csv([
        "Practice ID,Practice name,Street address,City,State,ZIP,Regional manager,Office manager,Doctor name,Doctor email,Doctor NPI,Doctor role",
        "0015d00000AAAAA,Main St Dental (renamed),100 Main St,Dallas,TX,75201,Dana Ruiz,Pat Lee,Dr. Ana Patel,ana@mainst.com,1234567890,General",
        ",,,,,,,,Dr. Ben Cho,ben@mainst.com,,Associate", // practice left blank: same practice as the row above
        ",main street dental pc,,,,,,,Dr. Ana Patel,ana@mainst.com,1234567890,General", // the same doctor again
        ",Lakeside Family Dentistry,22 Lake Rd,Denver,CO,80202,Sam Ortiz,,Dr. Cy Diaz,not-an-email,,",
        ",Summit Dental,,,,,,,,,,", // a practice with no doctors yet
        ",Brand New Smiles,9 New Way,Austin,TX,78701,Dana Ruiz,,Dr. Dee Fox,dee@new.com,,",
      ]),
    )!;
    expect(parsed.hasDoctors).toBe(true);
    const { updates, doctors, result } = matchRoster(parsed.rows, OURS);
    expect(doctors.map((d) => [d.name, d.practiceId])).toEqual([["Dr. Ana Patel", 11], ["Dr. Ben Cho", 11], ["Dr. Cy Diaz", 12], ["Dr. Dee Fox", null]]);
    expect(doctors[0]).toMatchObject({ email: "ana@mainst.com", npi: "1234567890", role: "General" });
    expect(doctors[2].email).toBeNull(); // not an address
    expect(updates).toEqual([
      { id: 11, address: "100 Main St", city: "Dallas", state: "TX", zip: "75201", regionalManager: "Dana Ruiz", officeManager: "Pat Lee" },
      { id: 12, address: "22 Lake Rd", city: "Denver", state: "CO", zip: "80202", regionalManager: "Sam Ortiz" },
    ]);
    expect(result).toMatchObject({ practices: 4, matched: 3, unmatched: ["Brand New Smiles"], notOnRoster: [], doctors: 4, doctorsUnmatched: 1, enriched: 2 });
    expect(result.likely).toEqual([{ roster: "Lakeside Family Dentistry", ours: "Lakeside Family Dentistry of Denver" }]);
    expect(result.issues).toEqual(["1 doctor email doesn't look like an address.", "1 doctor is listed twice at the same practice."]);
  });

  it("reads a practices-only list (no doctor column) without touching doctors, and other people's column names", () => {
    const parsed = parseRoster("locations.csv", csv(["Our locations", "", "Location Name,Billing Street,Billing City,Province,Postal Code,RDO,Email", "Summit Dental,5 High St,Boulder,CO,80301,Lee Chen,front@summit.com", "Example Practice,,,,,,"]))!;
    expect(parsed.hasDoctors).toBe(false);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({ practiceName: "Summit Dental", address: "5 High St", city: "Boulder", state: "CO", zip: "80301", regionalManager: "Lee Chen", doctorEmail: "" });
    const { updates, doctors, result } = matchRoster(parsed.rows, OURS);
    expect(doctors).toEqual([]);
    expect(updates[0]).toMatchObject({ id: 13, regionalManager: "Lee Chen" });
    expect(result.notOnRoster).toEqual(["Main Street Dental, P.C.", "Lakeside Family Dentistry of Denver"]);
  });

  it("says a file with no practice column is not a roster", () => {
    expect(parseRoster("notes.csv", csv(["Topic,Owner", "Kickoff,Sam"]))).toBeNull();
    expect(parseRoster("photo.png", Buffer.from("x"))).toBeNull();
    const orphan = matchRoster(parseRoster("d.csv", csv(["Practice name,Doctor name", ",Dr. No Practice"]))!.rows, OURS).result;
    expect(orphan.issues).toEqual(["1 doctor has no practice on their row."]);
  });
});
