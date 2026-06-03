/**
 * Hermetic route tests for the Content Series notify HTTP surface (Task #818).
 *
 * Task #812 covered the notification ENGINE (`contentSeriesNotify.ts`); this
 * file covers the three HTTP routes that sit in front of it, which until now
 * were only verified by hand:
 *
 *   GET  /lp/content-series/notify-status  (authed) — subscriber/pending counts
 *   POST /lp/content-series/notify         (authed) — manual send for one episode
 *   GET  /lp/content-series/unsubscribe    (public) — signed-token lead opt-out
 *
 * The first two enforce TENANT ISOLATION: a logged-in user may only read status
 * for / trigger sends about a page that belongs to THEIR tenant. A regression
 * here would let one workspace email another workspace's subscribers about its
 * episodes — exactly the leak this test guards. The public unsubscribe route
 * must record the opt-out for a valid signed token and render the
 * invalid/expired page for a bad one.
 *
 * Like the engine test (see `.agents/memory/hermetic-ephemeral-pg-tests.md`),
 * this stands up its OWN throwaway Postgres and repoints the db env BEFORE the
 * first `@workspace/db` import — dev's `NEON_DATABASE_URL` points at PRODUCTION
 * Neon, so the router, the auth middleware and the engine are ALL imported
 * dynamically after the ephemeral cluster is live. Requests are injected
 * IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/injectRequest), running the full middleware chain (cookie-parser,
 * body parsing, the production-style auth guard, the route handlers). The only
 * stub is the outbound Resend HTTP call so no real email leaves the box.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
// Type-only import — does NOT trigger a runtime load of @workspace/db, so it is
// safe to keep at the top despite the dynamic-import rule for runtime modules.
import type { AuthUser } from "../../middleware/requireAuth";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// all of these transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
type AuthMod = typeof import("../../middleware/requireAuth");
type Notify = typeof import("../../lib/contentSeriesNotify");
type RouterMod = typeof import("./content-series");
let pgMod: Pg;
let auth: AuthMod;
let notify: Notify;

let epg: EphemeralPg;
let app: Express;
let SESSION_COOKIE = "lp_sid";

let seq = 0;

/** Walk up from cwd to find the repo's `lib/db` package dir. */
function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;
  // A fake key keeps the send path alive (the engine bails early when
  // RESEND_API_KEY is unset) while the stubbed fetch makes sure nothing
  // actually leaves the box. The secret signs the unsubscribe tokens.
  process.env.RESEND_API_KEY = "re_test_fake";
  process.env.NOTIFICATION_PREFS_SECRET = "test-unsub-secret";

  // 2. Build the real schema straight from the drizzle schema definitions.
  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`,
    );
  }

  // 3. Now it is safe to load the db layer, the auth middleware, the engine
  //    and the router under test.
  pgMod = await import("@workspace/db");
  auth = await import("../../middleware/requireAuth");
  notify = await import("../../lib/contentSeriesNotify");
  const routerMod: RouterMod = await import("./content-series");
  SESSION_COOKIE = auth.SESSION_COOKIE;

  // 4. Mount the router behind the SAME public/authed split the production app
  //    applies (see routes/index.ts): the unsubscribe route is public, every
  //    other content-series route requires a session.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.method === "GET" && req.path === "/lp/content-series/unsubscribe") {
      next();
      return;
    }
    void auth.requireAuth(req, res, next);
  });
  app.use(routerMod.default);
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

/** Stub Resend's HTTP endpoint with a 200, returning the spy so callers can
 *  assert exactly how many sends were attempted. */
function stubResendOk(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
}

function injectSid(opts: {
  method: string;
  url: string;
  sid?: string;
  body?: unknown;
}): Promise<InjectResponse> {
  const headers: Record<string, string> = {};
  if (opts.sid) headers["cookie"] = `${SESSION_COOKIE}=${opts.sid}`;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

/** A content-series block tree for an `lp_pages.blocks` jsonb column. */
function contentSeriesBlocks(opts: {
  seriesTitle: string;
  episodes: { slug: string; title: string }[];
}): unknown[] {
  return [
    {
      type: "content-series",
      props: {
        seriesTitle: opts.seriesTitle,
        subscribeNotifyAutoSend: false,
        episodes: opts.episodes.map((e) => ({
          slug: e.slug,
          title: e.title,
          description: "",
          ctaUrl: "https://example.org/watch",
        })),
      },
    },
  ];
}

/** Seed a tenant + a session for one of its admins; returns ids and the sid. */
async function seedTenantWithSession(blocks: unknown = []): Promise<{
  tenantId: number;
  pageId: number;
  sid: string;
}> {
  const { pool } = pgMod;
  const uniq = `${Date.now()}-${seq++}-${randomUUID().slice(0, 8)}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`CS Routes ${uniq}`, `cs-routes-${uniq}`],
  );
  const tenantId = t.rows[0]!.id;
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status)
     VALUES ($1, $2, $3, $4::jsonb, 'published') RETURNING id`,
    [tenantId, `Series ${uniq}`, `series-${uniq}`, JSON.stringify(blocks)],
  );
  const pageId = p.rows[0]!.id;

  const sid = `it-csnr-${uniq}`;
  const sess: AuthUser = {
    userId: 990000 + seq,
    email: `admin-${uniq}@example.com`,
    name: "CS Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, JSON.stringify(sess)],
  );
  return { tenantId, pageId, sid };
}

/** Seed a subscriber lead captured via the block's built-in Subscribe form. */
async function seedSubscriber(
  tenantId: number,
  pageId: number,
  email: string,
): Promise<void> {
  const { pool } = pgMod;
  const fields = JSON.stringify({ _source: "content-series-subscribe", email, name: "Real Person" });
  await pool.query(
    `INSERT INTO lp_leads (tenant_id, page_id, fields) VALUES ($1, $2, $3::jsonb)`,
    [tenantId, pageId, fields],
  );
}

describe("content-series notify-status route — tenant isolation (Task #818)", () => {
  it("reports correct counts for the caller's own page", async () => {
    const { tenantId, pageId, sid } = await seedTenantWithSession(
      contentSeriesBlocks({ seriesTitle: "My Series", episodes: [{ slug: "ep-1", title: "Episode One" }] }),
    );
    // Three subscribers: one already notified, one opted out, one pending.
    await seedSubscriber(tenantId, pageId, "sent@gmail.com");
    await seedSubscriber(tenantId, pageId, "optout@gmail.com");
    await seedSubscriber(tenantId, pageId, "pending@gmail.com");
    await pgMod.pool.query(
      `INSERT INTO content_series_episode_sends (tenant_id, page_id, episode_key, recipient_email)
       VALUES ($1, $2, 'ep-1', 'sent@gmail.com')`,
      [tenantId, pageId],
    );
    await pgMod.pool.query(
      `INSERT INTO content_series_unsubscribes (tenant_id, page_id, email)
       VALUES ($1, $2, 'optout@gmail.com')`,
      [tenantId, pageId],
    );

    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/notify-status?pageId=${pageId}&episodeKey=ep-1`,
      sid,
    });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      totalSubscribers: 3,
      optedOut: 1,
      alreadyNotified: 1,
      pending: 1,
    });
  });

  it("401s without a session", async () => {
    const { pageId } = await seedTenantWithSession();
    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/notify-status?pageId=${pageId}&episodeKey=ep-1`,
    });
    expect(res.status).toBe(401);
  });

  it("404s a pageId that belongs to ANOTHER tenant", async () => {
    // Caller is tenant A; the page belongs to tenant B.
    const a = await seedTenantWithSession();
    const b = await seedTenantWithSession(
      contentSeriesBlocks({ seriesTitle: "Other", episodes: [{ slug: "ep-1", title: "Episode One" }] }),
    );
    await seedSubscriber(b.tenantId, b.pageId, "victim@gmail.com");

    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/notify-status?pageId=${b.pageId}&episodeKey=ep-1`,
      sid: a.sid,
    });
    expect(res.status).toBe(404);
  });
});

