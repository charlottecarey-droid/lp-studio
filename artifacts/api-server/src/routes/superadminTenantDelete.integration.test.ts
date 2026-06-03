/**
 * Regression guard for the superadmin tenant-delete handler (task #837).
 *
 * `DELETE /api/admin/superadmin/tenants/:id` hand-rolled a Salesforce cleanup
 * query that filtered `sfdc_leads` by a NON-EXISTENT column `account_id` (the
 * real column is `converted_account_id`). On the canonical schema that threw
 * Postgres 42703 ("column does not exist"), so deleting a tenant 500'd the
 * moment that tenant had any synced Salesforce lead. This is the same class of
 * bug fixed for the sales-account delete handlers (#798) — pre-ON-DELETE-
 * constraint code that both duplicated work and was broken.
 *
 * The fix deletes the tenant-scoped sfdc tables directly by `tenant_id` (both
 * `sfdc_leads` and `sfdc_opportunities` carry a `tenant_id` FK that CASCADEs on
 * tenant delete), so no account/contact join — and no phantom column — is
 * involved.
 *
 * Like the sibling sales-deletion test, this exercises the REAL route handler
 * via the in-process `inject()` helper (`app.listen` hangs in the vitest worker
 * pool) against a HERMETIC, throwaway Postgres built straight from the drizzle
 * schema via `drizzle-kit push` — the forward source of truth that a fresh DB /
 * push applies, carrying the same `onDelete` rules.
 *
 * This must NOT run against prod Neon: dev's `NEON_DATABASE_URL` points at the
 * production DB, so we stand up our own ephemeral cluster and repoint the env at
 * it BEFORE the first import of `@workspace/db`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// the modules transitively load `@workspace/db`, whose pool reads the connection
// string at import time. Typed via `typeof import(...)` so the rest of the file
// stays type-checked.
type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-superadmin-del-${randomUUID()}`;

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

function injectSid(opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body: opts.body,
  });
}

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env at it BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  // 2. Build the real schema (including every FK `onDelete` rule) straight from
  //    the drizzle schema definitions via a non-interactive `drizzle-kit push`.
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

  // 3. Now it is safe to load the db layer + the real admin router.
  pgMod = await import("@workspace/db");

  // Some legacy tables the tenant-delete chain touches predate the drizzle
  // schema and only exist via raw SQL migrations, so `drizzle-kit push` (which
  // reads lib/db/src/schema) never creates them on a blank DB. Prod has them.
  // The delete only filters each by `tenant_id`, so a minimal stub carrying that
  // column is enough to let the full chain run end-to-end.
  const legacyTables = [
    "lp_personalized_links",
    "lp_block_defaults",
    "lp_brand_presets",
    "lp_custom_blocks",
    "lp_integrations",
    "lp_library_items",
    "sales_audiences",
  ];
  for (const tbl of legacyTables) {
    await pgMod.pool.query(
      `CREATE TABLE IF NOT EXISTS ${tbl} (id serial PRIMARY KEY, tenant_id integer)`,
    );
  }
  const requireAuth = await import("../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const adminRouter = (await import("./admin")).default;

  // 4. Mount the genuine router with the real cookie/body middleware. The
  //    superadmin delete route reads the session inline via requireSuperadmin,
  //    so no requireAuth pre-middleware is needed.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(adminRouter);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface SeededTenant {
  tenantId: number;
  accountId: number;
  contactId: number;
  leadId: number;
  oppId: number;
  campaignId: number;
}

/**
 * Seed a tenant with a sales account + contact, a converted SFDC lead, an SFDC
 * opportunity, and a sales email campaign — i.e. exactly the rows the broken
 * cleanup query touched. Returns the ids needed to assert the post-delete state.
 */
