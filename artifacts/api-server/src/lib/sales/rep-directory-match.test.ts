import { describe, expect, it } from "vitest";
import { applyGiftProps, applyRepToBlocks, sanitizeGiftProps, buildRepDirectory, fillRepVariables, findRepEmailField, resolveRepRecipient } from "./rep-directory-match";

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

describe("applyRepToBlocks", () => {
  const vars = { rep_email: "Bo@x.com", rep_name: "Bo Lee", rep_title: "AE", rep_photo: "https://p/bo.jpg", rep_calendar: "" };
  const blocks = [
    { type: "gift-note", props: { signature: "Old Rep", repTitle: "VP", repPhotoUrl: "https://p/old.jpg", calendarUrl: "https://cal/old", body: "hi" } },
    { type: "gift-form", props: { sentBy: "Old Rep", repEmail: "old@x.com" } },
    { type: "hero", props: { headline: "h" } },
  ];
  it("replaces the template rep on gift blocks and leaves others alone", () => {
    const out = applyRepToBlocks(blocks, vars) as Array<{ type: string; props: Record<string, string> }>;
    expect(out[0].props).toMatchObject({ signature: "Bo Lee", repTitle: "AE", repPhotoUrl: "https://p/bo.jpg", calendarUrl: "", body: "hi" });
    expect(out[1].props).toMatchObject({ sentBy: "Bo Lee", repEmail: "bo@x.com" });
    expect(out[2]).toBe(blocks[2]);
  });
});

describe("gift props override", () => {
  it("keeps only the four gift block types as plain objects", () => {
    expect(sanitizeGiftProps({ "gift-hero": { a: 1 }, "custom-html": { html: "<script>" }, "gift-note": [1] })).toEqual({ "gift-hero": { a: 1 } });
    expect(sanitizeGiftProps(null)).toBeNull();
    expect(sanitizeGiftProps({ "custom-html": {} })).toBeNull();
  });
  it("replaces gift block props and leaves other blocks alone", () => {
    const blocks = [{ type: "gift-hero", props: { a: 0 } }, { type: "dandy-site-footer", props: { b: 0 } }];
    const out = applyGiftProps(blocks, { "gift-hero": { a: 2 } }) as typeof blocks;
    expect(out[0].props).toEqual({ a: 2 });
    expect(out[1]).toBe(blocks[1]);
  });
});