describe("content-series notify route — tenant isolation (Task #818)", () => {
  it("sends to the caller's own subscribers and returns the result", async () => {
    const { tenantId, pageId, sid } = await seedTenantWithSession(
      contentSeriesBlocks({ seriesTitle: "My Series", episodes: [{ slug: "ep-1", title: "Episode One" }] }),
    );
    await seedSubscriber(tenantId, pageId, "alice@gmail.com");
    await seedSubscriber(tenantId, pageId, "bob@gmail.com");

    const fetchSpy = stubResendOk();
    const res = await injectSid({
      method: "POST",
      url: `/lp/content-series/notify`,
      sid,
      body: { pageId, episodeKey: "ep-1" },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ totalSubscribers: 2, sent: 2, failed: 0, optedOut: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // The send ledger now carries both recipients for this episode.
    const c = await pgMod.pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM content_series_episode_sends WHERE page_id = $1 AND episode_key = 'ep-1'`,
      [pageId],
    );
    expect(Number(c.rows[0]!.c)).toBe(2);
  });

  it("404s when the page belongs to ANOTHER tenant (no cross-workspace send)", async () => {
    const a = await seedTenantWithSession();
    const b = await seedTenantWithSession(
      contentSeriesBlocks({ seriesTitle: "Other", episodes: [{ slug: "ep-1", title: "Episode One" }] }),
    );
    await seedSubscriber(b.tenantId, b.pageId, "victim@gmail.com");

    const fetchSpy = stubResendOk();
    const res = await injectSid({
      method: "POST",
      url: `/lp/content-series/notify`,
      sid: a.sid,
      body: { pageId: b.pageId, episodeKey: "ep-1" },
    });
    expect(res.status).toBe(404);
    // Crucially, NOTHING was sent to the other tenant's subscriber.
    expect(fetchSpy).not.toHaveBeenCalled();
    const c = await pgMod.pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM content_series_episode_sends WHERE page_id = $1`,
      [b.pageId],
    );
    expect(Number(c.rows[0]!.c)).toBe(0);
  });

  it("404s when the episode key is not on the caller's page", async () => {
    const { tenantId, pageId, sid } = await seedTenantWithSession(
      contentSeriesBlocks({ seriesTitle: "My Series", episodes: [{ slug: "ep-1", title: "Episode One" }] }),
    );
    await seedSubscriber(tenantId, pageId, "alice@gmail.com");

    const fetchSpy = stubResendOk();
    const res = await injectSid({
      method: "POST",
      url: `/lp/content-series/notify`,
      sid,
      body: { pageId, episodeKey: "no-such-episode" },
    });
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("content-series unsubscribe route — public signed-token opt-out (Task #818)", () => {
  it("records the opt-out for a valid signed token", async () => {
    const { tenantId, pageId } = await seedTenantWithSession();
    await seedSubscriber(tenantId, pageId, "leaver@gmail.com");

    const token = notify.makeLeadUnsubToken(tenantId, pageId, "leaver@gmail.com");
    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/unsubscribe?token=${encodeURIComponent(token)}`,
    });
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("html");
    expect(res.text).toContain("unsubscribed");

    const r = await pgMod.pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM content_series_unsubscribes
         WHERE tenant_id = $1 AND page_id = $2 AND email = 'leaver@gmail.com'`,
      [tenantId, pageId],
    );
    expect(Number(r.rows[0]!.c)).toBe(1);
  });

  it("shows the invalid/expired page for a tampered token without recording anything", async () => {
    const { tenantId, pageId } = await seedTenantWithSession();
    const token = notify.makeLeadUnsubToken(tenantId, pageId, "leaver@gmail.com");

    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/unsubscribe?token=${encodeURIComponent(token + "tamper")}`,
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain("invalid or has expired");

    const r = await pgMod.pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM content_series_unsubscribes WHERE page_id = $1`,
      [pageId],
    );
    expect(Number(r.rows[0]!.c)).toBe(0);
  });

  it("shows the invalid/expired page when no token is supplied", async () => {
    const res = await injectSid({
      method: "GET",
      url: `/lp/content-series/unsubscribe`,
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain("invalid or has expired");
  });
});
