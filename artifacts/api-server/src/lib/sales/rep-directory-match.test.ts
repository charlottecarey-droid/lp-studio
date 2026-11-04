import { describe, expect, it } from "vitest";
import { buildRepDirectory, fillRepVariables, findRepEmailField, resolveRepRecipient } from "./rep-directory-match";

const library = [
  { name: "Harrison Corman", role: "Business Development", email: "harrison.corman@x.com", calendlyUrl: "https://cp/harrison" },
  { name: "Harrison Corman", role: "Business Development", email: "Harrison.Corman@x.com ", chilipiperUrl: "", photo: "/img/harrison.webp" },
  { name: "Dan MacAdam", role: "Strat AE", email: "dan@x.com", chilipiperUrl: "https://cp/dan", phone: "555" },
  { name: "No Email" },
];

describe("rep directory", () => {
  it("merges duplicate records by email and reads the link from either field", () => {
    const dir = buildRepDirectory(library);
    expect(dir.size).toBe(2);
    expect(dir.get("harrison.corman@x.com")).toMatchObject({ name: "Harrison Corman", firstName: "Harrison", calendar: "https://cp/harrison", photo: "/img/harrison.webp" });
  });

  it("fills rep_* variables from rep_email, keeping values the row already has", () => {
    const dir = buildRepDirectory(library);
    const { vars, matched } = fillRepVariables({ first_name: "Gilberto", rep_email: " DAN@x.com", rep_title: "Strategic AE" }, dir);
    expect(matched).toBe(true);
    expect(vars).toMatchObject({ first_name: "Gilberto", rep_name: "Dan MacAdam", rep_first_name: "Dan", rep_title: "Strategic AE", rep_calendar: "https://cp/dan", rep_phone: "555" });
    expect(vars.rep_photo).toBeUndefined();
  });

  it("reports an unknown email and leaves rows without rep_email alone", () => {
    const dir = buildRepDirectory(library);
    expect(fillRepVariables({ rep_email: "nobody@x.com" }, dir)).toEqual({ vars: { rep_email: "nobody@x.com" }, matched: false });
    expect(fillRepVariables({ first_name: "A" }, dir)).toEqual({ vars: { first_name: "A" }, matched: null });
  });

  it("notifies the rep a submission names only when they are in the library", () => {
    const dir = buildRepDirectory(library);
    const lead = { Email: "g@apex.com", Gift: "Lab Tour in a Box", "Rep email": " Dan@x.com ", "Sent by": "Dan MacAdam" };
    expect(findRepEmailField(lead)).toBe("dan@x.com");
    expect(resolveRepRecipient(lead, dir)).toBe("dan@x.com");
    // A stranger posting an arbitrary address gets nobody mailed.
    expect(resolveRepRecipient({ Email: "g@apex.com", "Rep email": "attacker@evil.com" }, dir)).toBeNull();
    // The submitter's own email is never mistaken for the rep's.
    expect(resolveRepRecipient({ Email: "dan@x.com" }, dir)).toBeNull();
    expect(findRepEmailField({ rep_email: "HARRISON.CORMAN@x.com" })).toBe("harrison.corman@x.com");
  });
});
