/**
 * Unit coverage for the shared in-process fixed-window rate limiter (June
 * 2026 launch hardening) — mounted on the public ingest endpoints
 * (/lp/track, /lp/heatmap, /lp/leads) and, tenant-keyed, on
 * /lp/image/generate.
 *
 * Driven in-process via inject() (the vitest worker pool can't bind a port),
 * mirroring encodedBodyMiddleware.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type RequestHandler } from "express";
import { inject } from "../test-utils/injectRequest";
import { rateLimit, envLimit } from "./rateLimit";
import { logger } from "./logger";

function buildApp(limiter: RequestHandler): Express {
  const app = express();
  // Mirror app.ts so req.ip honours X-Forwarded-For like production.
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post("/hit", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

function hit(app: Express, ip: string) {
  return inject(app, {
    method: "POST",
    url: "/hit",
    headers: { "x-forwarded-for": ip },
    body: {},
  });
}

const WINDOW_MS = 60_000;

describe("rateLimit middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-12T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("allows up to max, then 429s with the contract shape + Retry-After", async () => {
    const app = buildApp(
      rateLimit({ name: "t-shape", windowMs: WINDOW_MS, max: 2 }),
    );

    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    expect((await hit(app, "1.1.1.1")).status).toBe(200);

    const blocked = await hit(app, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect(blocked.json).toEqual({ error: "rate_limited", retryAfter: 60 });
    expect(blocked.headers["retry-after"]).toBe("60");
  });

  it("tracks keys independently (per client IP by default)", async () => {
    const app = buildApp(
      rateLimit({ name: "t-keys", windowMs: WINDOW_MS, max: 1 }),
    );

    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    expect((await hit(app, "1.1.1.1")).status).toBe(429);
    // A different IP has its own untouched allowance.
    expect((await hit(app, "2.2.2.2")).status).toBe(200);
  });

  it("resets the window after windowMs (rollover)", async () => {
    const app = buildApp(
      rateLimit({ name: "t-rollover", windowMs: WINDOW_MS, max: 1 }),
    );

    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    expect((await hit(app, "1.1.1.1")).status).toBe(429);

    vi.setSystemTime(Date.now() + WINDOW_MS + 1);
    expect((await hit(app, "1.1.1.1")).status).toBe(200);
  });

  it("shrinks Retry-After as the window progresses", async () => {
    const app = buildApp(
      rateLimit({ name: "t-retry-after", windowMs: WINDOW_MS, max: 1 }),
    );

    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    vi.setSystemTime(Date.now() + 45_000); // 15s left in the window
    const blocked = await hit(app, "1.1.1.1");
    expect(blocked.status).toBe(429);
    expect((blocked.json as { retryAfter: number }).retryAfter).toBe(15);
    expect(blocked.headers["retry-after"]).toBe("15");
  });

  it("caps tracked keys and evicts the oldest (spoofed-IP flood guard)", async () => {
    const app = buildApp(
      rateLimit({ name: "t-evict", windowMs: WINDOW_MS, max: 1, maxKeys: 2 }),
    );

    // Exhaust IP A's allowance — a repeat would 429.
    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    expect((await hit(app, "1.1.1.1")).status).toBe(429);

    // Two more keys push the table past maxKeys → A (oldest) is evicted.
    expect((await hit(app, "2.2.2.2")).status).toBe(200);
    expect((await hit(app, "3.3.3.3")).status).toBe(200);

    // A returns inside the same window: it gets a FRESH bucket (eviction
    // happened — bounded memory beats perfect accounting), so it's allowed…
    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    // …and the fresh bucket still enforces the limit on the next hit.
    expect((await hit(app, "1.1.1.1")).status).toBe(429);
  });

  it("supports a custom keyFn (e.g. per-tenant keys)", async () => {
    const app = buildApp(
      rateLimit({
        name: "t-tenant",
        windowMs: WINDOW_MS,
        max: 1,
        keyFn: () => "tenant:1",
      }),
    );

    // Two different IPs share the tenant bucket.
    expect((await hit(app, "1.1.1.1")).status).toBe(200);
    expect((await hit(app, "2.2.2.2")).status).toBe(429);
  });

  it("warn-logs at most once per key per window (sampled abuse log)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined as never);
    const app = buildApp(
      rateLimit({ name: "t-warn", windowMs: WINDOW_MS, max: 1 }),
    );

    await hit(app, "1.1.1.1");
    await hit(app, "1.1.1.1"); // first 429 → one warn
    await hit(app, "1.1.1.1"); // second 429, same window → no extra warn
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatchObject({
      event: "rate_limited",
      limiter: "t-warn",
      key: "1.1.1.1",
    });

    // New window → the next over-limit warns again.
    vi.setSystemTime(Date.now() + WINDOW_MS + 1);
    await hit(app, "1.1.1.1");
    await hit(app, "1.1.1.1");
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe("envLimit", () => {
  it("parses positive integers and falls back otherwise", () => {
    const key = "TEST_RATE_LIMIT_PER_MIN";
    const prev = process.env[key];
    try {
      delete process.env[key];
      expect(envLimit(key, 500)).toBe(500);
      process.env[key] = "120";
      expect(envLimit(key, 500)).toBe(120);
      process.env[key] = "0";
      expect(envLimit(key, 500)).toBe(500);
      process.env[key] = "garbage";
      expect(envLimit(key, 500)).toBe(500);
    } finally {
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });
});
