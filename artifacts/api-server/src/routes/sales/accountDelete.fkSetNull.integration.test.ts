/**
 * Regression guard for sales-account deletion (task #781 → #785).
 *
 * Deleting a Sales Console account that has ever had an email campaign, an SFDC
 * opportunity, or a converted SFDC lead used to 500 with a Postgres FK
 * violation: three child FKs into `sales_accounts` defaulted to RESTRICT/NO
 * ACTION instead of ON DELETE SET NULL. Migration
 * `0066_sales_account_fk_set_null.sql` fixed the constraints; this test makes
 * sure a future schema/migration change can't silently reintroduce the
 * violation.
 *
 * It exercises the REAL delete + bulk-delete route handlers (via the in-process
 * `inject()` helper — `app.listen` hangs in the vitest worker pool) against a
 * HERMETIC, throwaway Postgres. The schema is built straight from the drizzle
 * schema definitions via `drizzle-kit push` — that schema (lib/db/src/schema)
 * is the forward source of truth that GENERATES migrations and is what a fresh
 * DB / push applies, so it carries the same `onDelete: "set null"` the
 * `0066_sales_account_fk_set_null.sql` migration installs on already-drifted
 * prod DBs. (The full migration set can't be replayed on a blank DB: the
 * earliest migrations ALTER push-created tables like `lp_sessions` that the
 * migrations never CREATE.) A regression in either place — dropping the
 * `onDelete` from the schema, or a migration that re-RESTRICTs the FK — makes
 * the delete 500 again, which this test catches.
 *
 * This must NOT run against prod Neon: dev's `NEON_DATABASE_URL` points at the
 * production DB, so we stand up our own ephemeral cluster and repoint the env at
 * it BEFORE the first import of `@workspace/db`.
 *
 * Asserted for both DELETE /accounts/:id and DELETE /accounts/bulk:
 *   - the delete succeeds (200, not 500)
 *   - the campaign / opportunity / lead rows still EXIST (historical/reporting
 *     data must outlive the account)
 *   - their account_id / converted_account_id is now NULL
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

// These are imported dynamically in beforeAll AFTER the ephemeral DB env is set,
// because both modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-acct-del-${randomUUID()}`;

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

  // 2. Build the real schema (including the FK `onDelete: "set null"`) straight
  //    from the drizzle schema definitions. `drizzle-kit push` is non-
  //    interactive with --force and reads the same NEON_DATABASE_URL we just
  //    repointed at the ephemeral cluster.
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

  // 3. Now it is safe to load the db layer + the real route handlers.
  pgMod = await import("@workspace/db");
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const accountsRouter = (await import("./accounts")).default;

  // 4. Mount the genuine router with the real auth/cookie/body middleware.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(accountsRouter);
}, 120_000);

afterAll(async () => {
  // Close the pool before tearing the cluster down so no socket dangles.
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

/**
 * Seed a tenant + admin session + an account with one referencing email
 * campaign, sfdc_opportunity, and converted sfdc_lead. Returns the ids needed
 * to assert the post-delete state.
 */
async function seedAccountWithChildren(label: string): Promise<{
  tenantId: number;
  accountId: number;
  campaignId: number;
  oppId: number;
  leadId: number;
}> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT Acct Del ${uniq}`, `it-acct-del-${uniq}`],
  );
  const tenantId = t.rows[0].id;

  // The delete routes only need a session carrying this tenantId (no permission
  // gate). Refresh the same SID to point at this test's tenant.
  const sess = JSON.stringify({
    userId: 990000001,
    email: "it@example.com",
    name: "IT",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, sess],
  );

  const a = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status)
     VALUES ($1, $2, 'prospect') RETURNING id`,
    [tenantId, `Acme ${uniq}`],
  );
  const accountId = a.rows[0].id;

  const c = await pool.query<{ id: number }>(
    `INSERT INTO sales_email_campaigns (tenant_id, name, account_id, status)
     VALUES ($1, $2, $3, 'sent') RETURNING id`,
    [tenantId, `Campaign ${uniq}`, accountId],
  );
  const campaignId = c.rows[0].id;

  const o = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_opportunities (tenant_id, salesforce_id, name, account_id, stage_name)
     VALUES ($1, $2, $3, $4, 'Closed Won') RETURNING id`,
    [tenantId, `opp-${uniq}`, `Opp ${uniq}`, accountId],
  );
  const oppId = o.rows[0].id;

  const l = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_leads (tenant_id, salesforce_id, last_name, status, converted_account_id)
     VALUES ($1, $2, $3, 'Converted', $4) RETURNING id`,
    [tenantId, `lead-${uniq}`, `Lee ${uniq}`, accountId],
  );
  const leadId = l.rows[0].id;

  return { tenantId, accountId, campaignId, oppId, leadId };
}

async function assertChildrenOrphaned(seeded: {
  accountId: number;
  campaignId: number;
  oppId: number;
  leadId: number;
}): Promise<void> {
  const { pool } = pgMod;

  // Account is gone.
  const acct = await pool.query(`SELECT id FROM sales_accounts WHERE id = $1`, [seeded.accountId]);
  expect(acct.rows).toHaveLength(0);

  // Children survive, with their account references NULLed by ON DELETE SET NULL.
  const camp = await pool.query<{ account_id: number | null }>(
    `SELECT account_id FROM sales_email_campaigns WHERE id = $1`,
    [seeded.campaignId],
  );
  expect(camp.rows).toHaveLength(1);
  expect(camp.rows[0].account_id).toBeNull();

  const opp = await pool.query<{ account_id: number | null }>(
    `SELECT account_id FROM sfdc_opportunities WHERE id = $1`,
    [seeded.oppId],
  );
  expect(opp.rows).toHaveLength(1);
  expect(opp.rows[0].account_id).toBeNull();

  const lead = await pool.query<{ converted_account_id: number | null }>(
    `SELECT converted_account_id FROM sfdc_leads WHERE id = $1`,
    [seeded.leadId],
  );
  expect(lead.rows).toHaveLength(1);
  expect(lead.rows[0].converted_account_id).toBeNull();
}

describe("sales account deletion — child FKs ON DELETE SET NULL (regression for #781)", () => {
  it("DELETE /accounts/:id succeeds and orphans (does not delete) campaign/opp/lead", async () => {
    const seeded = await seedAccountWithChildren("single");

    const res = await injectSid({ method: "DELETE", url: `/accounts/${seeded.accountId}` });
    expect(res.status).toBe(200);
    expect((res.json as { ok?: boolean }).ok).toBe(true);

    await assertChildrenOrphaned(seeded);
  });

  it("DELETE /accounts/bulk succeeds and orphans (does not delete) campaign/opp/lead", async () => {
    const seeded = await seedAccountWithChildren("bulk");

    const res = await injectSid({
      method: "DELETE",
      url: `/accounts/bulk`,
      body: { ids: [seeded.accountId] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { deleted?: number }).deleted).toBe(1);

    await assertChildrenOrphaned(seeded);
  });
});
