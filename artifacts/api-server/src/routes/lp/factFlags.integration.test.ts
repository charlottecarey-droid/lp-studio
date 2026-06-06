/**
 * Task #1138 — integration coverage for the Strict Facts review flow endpoints
 * and the publish gate.
 *
 * Exercises the REAL route handlers via the in-process `inject()` helper
 * (`app.listen` hangs in the vitest worker pool) against a HERMETIC, throwaway
 * Postgres built straight from the drizzle schema via `drizzle-kit push`. This
 * must NOT run against prod Neon, so we stand up our own ephemeral cluster and
 * repoint the db env BEFORE the first `@workspace/db` import.
 *
 * Asserted:
 *   - POST .../fact-flags/sync detects stats/claims/quotes and persists pending
 *     flags; re-sync is idempotent (no duplicate rows).
 *   - GET .../fact-flags lists the flags with a pending count.
 *   - POST .../approve resolves a single flag (pending → approved_for_page).
 *   - The publish gate (PUT /lp/pages/:id status=published) returns 409 with
 *     code `fact_flags_pending` while flags are pending, and succeeds once the
 *     caller passes `bulkApproveFactFlags: true` (bulk-approve-and-publish).
 *   - Everything is tenant-scoped (fail-closed 403 with no tenant).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-ff-${randomUUID()}`;
const SID_NO_TENANT = `it-ff-none-${randomUUID()}`;

let tenantId: number;

const PAGE_BLOCKS = [
  { id: "hero", type: "hero", props: { headline: "We deliver 2.5x ROI", subhead: "Trusted by Fortune 500 companies nationwide." } },
  { id: "tb", type: "trust-bar", props: { items: [{ value: "47%", label: "faster" }, { value: "98%", label: "fit" }] } },
  { id: "tm", type: "testimonial", props: { quote: "Best decision our practice ever made.", author: "Dr. Lopez", company: "Smile Co." } },
];

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

function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    body: opts.body,
  });
}

async function seedSession(sid: string, tid: number | null, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId, email: `it-${userId}@example.test`, name: "IT", avatarUrl: null,
    tenantId: tid, role: "admin", permissions: {}, isAdmin: true, appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

async function seedTenant(): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT FactFlags ${uniq}`, `it-ff-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedPage(tid: number, status: string): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, blocks)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [tid, `FF Page ${uniq}`, `ff-page-${uniq}`, status, JSON.stringify(PAGE_BLOCKS)],
  );
  return p.rows[0].id;
}

beforeAll(async () => {
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx", ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  pgMod = await import("@workspace/db");
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const factFlagsRouter = (await import("./fact-flags")).default;
  const pagesRouter = (await import("./pages")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(factFlagsRouter);
  app.use(pagesRouter);

  tenantId = await seedTenant();
  await seedSession(SID, tenantId, 990001201);
  await seedSession(SID_NO_TENANT, null, 990001202);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface SyncResponse { flags: { id: number; factKind: string; triageState: string }[]; pendingCount: number; created: number }
interface ListResponse { flags: { id: number; factKind: string; triageState: string }[]; pendingCount: number; total: number }

describe("Strict Facts review flow endpoints (#1138)", () => {
  it("sync detects stat/claim/quote facts and persists pending flags", async () => {
    const pageId = await seedPage(tenantId, "draft");
    const res = await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    expect(res.status).toBe(200);
    const body = res.json as SyncResponse;
    expect(body.created).toBeGreaterThan(0);
    expect(body.pendingCount).toBe(body.created);
    const kinds = new Set(body.flags.map((f) => f.factKind));
    expect(kinds.has("stat")).toBe(true);
    expect(kinds.has("claim")).toBe(true);
    expect(kinds.has("quote")).toBe(true);

    // Re-sync is idempotent — no new rows for the same content.
    const res2 = await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    const body2 = res2.json as SyncResponse;
    expect(body2.created).toBe(0);
    expect(body2.flags.length).toBe(body.flags.length);
  });

  it("GET lists flags with a pending count; approve resolves a single flag", async () => {
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });

    const list = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect(list.status).toBe(200);
    const listBody = list.json as ListResponse;
    expect(listBody.total).toBeGreaterThan(0);
    expect(listBody.pendingCount).toBe(listBody.total);

    const target = listBody.flags[0];
    const approve = await injectAs(SID, { method: "POST", url: `/lp/fact-flags/${target.id}/approve` });
    expect(approve.status).toBe(200);

    const after = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    const afterBody = after.json as ListResponse;
    expect(afterBody.pendingCount).toBe(listBody.pendingCount - 1);
    const resolved = afterBody.flags.find((f) => f.id === target.id);
    expect(resolved?.triageState).toBe("approved_for_page");
  });

  it("publish gate: 409 while flags pending, succeeds with bulkApproveFactFlags", async () => {
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });

    const blocked = await injectAs(SID, {
      method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published" },
    });
    expect(blocked.status).toBe(409);
    expect((blocked.json as { code?: string }).code).toBe("fact_flags_pending");

    const published = await injectAs(SID, {
      method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published", bulkApproveFactFlags: true },
    });
    expect(published.status).toBe(200);

    const after = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect((after.json as ListResponse).pendingCount).toBe(0);
  });

  it("fails closed (403) for a session with no tenant", async () => {
    const pageId = await seedPage(tenantId, "draft");
    const res = await injectAs(SID_NO_TENANT, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect(res.status).toBe(403);
  });
});
