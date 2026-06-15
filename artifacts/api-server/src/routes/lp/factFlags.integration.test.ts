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
const SID_STRICT_OFF = `it-ff-off-${randomUUID()}`;

let tenantId: number;
let tenantStrictOff: number;

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

async function seedBrandSettings(tid: number, config: Record<string, unknown>): Promise<void> {
  const { pool } = pgMod;
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2::jsonb)`,
    [tid, JSON.stringify(config)],
  );
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

  // A second tenant with Strict Facts explicitly turned OFF in brand settings,
  // used to assert the toggle suppresses the whole review surface.
  tenantStrictOff = await seedTenant();
  await seedBrandSettings(tenantStrictOff, { aiStrictFactsMode: false });
  await seedSession(SID_STRICT_OFF, tenantStrictOff, 990001203);
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

  it("publish gate WARNS (never silently publishes) when the pending-flag check itself fails, and a confirmed bulk-approve still goes through", async () => {
    const { pool } = pgMod;
    const pageId = await seedPage(tenantId, "draft");
    // Force the gate's pending-flag count query to THROW by removing the table
    // it reads — simulating a DB that is missing the Strict Facts schema (the
    // original failure mode). The gate must WARN (409 fact_flags_pending with
    // checkFailed) rather than treat the page as clean and silently publish
    // unapproved stats. Renamed (not dropped) so we can restore it for the
    // remaining tests.
    await pool.query(`ALTER TABLE lp_page_fact_flags RENAME TO lp_page_fact_flags_bak`);
    try {
      const warned = await injectAs(SID, {
        method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published" },
      });
      expect(warned.status).toBe(409);
      const wjson = warned.json as { code?: string; checkFailed?: boolean };
      expect(wjson.code).toBe("fact_flags_pending");
      // The check couldn't be completed — the client is told so explicitly.
      expect(wjson.checkFailed).toBe(true);

      // CRITICAL: the warning path must NOT have published the page.
      const stillDraft = await pool.query<{ status: string }>(
        `SELECT status FROM lp_pages WHERE id = $1`, [pageId],
      );
      expect(stillDraft.rows[0].status).toBe("draft");

      // An explicit confirmation still publishes even though the check failed —
      // the best-effort bulk-approve swallows the missing-table error and never
      // hard-blocks a user who has chosen to proceed.
      const published = await injectAs(SID, {
        method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published", bulkApproveFactFlags: true },
      });
      expect(published.status).toBe(200);
      const afterPub = await pool.query<{ status: string }>(
        `SELECT status FROM lp_pages WHERE id = $1`, [pageId],
      );
      expect(afterPub.rows[0].status).toBe("published");
    } finally {
      await pool.query(`ALTER TABLE lp_page_fact_flags_bak RENAME TO lp_page_fact_flags`);
    }
  });

  it("bulk-approve with a flagIds subset approves only the selected pending flags (tenant/page scoped)", async () => {
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    const list = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    const flags = (list.json as ListResponse).flags;
    expect(flags.length).toBeGreaterThan(1);

    // Approve only the first flag's id via the subset path.
    const target = flags[0];
    const sub = await injectAs(SID, {
      method: "POST",
      url: `/lp/pages/${pageId}/fact-flags/bulk-approve`,
      body: { flagIds: [target.id] },
    });
    expect(sub.status).toBe(200);
    expect((sub.json as { approved: number }).approved).toBe(1);

    const after = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    const afterBody = after.json as ListResponse;
    // Exactly one fewer pending; the rest stay pending.
    expect(afterBody.pendingCount).toBe(flags.length - 1);
    expect(afterBody.flags.find((f) => f.id === target.id)?.triageState).toBe("approved_for_page");
    for (const f of afterBody.flags.filter((x) => x.id !== target.id)) {
      expect(f.triageState).toBe("pending");
    }
  });

  it("bulk-approve with an empty flagIds array is a no-op (does not approve all)", async () => {
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    const before = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    const beforePending = (before.json as ListResponse).pendingCount;
    expect(beforePending).toBeGreaterThan(0);

    const res = await injectAs(SID, {
      method: "POST",
      url: `/lp/pages/${pageId}/fact-flags/bulk-approve`,
      body: { flagIds: [] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { approved: number }).approved).toBe(0);

    const after = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect((after.json as ListResponse).pendingCount).toBe(beforePending);
  });

  it("bulk-approve without flagIds still approves every pending flag", async () => {
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    const res = await injectAs(SID, {
      method: "POST",
      url: `/lp/pages/${pageId}/fact-flags/bulk-approve`,
    });
    expect(res.status).toBe(200);
    const after = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect((after.json as ListResponse).pendingCount).toBe(0);
  });

  it("save-to-library falls back to the captured context label when the body label is blank", async () => {
    const { pool } = pgMod;
    const pageId = await seedPage(tenantId, "draft");
    await injectAs(SID, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    const list = await injectAs(SID, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    // Use a quote flag — its attribution columns are populated, so the library
    // insert exercises the label-fallback path without tripping unrelated
    // NOT NULL attribution constraints.
    const quoteFlag = (list.json as ListResponse).flags.find((f) => f.factKind === "quote")!;
    expect(quoteFlag).toBeTruthy();

    // Stamp a known context label so we can assert the fallback path.
    await pool.query(`UPDATE lp_page_fact_flags SET context_label = $1 WHERE id = $2`, [
      "Captured context",
      quoteFlag.id,
    ]);

    // Send a whitespace-only label — server must treat it as missing.
    const saved = await injectAs(SID, {
      method: "POST",
      url: `/lp/fact-flags/${quoteFlag.id}/save-to-library`,
      body: { label: "   " },
    });
    expect(saved.status).toBe(200);
    const ppId = (saved.json as { proofPointId?: number; id?: number }).proofPointId
      ?? (saved.json as { id?: number }).id;
    expect(ppId).toBeTruthy();

    const pp = await pool.query<{ label: string }>(
      `SELECT label FROM lp_proof_points WHERE id = $1`,
      [ppId],
    );
    expect(pp.rows[0].label).toBe("Captured context");
  });

  it("Strict Facts OFF: sync creates no flags, list reports zero, publish is not gated", async () => {
    const pageId = await seedPage(tenantStrictOff, "draft");

    // Sync must skip detection entirely — no pending rows are created.
    const sync = await injectAs(SID_STRICT_OFF, { method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    expect(sync.status).toBe(200);
    const syncBody = sync.json as SyncResponse;
    expect(syncBody.created).toBe(0);
    expect(syncBody.pendingCount).toBe(0);

    // The banner-driving list reports a clean page.
    const list = await injectAs(SID_STRICT_OFF, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect(list.status).toBe(200);
    const listBody = list.json as ListResponse;
    expect(listBody.total).toBe(0);
    expect(listBody.pendingCount).toBe(0);

    // Publishing is not blocked — no 409 fact_flags_pending.
    const published = await injectAs(SID_STRICT_OFF, {
      method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published" },
    });
    expect(published.status).toBe(200);
  });

  it("Strict Facts OFF: pre-existing pending flags are suppressed from the list + publish gate", async () => {
    const { pool } = pgMod;
    const pageId = await seedPage(tenantStrictOff, "draft");
    // Simulate flags created while strict mode was previously ON, then turned off.
    await pool.query(
      `INSERT INTO lp_page_fact_flags
         (tenant_id, page_id, fact_kind, normalized_form, block_id, block_type, field_path, original_text, triage_state)
       VALUES ($1, $2, 'stat', 'leftover', 'hero', 'hero', 'props.headline', 'We deliver 2.5x ROI', 'pending')`,
      [tenantStrictOff, pageId],
    );

    const list = await injectAs(SID_STRICT_OFF, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect((list.json as ListResponse).pendingCount).toBe(0);

    const published = await injectAs(SID_STRICT_OFF, {
      method: "PUT", url: `/lp/pages/${pageId}`, body: { status: "published" },
    });
    expect(published.status).toBe(200);
  });

  it("fails closed (403) for a session with no tenant", async () => {
    const pageId = await seedPage(tenantId, "draft");
    const res = await injectAs(SID_NO_TENANT, { method: "GET", url: `/lp/pages/${pageId}/fact-flags` });
    expect(res.status).toBe(403);
  });
});
