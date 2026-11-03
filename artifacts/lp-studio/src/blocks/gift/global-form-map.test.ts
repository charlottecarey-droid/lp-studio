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
