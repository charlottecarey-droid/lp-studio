/**
 * Regression — the publish (`migrate` deploy hook) failed with a Postgres
 * deadlock (SQLSTATE 40P01) because the migration DDL ran concurrently with
 * the still-live previous api-server instance. The fix retries the idempotent
 * migration body on transient lock failures. These tests pin down which error
 * codes are classified as retryable so a future refactor can't silently widen
 * the set (retrying a non-transient error would mask real schema bugs) or
 * narrow it (re-introducing the deploy flake).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("./lib/logger", () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import { isRetryableMigrationError } from "./migrate";

describe("isRetryableMigrationError", () => {
  it("treats deadlock_detected (40P01) as retryable", () => {
    expect(isRetryableMigrationError({ code: "40P01" })).toBe(true);
  });

  it("treats serialization_failure (40001) as retryable", () => {
    expect(isRetryableMigrationError({ code: "40001" })).toBe(true);
  });

  it("does NOT retry non-transient SQL errors", () => {
    // undefined_column / undefined_table / syntax / unique violation are real
    // bugs — retrying would just delay the failure and hide the cause.
    expect(isRetryableMigrationError({ code: "42703" })).toBe(false);
    expect(isRetryableMigrationError({ code: "42P01" })).toBe(false);
    expect(isRetryableMigrationError({ code: "42601" })).toBe(false);
    expect(isRetryableMigrationError({ code: "23505" })).toBe(false);
  });

  it("does NOT retry errors with no/odd code", () => {
    expect(isRetryableMigrationError(new Error("boom"))).toBe(false);
    expect(isRetryableMigrationError({ code: 40001 })).toBe(false); // numeric, not string
    expect(isRetryableMigrationError({})).toBe(false);
    expect(isRetryableMigrationError(null)).toBe(false);
    expect(isRetryableMigrationError(undefined)).toBe(false);
    expect(isRetryableMigrationError("40P01")).toBe(false);
  });
});
