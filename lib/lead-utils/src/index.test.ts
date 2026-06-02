import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestLead, looksLikeGibberishName, leadName, leadEmail } from "./index";

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
