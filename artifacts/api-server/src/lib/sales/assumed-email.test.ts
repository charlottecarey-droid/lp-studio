/**
 * Unit tests for assumed-email guessing (signals CSV export).
 *
 * The guess must be evidence-driven: pattern and domain both come from the
 * account's KNOWN emails (majority vote), free-mail domains never count as
 * the company domain, and a guess that collides with an address we already
 * know belongs to someone else is suppressed rather than emitted wrong.
 */
import { describe, it, expect } from "vitest";
import {
  guessAssumedEmail,
  detectEmailPattern,
  applyEmailPattern,
  type KnownEmailContact,
} from "./assumed-email";

const k = (firstName: string | null, lastName: string | null, email: string): KnownEmailContact =>
  ({ firstName, lastName, email });

describe("detectEmailPattern", () => {
  it("detects the common corporate patterns", () => {
    expect(detectEmailPattern("Jane", "Doe", "jane.doe@acme.com")).toBe("first.last");
    expect(detectEmailPattern("Jane", "Doe", "jdoe@acme.com")).toBe("flast");
    expect(detectEmailPattern("Jane", "Doe", "janedoe@acme.com")).toBe("firstlast");
    expect(detectEmailPattern("Jane", "Doe", "jane_doe@acme.com")).toBe("first_last");
    expect(detectEmailPattern("Jane", "Doe", "jane@acme.com")).toBe("first");
    expect(detectEmailPattern("Jane", "Doe", "doe.jane@acme.com")).toBe("last.first");
  });

  it("ignores case, accents, and punctuation in names", () => {
    expect(detectEmailPattern("José", "O'Brien", "jose.obrien@acme.com")).toBe("first.last");
    expect(detectEmailPattern("Mary Ann", "Van Der Berg", "maryann.vanderberg@acme.com")).toBe("first.last");
  });

  it("returns null when the local-part matches no derivable pattern", () => {
    expect(detectEmailPattern("Jane", "Doe", "sales@acme.com")).toBeNull();
    expect(detectEmailPattern("Jane", "Doe", "jd123@acme.com")).toBeNull();
  });
});

describe("applyEmailPattern", () => {
  it("returns null when the pattern needs a missing name part", () => {
    expect(applyEmailPattern("first.last", "Jane", null)).toBeNull();
    expect(applyEmailPattern("flast", "", "Doe")).toBeNull();
    expect(applyEmailPattern("first", "Jane", null)).toBe("jane");
  });
});

describe("guessAssumedEmail", () => {
  const acme = [
    k("John", "Smith", "john.smith@acme.com"),
    k("Sara", "Lee", "sara.lee@acme.com"),
    k("Bob", "Jones", "bjones@acme.com"),
  ];

  it("applies the majority pattern on the majority domain", () => {
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, acme))
      .toBe("jane.doe@acme.com");
  });

  it("follows a flast-majority account", () => {
    const known = [
      k("John", "Smith", "jsmith@dental.io"),
      k("Sara", "Lee", "slee@dental.io"),
      k("Ann", "Katz", "ann.katz@dental.io"),
    ];
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, known))
      .toBe("jdoe@dental.io");
  });

  it("never derives the domain from free-mail addresses", () => {
    const known = [k("John", "Smith", "john.smith@gmail.com")];
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, known)).toBeNull();
    // …but the account's own domain field can still anchor the guess.
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, known, "https://www.acme.com/about"))
      .toBe("jane.doe@acme.com");
  });

  it("defaults to first.last on the account domain when there are no known emails", () => {
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, [], "acme.com"))
      .toBe("jane.doe@acme.com");
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, [])).toBeNull();
  });

  it("degrades to a single-name local-part when the pattern needs a part the contact lacks", () => {
    expect(guessAssumedEmail({ firstName: "Jane", lastName: null }, acme)).toBe("jane@acme.com");
    expect(guessAssumedEmail({ firstName: null, lastName: "Doe" }, acme)).toBe("doe@acme.com");
    expect(guessAssumedEmail({ firstName: null, lastName: null }, acme)).toBeNull();
  });

  it("suppresses a guess that collides with a known email of someone else", () => {
    const known = [k("John", "Smith", "john.smith@acme.com"), k("Jane", "Doe", "jane.doe@acme.com")];
    expect(guessAssumedEmail({ firstName: "Jane", lastName: "Doe" }, known)).toBeNull();
  });
});
