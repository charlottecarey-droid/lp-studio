/**
 * Hub Settings › Mutual action plan (Nov 2026): the plan in the hub's detail,
 * PUT /plan, the template / this-plan CSV, and the import preview (replace /
 * add, keys kept, nothing saved). Runs on ephemeral Postgres, or on a test
 * database via LP_IT_DATABASE_URL (marker-guarded).
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

const SID = `it-rp-${randomUUID()}`;
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

const SID_B = `it-rp-b-${randomUUID()}`;
let tenantB: number;
let pageId: number;

function call(method: string, url: string, body?: unknown, sid = SID): Promise<InjectResponse> {
  return inject(app, { method, url, headers: { cookie: `${SESSION_COOKIE}=${sid}` }, ...(body === undefined ? {} : { body }) });
}

async function session(sid: string, tenant: number, userId: number) {
  const sess = JSON.stringify({ userId, email: `it-rp-${userId}@example.test`, name: "IT", avatarUrl: null, tenantId: tenant, role: "admin", permissions: {}, isAdmin: true, appUserRole: null });
  await pgMod.pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

beforeAll(async () => {
  if (!localPg) return;
  if (externalDb) {
    process.env.NEON_DATABASE_URL = externalDb;
    process.env.DATABASE_URL = externalDb;
  } else {
    epg = startEphemeralPg();
    process.env.NEON_DATABASE_URL = epg.connectionString;
    process.env.DATABASE_URL = epg.connectionString;
    const push = spawnSync("npx", ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"], { cwd: resolveLibDbDir(), encoding: "utf8", env: process.env });
    if (push.status !== 0) throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }
  pgMod = await import("@workspace/db");
  if (externalDb) {
    const marker = await pgMod.pool.query(`SELECT to_regclass('public.zz_test_branch_marker') IS NOT NULL AS ok`);
    if (!marker.rows[0]?.ok) throw new Error("LP_IT_DATABASE_URL has no zz_test_branch_marker table: refusing to run against it");
  }
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const roomsRouter = (await import("./rooms")).default;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(roomsRouter);
  const mk = async (label: string) => {
    const uniq = randomUUID().slice(0, 8);
    const t = await pgMod.pool.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, status, plan, settings) VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb) RETURNING id`,
      [`IT RoomPlan ${label} ${uniq}`, `it-rp-${label}-${uniq}`],
    );
    return t.rows[0].id;
  };
  tenantId = await mk("a");
  tenantB = await mk("b");
  await session(SID, tenantId, 990001501);
  await session(SID_B, tenantB, 990001502);
  const blocks = [{ id: "ws", type: "room-workspace", props: { partnerName: "Acme Dental", planGroups: [{ title: "Setup", rows: [{ key: "practice-roster", task: "Upload your practice list", status: "done", customerAction: "upload" }] }] } }];
  const pg = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status) VALUES ($1, 'Acme hub', $2, $3::jsonb, 'draft') RETURNING id`,
    [tenantId, `it-rp-${randomUUID().slice(0, 8)}`, JSON.stringify(blocks)],
  );
  pageId = pg.rows[0].id;
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

describe.skipIf(!localPg)("hub Settings › Mutual action plan routes", () => {
  const csv = (s: string) => Buffer.from(s, "utf8").toString("base64");

  it("the hub's detail carries the plan", async () => {
    const res = await call("GET", `/lp/partner-rooms/${pageId}`);
    expect(res.status).toBe(200);
    expect((res.json as { plan?: unknown }).plan).toEqual({ expansion: false, groups: [{ title: "Setup", rows: [{ key: "practice-roster", task: "Upload your practice list", status: "done", customerAction: "upload" }] }] });
  });

  it("the template and this plan download as CSV", async () => {
    const t = (await call("GET", `/lp/partner-rooms/${pageId}/plan/template`)).json as { fileName: string; csv: string };
    expect(t.fileName).toBe("mutual-action-plan-template.csv");
    expect(t.csv).toContain("Phase,Checkpoint,Step,Target date,Our owner,Customer owner,Status,Customer can,Note");
    const mine = (await call("GET", `/lp/partner-rooms/${pageId}/plan/template?current=1`)).json as { fileName: string; csv: string };
    expect(mine.fileName).toBe("acme-hub-action-plan.csv");
    expect(mine.csv).toContain("Setup,,Upload your practice list,,,,Done,Upload a file,");
  });

  it("an import shows the result without saving; replace keeps a same-named step's key", async () => {
    const res = await call("POST", `/lp/partner-rooms/${pageId}/plan/import`, { fileName: "acme.csv", fileBase64: csv("Phase,Step,Status\nSetup,Upload your practice list,On track\nLaunch,Announce,\n"), mode: "replace" });
    expect(res.status).toBe(200);
    const j = res.json as { groups: { title: string; rows: { key: string; task: string; status: string }[] }[]; steps: number; phases: number };
    expect(j.steps).toBe(2);
    expect(j.groups.map((g) => g.title)).toEqual(["Setup", "Launch"]);
    expect(j.groups[0].rows[0]).toMatchObject({ key: "practice-roster", status: "on-track" });
    // Not saved.
    const still = (await call("GET", `/lp/partner-rooms/${pageId}`)).json as { plan: { groups: { rows: { status: string }[] }[] } };
    expect(still.plan.groups[0].rows[0].status).toBe("done");
  });

  it("add mode joins steps to the plan; a file with no steps or an unknown type is refused", async () => {
    const add = (await call("POST", `/lp/partner-rooms/${pageId}/plan/import`, { fileName: "more.csv", fileBase64: csv("Phase,Step\nSetup,Join the kickoff\n"), mode: "add" })).json as { groups: { rows: { task: string }[] }[] };
    expect(add.groups[0].rows.map((r) => r.task)).toEqual(["Upload your practice list", "Join the kickoff"]);
    const bad = await call("POST", `/lp/partner-rooms/${pageId}/plan/import`, { fileName: "x.csv", fileBase64: csv("Name,Date\na,b\n") });
    expect(bad.status).toBe(400);
    expect((bad.json as { error: string }).error).toMatch(/No Step column/);
    expect((await call("POST", `/lp/partner-rooms/${pageId}/plan/import`, { fileName: "x.pdf", fileBase64: csv("x") })).status).toBe(400);
  });

  it("saves the plan, cleaned, and leaves the rest of the page alone", async () => {
    const res = await call("PUT", `/lp/partner-rooms/${pageId}/plan`, { groups: [{ title: "Launch", rows: [{ task: "Announce", status: "weird", junk: 1 }, { task: " " }] }] });
    expect(res.status).toBe(200);
    expect((res.json as { plan: unknown }).plan).toEqual({ expansion: false, groups: [{ title: "Launch", rows: [{ task: "Announce", status: "not-started" }] }] });
    const r = await pgMod.pool.query<{ blocks: { props: Record<string, unknown> }[] }>(`SELECT blocks FROM lp_pages WHERE id = $1`, [pageId]);
    expect(r.rows[0].blocks[0].props.partnerName).toBe("Acme Dental");
  });

  it("another workspace can't read or change it", async () => {
    expect((await call("PUT", `/lp/partner-rooms/${pageId}/plan`, { groups: [] }, SID_B)).status).toBe(404);
    expect((await call("GET", `/lp/partner-rooms/${pageId}/plan/template`, undefined, SID_B)).status).toBe(404);
  });
});
