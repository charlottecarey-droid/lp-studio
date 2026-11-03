import { describe, expect, it } from "vitest";
import type { FormStep } from "@/lib/block-types";
import { classifyGlobalField, giftSummary, mapToGlobalForm } from "./global-form-map";

const steps: FormStep[] = [{
  title: "Your Information",
  fields: [
    { id: "a", type: "text", label: "First Name", required: true },
    { id: "b", type: "text", label: "Last Name", required: true },
    { id: "c", type: "email", label: "Email Address", required: true },
    { id: "d", type: "text", label: "Company / Practice", required: false },
    { id: "e", type: "phone", label: "Phone Number", required: false },
    { id: "f", type: "textarea", label: "Message", required: false },
    { id: "g", type: "select", label: "Number of locations", required: false, options: ["1-9", "10+"] },
    { id: "h", type: "hidden", label: "Lead Source", required: false, defaultValue: "Holiday gift page" },
  ],
}];

const values = { firstName: "Gilberto", lastName: "Ruiz", email: "g@apex.com", company: "Apex", phone: "555", gift: "Lab Tour in a Box", address: "1 Main St", city: "Austin", state: "TX", zip: "78701", notes: "Front desk" };
const native = { Gift: "Lab Tour in a Box", "First name": "Gilberto", "Last name": "Ruiz", Email: "g@apex.com", "DSO / organization": "Apex", Phone: "555", "Shipping address": "1 Main St", City: "Austin", State: "TX", ZIP: "78701", "Delivery notes": "Front desk", "Sent by": "Dan MacAdam", Source: "holiday-gift" };

describe("classifyGlobalField", () => {
  it("judges by type first, then by label keywords", () => {
    expect(classifyGlobalField({ type: "email", label: "Work e-mail" })).toBe("email");
    expect(classifyGlobalField({ type: "text", label: "Full Name" })).toBe("fullName");
    expect(classifyGlobalField({ type: "text", label: "Company Name" })).toBe("company");
    expect(classifyGlobalField({ type: "text", label: "Job Title" })).toBe("role");
    expect(classifyGlobalField({ type: "text", label: "Postal code" })).toBe("zip");
    expect(classifyGlobalField({ type: "select", label: "Number of locations" })).toBeNull();
    expect(classifyGlobalField({ type: "text", label: "Favourite colour" })).toBeNull();
  });
});

describe("mapToGlobalForm", () => {
  it("files gift values under the global form's labels, resolves hidden fields, keeps gift extras, drops native duplicates", () => {
    const out = mapToGlobalForm(steps, values, native);
    expect(out["First Name"]).toBe("Gilberto");
    expect(out["Last Name"]).toBe("Ruiz");
    expect(out["Email Address"]).toBe("g@apex.com");
    expect(out["Company / Practice"]).toBe("Apex");
    expect(out["Phone Number"]).toBe("555");
    expect(out.Message).toBe("Gift: Lab Tour in a Box\nShip to: 1 Main St, Austin, TX 78701\nDelivery notes: Front desk");
    expect(out["Lead Source"]).toBe("Holiday gift page");
    expect(out).not.toHaveProperty("Number of locations");
    // duplicates of covered concepts are gone, gift-specific extras remain
    expect(out).not.toHaveProperty("First name");
    expect(out).not.toHaveProperty("Email");
    expect(out).not.toHaveProperty("Phone");
    expect(out.Gift).toBe("Lab Tour in a Box");
    expect(out["Shipping address"]).toBe("1 Main St");
    expect(out["Sent by"]).toBe("Dan MacAdam");
    expect(out["DSO / organization"]).toBe("Apex");
  });

  it("joins first + last for a single Name field and keeps a native label the form shares", () => {
    const s: FormStep[] = [{ title: "", fields: [{ id: "n", type: "text", label: "Name", required: true }, { id: "e", type: "email", label: "Email", required: true }] }];
    const out = mapToGlobalForm(s, values, native);
    expect(out.Name).toBe("Gilberto Ruiz");
    expect(out.Email).toBe("g@apex.com");
    expect(out).not.toHaveProperty("First name");
  });

  it("with no form definition returns the native fields untouched", () => {
    expect(mapToGlobalForm(undefined, values, native)).toEqual(native);
    expect(giftSummary({ gift: "Tee", size: "M" })).toBe("Gift: Tee (M)");
  });
});

describe("the Dandy 'Holiday Gifts' global form (labels mirror the gift form)", () => {
  const holidayForm: FormStep[] = [{ title: "Holiday gift", fields: [
    { id: "1", type: "text", label: "First name", required: true },
    { id: "2", type: "text", label: "Last name", required: true },
    { id: "3", type: "email", label: "Email", required: true },
    { id: "4", type: "text", label: "Company / Practice", required: false },
    { id: "5", type: "text", label: "Role", required: false },
    { id: "6", type: "phone", label: "Phone", required: false },
    { id: "7", type: "text", label: "Gift", required: true, excludeFromCrmSync: true },
    { id: "8", type: "text", label: "Size", required: false, excludeFromCrmSync: true },
    { id: "9", type: "text", label: "Shipping address", required: true, excludeFromCrmSync: true },
    { id: "10", type: "text", label: "Suite / unit", required: false, excludeFromCrmSync: true },
    { id: "11", type: "text", label: "City", required: true, excludeFromCrmSync: true },
    { id: "12", type: "text", label: "State", required: true, excludeFromCrmSync: true },
    { id: "13", type: "text", label: "ZIP", required: true, excludeFromCrmSync: true },
    { id: "14", type: "text", label: "Delivery notes", required: false, excludeFromCrmSync: true },
    { id: "15", type: "text", label: "Sent by", required: false, excludeFromCrmSync: true },
    { id: "16", type: "text", label: "Rep", required: false, excludeFromCrmSync: true },
    { id: "17", type: "text", label: "Campaign", required: false, excludeFromCrmSync: true },
    { id: "18", type: "text", label: "Source", required: false, excludeFromCrmSync: true },
  ] }];

  it("every form field is filled from the gift submission, in place, with nothing overwritten by a summary", () => {
    const out = mapToGlobalForm(holidayForm, { ...values, role: "COO" }, { ...native, Role: "COO", "Suite / unit": "", Size: "", Rep: "dan", Campaign: "holiday-2026" });
    for (const f of holidayForm[0].fields) expect(out, f.label).toHaveProperty(f.label);
    expect(out["Delivery notes"]).toBe("Front desk");
    expect(out["Company / Practice"]).toBe("Apex");
    expect(out["Shipping address"]).toBe("1 Main St");
    expect(out.Gift).toBe("Lab Tour in a Box");
    expect(out["Sent by"]).toBe("Dan MacAdam");
    expect(out["First name"]).toBe("Gilberto");
    expect(out.Email).toBe("g@apex.com");
  });
});
