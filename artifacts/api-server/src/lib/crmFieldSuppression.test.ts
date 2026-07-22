import { describe, expect, it } from "vitest";
import { collectCrmSuppressedLabels, omitSuppressedFields } from "./crmFieldSuppression";

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
