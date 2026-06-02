/**
 * Unit test for Resend webhook signature verification (Prompt 1, Fix 3).
 *
 * The webhook mutates send + signal state, so it must ALWAYS verify the HMAC
 * signature and never process an unsigned/forged request:
 *  - with no secret configured (dev/test): reject every request (fail-closed),
 *  - with a secret: accept a correctly-signed body, reject a tampered one.
 *
 * The router captures RESEND_WEBHOOK_SECRET into a module-level const at import
 * time, so each case sets the env, resets the module registry, and re-imports
 * the router. Events without an `email_id` skip the DB lookup, keeping these
 * cases pure (no Postgres required).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import { createHmac } from "node:crypto";
import { inject } from "../../test-utils/injectRequest";

const origSecret = process.env.RESEND_WEBHOOK_SECRET;
const origNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (origSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = origSecret;
  process.env.NODE_ENV = origNodeEnv;
  vi.resetModules();
});

async function buildApp(): Promise<Express> {
  vi.resetModules();
  const mod = await import("./resend-webhook");
  const app = express();
  app.use(express.json());
  app.use("/webhooks", mod.default);
  return app;
}

describe("Resend webhook signature verification (Fix 3)", () => {
  it("rejects an UNSIGNED webhook when no secret is configured (fail-closed, dev)", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    process.env.NODE_ENV = "test";
    const app = await buildApp();
    const res = await inject(app, {
      method: "POST",
      url: "/webhooks/resend",
      body: { type: "email.sent" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts a correctly-signed webhook and rejects a tampered signature", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test_fix3";
    process.env.NODE_ENV = "test";
    const app = await buildApp();

    const payload = { type: "email.sent" }; // no email_id → no DB lookup
    const raw = JSON.stringify(payload);
    const sig = createHmac("sha256", "whsec_test_fix3").update(raw).digest("hex");

    const good = await inject(app, {
      method: "POST",
      url: "/webhooks/resend",
      body: payload,
      headers: { "resend-signature": sig },
    });
    expect(good.status).toBe(200);

    const bad = await inject(app, {
      method: "POST",
      url: "/webhooks/resend",
      body: payload,
      headers: { "resend-signature": "deadbeef" },
    });
    expect(bad.status).toBe(401);
  });
});
