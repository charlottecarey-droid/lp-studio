import { describe, expect, it } from "vitest";
import { parseBulkCsv, parseCsv, slugify, toCsv } from "./csv";

describe("parseCsv", () => {
  it("keeps commas, line breaks and doubled quotes inside quoted fields", () => {
    const text = '﻿slug,personal_note\r\ngilberto,"Hi Gilberto, great year!"\r\nana,"Line one\nline two"\nmia,"She said ""thanks"""\n';
    expect(parseCsv(text)).toEqual([
      ["slug", "personal_note"],
      ["gilberto", "Hi Gilberto, great year!"],
      ["ana", "Line one\nline two"],
      ["mia", 'She said "thanks"'],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseBulkCsv", () => {
  it("normalises headers and keeps every column as a variable", () => {
    const rows = parseBulkCsv("Slug,First Name,Rep Email,Personal Note\ngilberto-apex,Gilberto,dan@x.com,\"Hi, thanks!\"");
    expect(rows).toEqual([{ slug: "gilberto-apex", autoSlug: false, variables: { first_name: "Gilberto", rep_email: "dan@x.com", personal_note: "Hi, thanks!" } }]);
  });

  it("builds a unique slug from name + company when there is no slug column", () => {
    const rows = parseBulkCsv("first_name,last_name,company\nGilberto,Ruiz,Apex Dental\nGilberto,Ruiz,Apex Dental\nJosé,Núñez,Smile & Co");
    expect(rows.map((r) => r.slug)).toEqual(["gilberto-ruiz-apex-dental", "gilberto-ruiz-apex-dental-2", "jose-nunez-smile-and-co"]);
    expect(rows.every((r) => r.autoSlug)).toBe(true);
  });

  it("rejects a file with neither a slug nor name/company columns", () => {
    expect(() => parseBulkCsv("email\na@b.com")).toThrow(/slug/);
  });
});

describe("slugify / toCsv", () => {
  it("slugifies and round-trips quoted output", () => {
    expect(slugify("  Dr. Ana  O'Neil ")).toBe("dr-ana-o-neil");
    const out = toCsv([["name", "note"], ["Ana", 'Hi, "friend"']]);
    expect(out).toBe('name,note\nAna,"Hi, ""friend"""');
  });
});
