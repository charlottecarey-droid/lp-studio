/**
 * Round-trip coverage for the `__encoded` request-body unwrapper mounted in
 * app.ts (see lib/encodedBodyMiddleware.ts). The client (lp-studio's
 * api-fetch.ts) base64-wraps any same-origin /api body that carries the
 * WAF-tripping href-token pattern so the raw email HTML never reaches the
 * Cloudflare edge. This middleware must decode that wrapper back into req.body
 * transparently, so downstream handlers see the original payload.
 *
 * Driven in-process via inject() (the vitest worker pool can't bind a port).
 */
import { describe, it, expect } from "vitest";
import express, { type Express } from "express";
import { inject } from "../test-utils/injectRequest";
import { decodeEncodedBody } from "./encodedBodyMiddleware";

// Mirror app.ts's mount order: json parser, then the unwrapper, then a route
// that echoes whatever req.body the handler ultimately sees.
function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(decodeEncodedBody);
  app.post("/echo", (req, res) => {
    res.json({ body: req.body });
  });
  return app;
}

// The exact wire format lp-studio's encodeBodyForWaf produces: a base64 of the
// UTF-8 JSON, wrapped as `{ __encoded }`.
function wrap(payload: unknown): string {
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);
  return JSON.stringify({ __encoded: Buffer.from(json, "utf8").toString("base64") });
}

const STYLED_EMAIL_PAYLOAD = {
  subject: "Your page is live",
  bodyHtml:
    '<a href="{{microsite_url}}">View your page</a>' +
    '<a href="{{unsubscribe_url}}">Unsubscribe</a>',
};

describe("decodeEncodedBody middleware", () => {
  it("round-trips a base64-wrapped styled-email payload back into req.body", async () => {
    const app = buildApp();
    const res = await inject(app, {
      method: "POST",
      url: "/echo",
      body: wrap(STYLED_EMAIL_PAYLOAD),
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ body: STYLED_EMAIL_PAYLOAD });
  });

  it("preserves multi-byte UTF-8 content through the round-trip", async () => {
    const payload = { bodyHtml: '<a href="{{microsite_url}}">café ☕ 日本</a>' };
    const app = buildApp();
    const res = await inject(app, { method: "POST", url: "/echo", body: wrap(payload) });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ body: payload });
  });

  it("passes a normal (unwrapped) JSON body through untouched", async () => {
    const app = buildApp();
    const plain = { subject: "Hello", bodyText: "No tokens here." };
    const res = await inject(app, { method: "POST", url: "/echo", body: plain });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ body: plain });
  });

  it("rejects a wrapper whose base64 is not valid JSON", async () => {
    const app = buildApp();
    const badBase64 = Buffer.from("not json", "utf8").toString("base64");
    const res = await inject(app, {
      method: "POST",
      url: "/echo",
      body: JSON.stringify({ __encoded: badBase64 }),
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Malformed encoded request body" });
  });

  it("rejects a wrapper that decodes to a non-object (array/primitive)", async () => {
    const app = buildApp();
    const res = await inject(app, {
      method: "POST",
      url: "/echo",
      body: wrap([1, 2, 3]),
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "Malformed encoded request body" });
  });
});
