import { describe, expect, it } from "vitest";
import { bulkColumnsFor } from "./programmatic-pages";

describe("Programmatic Pages spreadsheet columns", () => {
  it("collapses the rep_* tokens the server fills into one rep_email column", () => {
    const tokens = ["first_name", "rep_name", "rep_title", "rep_photo", "rep_calendar", "rep_first_name", "personal_note", "last_name", "email", "company"];
    expect(bulkColumnsFor(tokens)).toEqual(["first_name", "personal_note", "last_name", "email", "company", "rep_email"]);
  });

  it("adds extra columns from an uploaded CSV without duplicating or re-adding rep_* ones", () => {
    expect(bulkColumnsFor(["company"], ["company", "notes", "rep_name"])).toEqual(["company", "notes"]);
  });
});
