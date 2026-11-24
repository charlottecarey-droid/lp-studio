import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/db", () => ({ db: {}, salesAccountsTable: {}, salesContactsTable: {} }));
import { recipientIdentity } from "./recipient-contacts";

describe("recipientIdentity", () => {
  it("trims and lowercases the email", () => {
    expect(recipientIdentity({ first_name: " Ada ", last_name: "Lovelace ", email: " Ada@X.com ", company: " Acme Dental " })).toEqual({ first: "Ada", last: "Lovelace", email: "ada@x.com", company: "Acme Dental" });
  });
  it("needs a first name and a company", () => {
    expect(recipientIdentity({ first_name: "Ada" })).toBeNull();
    expect(recipientIdentity({ company: "Acme" })).toBeNull();
  });
});
