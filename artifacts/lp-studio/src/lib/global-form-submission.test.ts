// Contract: a lead submitted "from" a global form carries EXACTLY the form's
// fields — every label, definition order, blanks included — whether it came
// from BlockForm or from the chat-capture bot. The Google Sheets sync appends
// values positionally under headers established by earlier rows, so any other
// shape lands scrambled (the July 2026 "chat leads shifted three columns
// left" bug).

import { describe, it, expect } from "vitest";
import type { FormStep } from "@/lib/block-types";
import {
  buildGlobalFormSubmissionFields,
  buildLinkedFormLeadFields,
} from "./global-form-submission";

// Shaped like the real "Spatial Tour" form: identity fields, hidden
// attribution fields, and a custom question.
const STEPS: FormStep[] = [
  {
    title: "Step 1",
    fields: [
      { id: "f1", type: "text", label: "First Name", required: true },
      { id: "f2", type: "text", label: "Last Name", required: true },
      { id: "f3", type: "email", label: "Email Address", required: true },
      { id: "f4", type: "hidden", label: "GCLID", required: false, defaultValue: "{{gclid}}" },
      { id: "f5", type: "hidden", label: "Lead Source", required: false, defaultValue: "Website" },
      { id: "f6", type: "text", label: "Company Name", required: false },
      { id: "f7", type: "select", label: "Desired tour format", required: false, options: ["Meta Quest lab tour kit", "Virtual"] },
    ],
  },
];

describe("buildGlobalFormSubmissionFields", () => {
  it("emits every label in definition order, blanks for unanswered, hidden resolved", () => {
    const fields = buildGlobalFormSubmissionFields(STEPS, { f1: "Jane", f3: "j@acme.com" });
    expect(Object.keys(fields)).toEqual([
      "First Name", "Last Name", "Email Address", "GCLID", "Lead Source", "Company Name", "Desired tour format",
    ]);
    expect(fields["Last Name"]).toBe("");
    expect(fields["Lead Source"]).toBe("Website"); // static hidden default
    expect(fields["GCLID"]).toBe(""); // {{gclid}} resolves empty without URL/storage
  });

  it("omits condition-hidden fields entirely (matches BlockForm)", () => {
    const steps: FormStep[] = [{
      title: "s",
      fields: [
        { id: "a", type: "select", label: "Type", required: true, options: ["Lab", "Practice"] },
        { id: "b", type: "text", label: "Lab Size", required: false, visibilityCondition: { fieldId: "a", operator: "equals", value: "Lab" } },
      ],
    }];
    expect(Object.keys(buildGlobalFormSubmissionFields(steps, { a: "Practice" }))).toEqual(["Type"]);
    expect(Object.keys(buildGlobalFormSubmissionFields(steps, { a: "Lab" }))).toEqual(["Type", "Lab Size"]);
  });
});

describe("buildLinkedFormLeadFields (chat capture → global form)", () => {
  const BOT = { email: "j@acme.com", name: "Jane van Dam", company: "Acme Dental", phone: "555-1234" };

  it("produces the same keys in the same order as a form submission", () => {
    const { fields } = buildLinkedFormLeadFields(STEPS, { "Desired tour format": "Virtual" }, BOT);
    expect(Object.keys(fields)).toEqual([
      "First Name", "Last Name", "Email Address", "GCLID", "Lead Source", "Company Name", "Desired tour format",
    ]);
    expect(fields["Desired tour format"]).toBe("Virtual");
  });

  it("routes bot identity args into matching fields, splitting the full name", () => {
    const { fields, leftovers } = buildLinkedFormLeadFields(STEPS, {}, BOT);
    expect(fields["First Name"]).toBe("Jane");
    expect(fields["Last Name"]).toBe("van Dam");
    expect(fields["Email Address"]).toBe("j@acme.com");
    // "Company Name" classifies as company, never as a person-name field.
    expect(fields["Company Name"]).toBe("Acme Dental");
    // Phone has no form field — surfaced as a leftover, not dropped.
    expect(leftovers).toEqual({ phone: "555-1234" });
  });

  it("a formAnswer under the exact label wins over the bot arg (case-insensitive match)", () => {
    const { fields } = buildLinkedFormLeadFields(STEPS, { "email address": "answer@acme.com" }, BOT);
    expect(fields["Email Address"]).toBe("answer@acme.com");
  });

  it("fills a single full-name field with the whole name", () => {
    const steps: FormStep[] = [{
      title: "s",
      fields: [
        { id: "n", type: "text", label: "Your Name", required: true },
        { id: "e", type: "email", label: "Work Email", required: true },
      ],
    }];
    const { fields, leftovers } = buildLinkedFormLeadFields(steps, {}, BOT);
    expect(fields["Your Name"]).toBe("Jane van Dam");
    expect(fields["Work Email"]).toBe("j@acme.com");
    expect(leftovers.name).toBeUndefined();
    expect(leftovers.email).toBeUndefined();
  });

  it("reports every unmatched bot value as a leftover", () => {
    const steps: FormStep[] = [{
      title: "s",
      fields: [{ id: "q", type: "text", label: "Favorite Color", required: false }],
    }];
    const { fields, leftovers } = buildLinkedFormLeadFields(steps, {}, BOT);
    expect(Object.keys(fields)).toEqual(["Favorite Color"]);
    expect(leftovers).toEqual({
      email: "j@acme.com", name: "Jane van Dam", company: "Acme Dental", phone: "555-1234",
    });
  });

  it("an answered identity label suppresses the generic leftover", () => {
    const { leftovers } = buildLinkedFormLeadFields(STEPS, { "Company Name": "Heartland" }, { email: "j@acme.com", company: "Acme Dental" });
    // The answer occupied the company field; the differing bot arg must not
    // resurface as a duplicate generic "Company" column.
    expect(leftovers.company).toBeUndefined();
  });
});
