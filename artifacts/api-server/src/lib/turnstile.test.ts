/**
 * Unit test for Turnstile runtime fail-closed gating (Prompt 1, Fix 5).
 *
 * verifyTurnstile() must fail CLOSED in production when the secret is missing —
 * waving requests through on a live deploy would silently disable bot
 * protection on the public auth endpoints. Outside production it stays keyless
 * (open) so dev / e2e run without provisioning a secret.
 */
import { describe, it, expect, afterEach } from "vitest";
import { verifyTurnstile } from "./turnstile";

describe("verifyTurnstile fail-closed gating (Fix 5)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origSecret = process.env.TURNSTILE_SECRET_KEY;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = origSecret;
  });

  it("fails CLOSED in production when the secret is missing", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = "production";
    const r = await verifyTurnstile("any-token");
    expect(r).toEqual({ ok: false, configured: false });
  });

  it("stays keyless (open) outside production when the secret is missing", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = "test";
    const r = await verifyTurnstile(undefined);
    expect(r).toEqual({ ok: true, configured: false });
  });
});
