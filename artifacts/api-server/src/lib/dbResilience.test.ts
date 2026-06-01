/**
 * Unit tests for the transient-DB resilience helpers used by the Sales
 * Console campaign launch / send hot paths (task: "Fix quick campaign that
 * won't send"). These guard the classification boundary (only connection /
 * pool-saturation failures are retryable — never query-level bugs) and the
 * retry-then-rethrow behaviour of withDbRetry.
 */
import { describe, it, expect } from "vitest";
import { isTransientDbError, withDbRetry } from "./dbResilience";

describe("isTransientDbError", () => {
  it("matches the pg connection-timeout message seen in prod", () => {
    expect(isTransientDbError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isTransientDbError(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isTransientDbError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });

  it("matches socket-level transient codes", () => {
    expect(isTransientDbError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientDbError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientDbError({ code: "econnreset" })).toBe(true);
  });

  it("matches postgres too-many-connections SQLSTATEs", () => {
    expect(isTransientDbError({ code: "53300", message: "too many clients already" })).toBe(true);
    expect(isTransientDbError({ code: "57P03" })).toBe(true);
  });

  it("does NOT match deterministic query errors", () => {
    // undefined_column — a real code bug, must surface loudly.
    expect(isTransientDbError({ code: "42703", message: 'column "foo" does not exist' })).toBe(false);
    // unique_violation
    expect(isTransientDbError({ code: "23505", message: "duplicate key value" })).toBe(false);
    expect(isTransientDbError(new Error("some other error"))).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError("just a string")).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("returns the result on first success", async () => {
    let calls = 0;
    const out = await withDbRetry(async () => { calls++; return "ok"; });
    expect(out).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries a transient failure then succeeds", async () => {
    let calls = 0;
    const out = await withDbRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("Connection terminated due to connection timeout");
      return "recovered";
    }, { baseDelayMs: 1 });
    expect(out).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("rethrows a non-transient error immediately without retrying", async () => {
    let calls = 0;
    await expect(withDbRetry(async () => {
      calls++;
      throw Object.assign(new Error('column "x" does not exist'), { code: "42703" });
    }, { baseDelayMs: 1 })).rejects.toThrow("does not exist");
    expect(calls).toBe(1);
  });

  it("gives up after exhausting retries on a persistent transient error", async () => {
    let calls = 0;
    await expect(withDbRetry(async () => {
      calls++;
      throw new Error("timeout exceeded when trying to connect");
    }, { retries: 2, baseDelayMs: 1 })).rejects.toThrow("timeout exceeded");
    expect(calls).toBe(3); // initial + 2 retries
  });
});
