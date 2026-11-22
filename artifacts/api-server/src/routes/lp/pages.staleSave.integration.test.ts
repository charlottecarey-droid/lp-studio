/**
 * Stale-save guard (Nov 2026) — PUT /lp/pages/:pageId refuses a save whose
 * baseBlocksVersion no longer matches the saved blocks (409 page_changed),
 * so a builder tab opened before someone else's change can't silently put
 * the old content back. force: true is the explicit "keep mine". Callers
 * that send no baseBlocksVersion are unaffected.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, pgBinariesAvailable, type EphemeralPg } from "../../test-utils/ephemeralPg";

// Hermetic suite — builds its own throwaway cluster from the local Postgres
// binaries, so gate on those (NOT the Neon TCP probe). Probed at module scope
// because the top-level beforeAll runs even when the describe is skipped.
// Or a disposable database already on the current schema (a Neon test branch): set
// LP_IT_DATABASE_URL. It must hold a zz_test_branch_marker table, so a production
// URL can never be used by mistake.
const externalDb = process.env.LP_IT_DATABASE_URL ?? "";
const localPg = !!externalDb || pgBinariesAvailable();

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-pss-${randomUUID()}`;
let tenantId: number;

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

function createPage(body: Record<string, unknown>): Promise<InjectResponse> {
  const uniq = randomUUID().slice(0, 8);
  return inject(app, {
    method: "POST",
    url: "/lp/pages",
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body: {
      title: `Stale Save ${uniq}`,
      slug: `it-pss-${uniq}`,
      blocks: [{ id: "hero", type: "hero", props: { headline: "Hello" } }],
      status: "draft",
      ...body,
    },
  });
}

function put(pageId: number, body: Record<string, unknown>): Promise<InjectResponse> {
  return inject(app, { method: "PUT", url: `/lp/pages/${pageId}`, headers: { cookie: `${SESSION_COOKIE}=${SID}` }, body });
}

function get(pageId: number): Promise<InjectResponse> {
  return inject(app, { method: "GET", url: `/lp/pages/${pageId}`, headers: { cookie: `${SESSION_COOKIE}=${SID}` } });
}

const blocksWith = (headline: string) => [{ id: "hero", type: "hero", props: { headline } }];

beforeAll(async () => {
  if (!localPg) return;
  if (externalDb) {
    process.env.NEON_DATABASE_URL = externalDb;
    process.env.DATABASE_URL = externalDb;
  } else {
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
  }

  pgMod = await import("@workspace/db");
  if (externalDb) {
    // Prove this is the test database before writing anything.
    const marker = await pgMod.pool.query(`SELECT to_regclass('public.zz_test_branch_marker') IS NOT NULL AS ok`);
    if (!marker.rows[0]?.ok) throw new Error("LP_IT_DATABASE_URL has no zz_test_branch_marker table: refusing to run against it");
  }
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const pagesRouter = (await import("./pages")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(pagesRouter);

  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    // plan=growth so the free-plan page cap can't 402 the creates under test.
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT StaleSave ${uniq}`, `it-pss-${uniq}`],
  );
  tenantId = t.rows[0].id;

  const sess = JSON.stringify({
    userId: 990001302, email: "it-pss@example.test", name: "IT", avatarUrl: null,
    tenantId, role: "admin", permissions: {}, isAdmin: true, appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, sess],
  );
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

// Hermetic: needs the LOCAL Postgres binaries (initdb/pg_ctl).
describe.skipIf(!localPg)("PUT /lp/pages stale-save guard", () => {
  it("GET and PUT carry a fingerprint of the saved blocks that changes with them", async () => {
    const created = await createPage({});
    expect(created.status).toBe(201);
    const id = (created.json as { id: number }).id;
    const v1 = (await get(id)).json as { blocksVersion?: string };
    expect(v1.blocksVersion).toMatch(/^[0-9a-f]{32}$/);
    const saved = await put(id, { blocks: blocksWith("Second"), baseBlocksVersion: v1.blocksVersion });
    expect(saved.status).toBe(200);
    const v2 = (saved.json as { blocksVersion?: string }).blocksVersion;
    expect(v2).toMatch(/^[0-9a-f]{32}$/);
    expect(v2).not.toBe(v1.blocksVersion);
    expect(((await get(id)).json as { blocksVersion?: string }).blocksVersion).toBe(v2);
  });

  it("refuses a save from a copy that is out of date, and keeps the newer content", async () => {
    const id = ((await createPage({})).json as { id: number }).id;
    const stale = ((await get(id)).json as { blocksVersion: string }).blocksVersion;
    // Someone else saves first (another tab, a teammate).
    expect((await put(id, { blocks: blocksWith("Theirs"), baseBlocksVersion: stale })).status).toBe(200);
    // The stale tab tries to save its older copy.
    const refused = await put(id, { blocks: blocksWith("Mine (stale)"), baseBlocksVersion: stale });
    expect(refused.status).toBe(409);
    expect(refused.json).toMatchObject({ code: "page_changed" });
    expect((refused.json as { updatedAt?: string }).updatedAt).toBeTruthy();
    const now = (await get(id)).json as { blocks: { props: { headline: string } }[] };
    expect(now.blocks[0].props.headline).toBe("Theirs");
  });

  it("a direct database write counts as a change too", async () => {
    const id = ((await createPage({})).json as { id: number }).id;
    const stale = ((await get(id)).json as { blocksVersion: string }).blocksVersion;
    await pgMod.pool.query(`UPDATE lp_pages SET blocks = $1::jsonb WHERE id = $2`, [JSON.stringify(blocksWith("Fixed by hand")), id]);
    expect((await put(id, { blocks: blocksWith("Mine"), baseBlocksVersion: stale })).status).toBe(409);
  });

  it("force: true is the explicit keep-mine", async () => {
    const id = ((await createPage({})).json as { id: number }).id;
    const stale = ((await get(id)).json as { blocksVersion: string }).blocksVersion;
    await put(id, { blocks: blocksWith("Theirs") });
    const forced = await put(id, { blocks: blocksWith("Mine"), baseBlocksVersion: stale, force: true });
    expect(forced.status).toBe(200);
    expect(((await get(id)).json as { blocks: { props: { headline: string } }[] }).blocks[0].props.headline).toBe("Mine");
  });

  it("saves without a fingerprint, or without blocks, behave as before", async () => {
    const id = ((await createPage({})).json as { id: number }).id;
    const stale = ((await get(id)).json as { blocksVersion: string }).blocksVersion;
    await put(id, { blocks: blocksWith("Theirs") });
    expect((await put(id, { blocks: blocksWith("No fingerprint") })).status).toBe(200);
    // A title-only change never touches blocks, so there is nothing to protect.
    expect((await put(id, { title: "Renamed", baseBlocksVersion: stale })).status).toBe(200);
  });
});
