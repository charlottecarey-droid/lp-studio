import { describe, expect, it } from "vitest";
import { buildGlobalFormCrmFields, collectCrmSuppressedLabels, omitSuppressedFields } from "./crmFieldSuppression";

describe("collectCrmSuppressedLabels", () => {
  it("collects labels of fields flagged excludeFromCrmSync across steps", () => {
    const steps = [
      {
        title: "Step 1",
        fields: [
          { id: "a", label: "Email", type: "email", required: true },
          { id: "b", label: "Favorite Color", type: "text", required: false, excludeFromCrmSync: true },
        ],
      },
      {
        title: "Step 2",
        fields: [
          { id: "c", label: "T-Shirt Size", type: "select", required: false, excludeFromCrmSync: true },
          { id: "d", label: "Company", type: "text", required: false, excludeFromCrmSync: false },
        ],
      },
    ];
    expect(collectCrmSuppressedLabels(steps)).toEqual(new Set(["Favorite Color", "T-Shirt Size"]));
  });

  it("returns an empty set when no fields are flagged", () => {
    const steps = [{ title: "Step 1", fields: [{ id: "a", label: "Email" }] }];
    expect(collectCrmSuppressedLabels(steps).size).toBe(0);
  });

  it("only honors an explicit boolean true (not truthy strings)", () => {
    const steps = [{ fields: [{ label: "Sneaky", excludeFromCrmSync: "yes" }] }];
    expect(collectCrmSuppressedLabels(steps).size).toBe(0);
  });

  it("tolerates malformed steps JSON", () => {
    expect(collectCrmSuppressedLabels(null).size).toBe(0);
    expect(collectCrmSuppressedLabels(undefined).size).toBe(0);
    expect(collectCrmSuppressedLabels("garbage").size).toBe(0);
    expect(collectCrmSuppressedLabels([{ fields: "not-an-array" }, null]).size).toBe(0);
    expect(collectCrmSuppressedLabels([{ fields: [{ excludeFromCrmSync: true }] }]).size).toBe(0); // no label
  });
});

describe("omitSuppressedFields", () => {
  it("strips suppressed labels and keeps the rest", () => {
    const fields = { Email: "a@b.com", "Favorite Color": "citron", Company: "Acme" };
    expect(omitSuppressedFields(fields, new Set(["Favorite Color"]))).toEqual({
      Email: "a@b.com",
      Company: "Acme",
    });
  });

  it("returns the original object untouched when nothing is suppressed", () => {
    const fields = { Email: "a@b.com" };
    expect(omitSuppressedFields(fields, new Set())).toBe(fields);
  });

  it("does not mutate the input", () => {
    const fields = { Email: "a@b.com", Custom: "x" };
    omitSuppressedFields(fields, new Set(["Custom"]));
    expect(fields).toEqual({ Email: "a@b.com", Custom: "x" });
  });
});

describe("buildGlobalFormCrmFields", () => {
  const steps = [
    {
      title: "Step 1",
      fields: [
        { id: "a", label: "First Name", type: "text" },
        { id: "b", label: "Work Email", type: "email", required: true },
      ],
    },
    {
      title: "Step 2",
      fields: [
        { id: "c", label: "Company", type: "text" },
        { id: "d", label: "Favorite Color", type: "text", excludeFromCrmSync: true },
      ],
    },
  ];

  it("drops producer extras (chat bot) and keeps form fields in definition order", () => {
    // Chat-capture submits form answers in LLM order plus its synthetic keys.
    const submitted = {
      "Chat Summary": "asked about pricing",
      Company: "Acme Dental",
      Source: "Page chat",
      "Work Email": "a@b.com",
      "First Name": "Ada",
      _chatConversationId: "42",
    };
    const out = buildGlobalFormCrmFields(steps, submitted);
    expect(out).toEqual({ "First Name": "Ada", "Work Email": "a@b.com", Company: "Acme Dental" });
    expect(Object.keys(out)).toEqual(["First Name", "Work Email", "Company"]);
  });

  it("honors excludeFromCrmSync on form-defined fields", () => {
    const out = buildGlobalFormCrmFields(steps, { "Work Email": "a@b.com", "Favorite Color": "citron" });
    expect(out).toEqual({ "Work Email": "a@b.com" });
  });

  it("lets extras through when they are named in the per-form CRM field mappings", () => {
    const submitted = { "Work Email": "a@b.com", "Chat Summary": "notes here", Source: "Page chat" };
    const out = buildGlobalFormCrmFields(steps, submitted, ["Chat Summary"]);
    expect(out).toEqual({ "Work Email": "a@b.com", "Chat Summary": "notes here" });
    expect(Object.keys(out)).toEqual(["Work Email", "Chat Summary"]);
  });

  it("suppression wins over an explicit mapping", () => {
    const out = buildGlobalFormCrmFields(steps, { "Work Email": "a@b.com", "Favorite Color": "citron" }, ["Favorite Color"]);
    expect(out).toEqual({ "Work Email": "a@b.com" });
  });

  it("ignores mapped labels that were not submitted", () => {
    const out = buildGlobalFormCrmFields(steps, { "Work Email": "a@b.com" }, ["Chat Summary"]);
    expect(out).toEqual({ "Work Email": "a@b.com" });
  });

  it("rescues a fallback Email under the form's own email label", () => {
    // Bot skipped formAnswers and filed the address under its generic key.
    const out = buildGlobalFormCrmFields(steps, { Email: "a@b.com", "Chat Summary": "x" });
    expect(out).toEqual({ "Work Email": "a@b.com" });
  });

  it("keeps the submitted email key when the form defines no email field", () => {
    const noEmailSteps = [{ fields: [{ id: "a", label: "Company", type: "text" }] }];
    const out = buildGlobalFormCrmFields(noEmailSteps, { Email: "a@b.com", Company: "Acme" });
    expect(out).toEqual({ Company: "Acme", Email: "a@b.com" });
  });

  it("does not rescue an email the form explicitly suppressed", () => {
    const suppressedEmailSteps = [
      { fields: [{ id: "a", label: "Email", type: "email", excludeFromCrmSync: true }, { id: "b", label: "Company", type: "text" }] },
    ];
    const out = buildGlobalFormCrmFields(suppressedEmailSteps, { Email: "a@b.com", Company: "Acme" });
    expect(out).toEqual({ Company: "Acme" });
  });

  it("tolerates malformed steps JSON (mapped extras and email rescue still apply)", () => {
    const out = buildGlobalFormCrmFields("garbage", { Email: "a@b.com", "Chat Summary": "x" }, ["Chat Summary"]);
    expect(out).toEqual({ "Chat Summary": "x", Email: "a@b.com" });
  });
});
