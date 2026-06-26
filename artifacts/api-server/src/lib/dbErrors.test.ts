/**
 * dbErrors.isUniqueViolation unit tests (pure — no DB, no HTTP).
 *
 * Regression guard: drizzle-orm wraps the driver error in a DrizzleQueryError
 * whose own `.code` is undefined and carries the real pg error on `.cause`.
 * The sales microsite slug-uniqueness retry depends on this detection — if it
 * only inspected the top-level `.code`, the 23505 would be missed and the first
 * slug collision would throw instead of retrying.
 */
import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./dbErrors";

/** Minimal stand-in for drizzle's DrizzleQueryError: a wrapper Error whose
 *  `.cause` carries the original pg error (which holds the SQLSTATE `.code`). */
class FakeDrizzleQueryError extends Error {
  cause?: unknown;
  constructor(message: string, cause: unknown) {
    super(message);
    this.cause = cause;
  }
}

describe("isUniqueViolation", () => {
  it("detects a bare pg unique-violation error (code at top level)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects 23505 carried on `.cause` (drizzle-wrapped error)", () => {
    const wrapped = new FakeDrizzleQueryError("Failed query: insert into ...", { code: "23505" });
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("walks multiple cause levels to find 23505", () => {
    const deep = new FakeDrizzleQueryError("outer", new FakeDrizzleQueryError("inner", { code: "23505" }));
    expect(isUniqueViolation(deep)).toBe(true);
  });

  it("returns false for a non-unique pg error code", () => {
    const wrapped = new FakeDrizzleQueryError("Failed query: ...", { code: "23503" });
    expect(isUniqueViolation(wrapped)).toBe(false);
  });

  it("returns false when no pg code is present anywhere in the chain", () => {
    expect(isUniqueViolation(new Error("plain error"))).toBe(false);
  });

  it("is null/undefined/non-object safe", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("does not loop forever on a self-referential cause chain", () => {
    const e = new FakeDrizzleQueryError("self", null);
    e.cause = e;
    expect(isUniqueViolation(e)).toBe(false);
  });
});
