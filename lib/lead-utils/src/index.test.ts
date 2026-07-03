import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestLead, looksLikeGibberishName, leadName, leadEmail, cleanAccountDisplayName } from "./index";

test("isTestLead flags throwaway email domains and local parts", () => {
  assert.equal(isTestLead({ email: "someone@example.com" }), true);
  assert.equal(isTestLead({ email: "foo@mailinator.com" }), true);
  assert.equal(isTestLead({ Email: "test@acme.com" }), true);
  assert.equal(isTestLead({ email: "jane+test@acme.com" }), true);
  assert.equal(isTestLead({ email: "qa@acme.com" }), true);
});

test("isTestLead flags filler names", () => {
  assert.equal(isTestLead({ name: "Test User" }), true);
  assert.equal(isTestLead({ name: "John Doe" }), true);
  assert.equal(isTestLead({ firstName: "QWERTY", lastName: "" }), true);
});

test("looksLikeGibberishName catches keyboard mash and consonant runs", () => {
  assert.equal(looksLikeGibberishName("asdfgh"), true);
  assert.equal(looksLikeGibberishName("qwerty"), true);
  assert.equal(looksLikeGibberishName("qwxz"), true); // no vowels
  assert.equal(looksLikeGibberishName("zxcvbnm"), true);
});

test("looksLikeGibberishName stays conservative for real names", () => {
  for (const n of ["Ng", "Wu", "Li", "Jo", "Lynn", "Cyrus", "Schmidt", "Anya", "Bo", "Yusuf", "Priya", "Ravi", "Quinn"]) {
    assert.equal(looksLikeGibberishName(n), false, `expected "${n}" to be treated as a real name`);
  }
});

test("isTestLead does not flag a normal lead", () => {
  assert.equal(isTestLead({ firstName: "Jane", lastName: "Smith", email: "jane.smith@hospital.org" }), false);
  assert.equal(isTestLead({ "Full Name": "Carlos Mendez", "Email Address": "carlos@clinic.com" }), false);
});

test("leadName / leadEmail normalize variant field keys", () => {
  assert.equal(leadName({ "First Name": "Ada", "Last Name": "Lovelace" }), "Ada Lovelace");
  assert.equal(leadName({ name: "Grace Hopper" }), "Grace Hopper");
  assert.equal(leadName({ phone: "555" }), null);
  assert.equal(leadEmail({ "Email Address": "ada@calc.io" }), "ada@calc.io");
});

test("cleanAccountDisplayName strips HQ decorations in every observed production shape", () => {
  assert.equal(cleanAccountDisplayName("Heartland Dental-HQ"), "Heartland Dental");
  assert.equal(cleanAccountDisplayName("Bridge Dental Group- HQ"), "Bridge Dental Group");
  assert.equal(cleanAccountDisplayName("Dental Care Alliance-HQ"), "Dental Care Alliance");
  assert.equal(cleanAccountDisplayName("The Smilist Dental-HQ"), "The Smilist Dental");
  assert.equal(cleanAccountDisplayName("TAG - The Aspen Group (Aspen Dental)-HQ"), "TAG - The Aspen Group (Aspen Dental)");
  assert.equal(cleanAccountDisplayName("Acme Dental (HQ)"), "Acme Dental");
});

test("cleanAccountDisplayName strips trailing corporate suffixes but keeps casing", () => {
  assert.equal(cleanAccountDisplayName("Btydental Group Llc"), "Btydental Group");
  assert.equal(cleanAccountDisplayName("Acme Dental, Inc."), "Acme Dental");
  assert.equal(cleanAccountDisplayName("Northwind Corp"), "Northwind");
});

test("cleanAccountDisplayName leaves clean names untouched and never returns empty", () => {
  assert.equal(cleanAccountDisplayName("Heartland Dental"), "Heartland Dental");
  assert.equal(cleanAccountDisplayName("HQ"), "HQ");
  assert.equal(cleanAccountDisplayName("  "), "");
  assert.equal(cleanAccountDisplayName(null), "");
});