async function seedTenant(label: string): Promise<SeededTenant> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT SA Del ${uniq}`, `it-sa-del-${uniq}`],
  );
  const tenantId = t.rows[0].id;

  const a = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status)
     VALUES ($1, $2, 'prospect') RETURNING id`,
    [tenantId, `Acme ${uniq}`],
  );
  const accountId = a.rows[0].id;

  const c = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, 'Casey', $3, $4, 'active') RETURNING id`,
    [tenantId, accountId, `Lee-${uniq}`, `casey-${uniq}@example.com`],
  );
  const contactId = c.rows[0].id;

  // Converted SFDC lead — references converted_account_id / converted_contact_id
  // (NOT account_id, the column the old cleanup query wrongly named).
  const l = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_leads (tenant_id, salesforce_id, last_name, status, converted_account_id, converted_contact_id)
     VALUES ($1, $2, $3, 'Converted', $4, $5) RETURNING id`,
    [tenantId, `lead-${uniq}`, `Lee ${uniq}`, accountId, contactId],
  );
  const leadId = l.rows[0].id;

  const o = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_opportunities (tenant_id, salesforce_id, name, account_id, stage_name)
     VALUES ($1, $2, $3, $4, 'Closed Won') RETURNING id`,
    [tenantId, `opp-${uniq}`, `Opp ${uniq}`, accountId],
  );
  const oppId = o.rows[0].id;

  const camp = await pool.query<{ id: number }>(
    `INSERT INTO sales_email_campaigns (tenant_id, name, account_id, status)
     VALUES ($1, $2, $3, 'sent') RETURNING id`,
    [tenantId, `Campaign ${uniq}`, accountId],
  );
  const campaignId = camp.rows[0].id;

  return { tenantId, accountId, contactId, leadId, oppId, campaignId };
}

/** Seed (or refresh) the shared SID as a platform superadmin session. */
async function seedSuperadminSession(): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId: 990000999,
    email: "operator@lpstudio.ai",
    name: "Operator",
    avatarUrl: null,
    tenantId: null,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: "superadmin",
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, sess],
  );
}

async function countByTenant(table: string, tenantId: number): Promise<number> {
  const r = await pgMod.pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE tenant_id = $1`,
    [tenantId],
  );
  return Number(r.rows[0].n);
}

async function tenantExists(tenantId: number): Promise<boolean> {
  const r = await pgMod.pool.query(`SELECT 1 FROM tenants WHERE id = $1`, [tenantId]);
  return r.rows.length > 0;
}

describe("superadmin tenant deletion — Salesforce cleanup (regression for #837)", () => {
  it("DELETE /superadmin/tenants/:id succeeds for a tenant with synced SFDC leads + opps + campaigns", async () => {
    await seedSuperadminSession();
    const g = await seedTenant("with-sfdc");

    const res = await injectSid({
      method: "DELETE",
      url: `/superadmin/tenants/${g.tenantId}`,
    });

    expect(res.status).toBe(200);
    expect((res.json as { deleted?: boolean }).deleted).toBe(true);

    // The tenant and every tenant-scoped sales/SFDC child row are gone.
    expect(await tenantExists(g.tenantId)).toBe(false);
    expect(await countByTenant("sfdc_leads", g.tenantId)).toBe(0);
    expect(await countByTenant("sfdc_opportunities", g.tenantId)).toBe(0);
    expect(await countByTenant("sales_email_campaigns", g.tenantId)).toBe(0);
    expect(await countByTenant("sales_accounts", g.tenantId)).toBe(0);
    expect(await countByTenant("sales_contacts", g.tenantId)).toBe(0);
  });

  it("leaves a sibling tenant's rows untouched", async () => {
    await seedSuperadminSession();
    const victim = await seedTenant("victim");
    const survivor = await seedTenant("survivor");

    const res = await injectSid({
      method: "DELETE",
      url: `/superadmin/tenants/${victim.tenantId}`,
    });
    expect(res.status).toBe(200);

    // The victim is gone; the survivor keeps all of its rows.
    expect(await tenantExists(victim.tenantId)).toBe(false);
    expect(await tenantExists(survivor.tenantId)).toBe(true);
    expect(await countByTenant("sfdc_leads", survivor.tenantId)).toBe(1);
    expect(await countByTenant("sfdc_opportunities", survivor.tenantId)).toBe(1);
    expect(await countByTenant("sales_email_campaigns", survivor.tenantId)).toBe(1);
    expect(await countByTenant("sales_accounts", survivor.tenantId)).toBe(1);
    expect(await countByTenant("sales_contacts", survivor.tenantId)).toBe(1);
  });
});
