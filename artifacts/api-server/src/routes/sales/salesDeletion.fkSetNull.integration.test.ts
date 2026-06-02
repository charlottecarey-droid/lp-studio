/**
 * Regression guard for sales-account AND sales-contact deletion (tasks #781,
 * #786 → #796).
 *
 * Deleting a Sales Console account or contact used to 500 with a Postgres FK
 * violation when the record had related history — an email campaign, an SFDC
 * opportunity, a converted SFDC lead, etc. The child FKs into `sales_accounts`
 * / `sales_contacts` defaulted to RESTRICT/NO ACTION instead of the intended
 * mix of CASCADE (owned children) and SET NULL (historical/reporting rows).
 * Migrations `0066_sales_account_fk_set_null.sql` and
 * `0067_sfdc_leads_converted_contact_fk_set_null.sql` fixed the constraints (and
 * boot-time self-heals in `migrate.ts` repair already-drifted prod DBs); this
 * test proves a delete actually succeeds end-to-end so a future schema/migration
 * change can't silently reintroduce the violation.
 *
 * It exercises the REAL delete + bulk-delete route handlers (via the in-process
 * `inject()` helper — `app.listen` hangs in the vitest worker pool) against a
 * HERMETIC, throwaway Postgres. The schema is built straight from the drizzle
 * schema definitions via `drizzle-kit push` — that schema (lib/db/src/schema) is
 * the forward source of truth that GENERATES migrations and is what a fresh DB /
 * push applies, so it carries the same `onDelete` rules the fix-migrations
 * install on already-drifted prod DBs. (The full migration set can't be replayed
 * on a blank DB: the earliest migrations ALTER push-created tables like
 * `lp_sessions` that the migrations never CREATE.) A regression in either place —
 * dropping an `onDelete` from the schema, or a migration that re-RESTRICTs a FK —
 * makes the delete 500 again, which this test catches.
 *
 * This must NOT run against prod Neon: dev's `NEON_DATABASE_URL` points at the
 * production DB, so we stand up our own ephemeral cluster and repoint the env at
 * it BEFORE the first import of `@workspace/db`.
 *
 * Coverage — every FK child of an account / contact is seeded, then we assert:
 *   ACCOUNT delete (DELETE /accounts/:id and /accounts/bulk):
 *     - owned children CASCADE away:   sales_contacts, sales_signals,
 *       sales_briefings, sales_contact_briefings (via the contact), and
 *       sales_email_sends (via the contact)
 *     - historical rows SURVIVE with their account FK NULLed:
 *       sales_email_campaigns.account_id, sfdc_opportunities.account_id,
 *       sfdc_leads.converted_account_id, sales_inbound_emails.account_id
 *     - the hotlink survives with contact_id NULLed (its contact cascaded), and
 *       the lead's converted_contact_id is also NULLed
 *   CONTACT delete (DELETE /contacts/:id and /contacts/bulk):
 *     - owned children CASCADE away: sales_contact_briefings, sales_email_sends
 *     - historical rows SURVIVE with their contact FK NULLed:
 *       sales_hotlinks.contact_id, sfdc_leads.converted_contact_id,
 *       sales_inbound_emails.contact_id
 *     - the parent account (and its account-scoped children) is untouched
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
// because the modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest of
// the file stays type-checked.
type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-sales-del-${randomUUID()}`;

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
  //    the drizzle schema definitions. `drizzle-kit push` is non-interactive with
  //    --force and reads the NEON_DATABASE_URL we just repointed at the ephemeral
  //    cluster.
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
  const contactsRouter = (await import("./contacts")).default;

  // 4. Mount the genuine routers with the real auth/cookie/body middleware.
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(accountsRouter);
  app.use(contactsRouter);
}, 120_000);

afterAll(async () => {
  // Close the pool before tearing the cluster down so no socket dangles.
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface SeededGraph {
  tenantId: number;
  accountId: number;
  contactId: number;
  pageId: number;
  signalId: number;
  briefingId: number;
  contactBriefingId: number;
  campaignId: number;
  hotlinkId: number;
  sendId: number;
  inboundId: number;
  oppId: number;
  leadId: number;
}

/**
 * Seed a tenant + admin session + a full graph: an account and a contact under
 * it, each wired to EVERY kind of child row that references them (owned children
 * that must cascade, and historical/reporting rows that must survive with their
 * FK nulled). Returns the ids needed to assert the post-delete state.
 */
async function seedFullGraph(label: string): Promise<SeededGraph> {
  const { pool } = pgMod;
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT Sales Del ${uniq}`, `it-sales-del-${uniq}`],
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

  // Owned child: contact (CASCADE on account delete).
  const c = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, 'Casey', $3, $4, 'active') RETURNING id`,
    [tenantId, accountId, `Lee-${uniq}`, `casey-${uniq}@example.com`],
  );
  const contactId = c.rows[0].id;

  // lp_page required by a hotlink (page CASCADE is out of scope here; we never
  // delete the page).
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, $2, $3, 'draft') RETURNING id`,
    [tenantId, `Page ${uniq}`, `page-${uniq}`],
  );
  const pageId = p.rows[0].id;

  // Owned child: signal (account_id CASCADE; contact_id is a plain column, no FK).
  const s = await pool.query<{ id: number }>(
    `INSERT INTO sales_signals (tenant_id, account_id, contact_id, type)
     VALUES ($1, $2, $3, 'page_view') RETURNING id`,
    [tenantId, accountId, contactId],
  );
  const signalId = s.rows[0].id;

  // Owned child: account briefing (CASCADE on account delete).
  const b = await pool.query<{ id: number }>(
    `INSERT INTO sales_briefings (tenant_id, account_id, status)
     VALUES ($1, $2, 'complete') RETURNING id`,
    [tenantId, accountId],
  );
  const briefingId = b.rows[0].id;

  // Owned child: contact briefing (CASCADE on contact delete — and on account
  // delete via the cascaded contact).
  const cb = await pool.query<{ id: number }>(
    `INSERT INTO sales_contact_briefings (tenant_id, contact_id, brief_text, status)
     VALUES ($1, $2, 'hello', 'complete') RETURNING id`,
    [tenantId, contactId],
  );
  const contactBriefingId = cb.rows[0].id;

  // Historical: email campaign (account_id SET NULL).
  const camp = await pool.query<{ id: number }>(
    `INSERT INTO sales_email_campaigns (tenant_id, name, account_id, status)
     VALUES ($1, $2, $3, 'sent') RETURNING id`,
    [tenantId, `Campaign ${uniq}`, accountId],
  );
  const campaignId = camp.rows[0].id;

  // Historical: hotlink (contact_id SET NULL on contact delete).
  const h = await pool.query<{ id: number }>(
    `INSERT INTO sales_hotlinks (tenant_id, token, contact_id, page_id, is_active)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [tenantId, `tok-${uniq}`, contactId, pageId],
  );
  const hotlinkId = h.rows[0].id;

  // Owned child: email send (contact_id CASCADE; hotlink_id SET NULL).
  const send = await pool.query<{ id: number }>(
    `INSERT INTO sales_email_sends (campaign_id, contact_id, hotlink_id, email, status)
     VALUES ($1, $2, $3, $4, 'sent') RETURNING id`,
    [campaignId, contactId, hotlinkId, `casey-${uniq}@example.com`],
  );
  const sendId = send.rows[0].id;

  // Historical: inbound email (contact_id + account_id SET NULL).
  const inb = await pool.query<{ id: number }>(
    `INSERT INTO sales_inbound_emails (tenant_id, contact_id, account_id, from_email, to_email)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, contactId, accountId, `casey-${uniq}@example.com`, `sales-${uniq}@lpstudio.ai`],
  );
  const inboundId = inb.rows[0].id;

  // Historical: SFDC opportunity (account_id SET NULL).
  const o = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_opportunities (tenant_id, salesforce_id, name, account_id, stage_name)
     VALUES ($1, $2, $3, $4, 'Closed Won') RETURNING id`,
    [tenantId, `opp-${uniq}`, `Opp ${uniq}`, accountId],
  );
  const oppId = o.rows[0].id;

  // Historical: converted SFDC lead (converted_account_id + converted_contact_id
  // both SET NULL).
  const l = await pool.query<{ id: number }>(
    `INSERT INTO sfdc_leads (tenant_id, salesforce_id, last_name, status, converted_account_id, converted_contact_id)
     VALUES ($1, $2, $3, 'Converted', $4, $5) RETURNING id`,
    [tenantId, `lead-${uniq}`, `Lee ${uniq}`, accountId, contactId],
  );
  const leadId = l.rows[0].id;

  return {
    tenantId, accountId, contactId, pageId, signalId, briefingId,
    contactBriefingId, campaignId, hotlinkId, sendId, inboundId, oppId, leadId,
  };
}

async function exists(table: string, id: number): Promise<boolean> {
  const r = await pgMod.pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return r.rows.length > 0;
}

async function colValue<T = unknown>(table: string, col: string, id: number): Promise<T> {
  const r = await pgMod.pool.query<Record<string, T>>(
    `SELECT ${col} AS v FROM ${table} WHERE id = $1`,
    [id],
  );
  expect(r.rows).toHaveLength(1);
  return (r.rows[0] as { v: T }).v;
}

/** Post-state after the ACCOUNT was deleted. */
async function assertAccountDeleted(g: SeededGraph): Promise<void> {
  // Account itself is gone.
  expect(await exists("sales_accounts", g.accountId)).toBe(false);

  // Owned children cascaded away.
  expect(await exists("sales_contacts", g.contactId)).toBe(false);
  expect(await exists("sales_signals", g.signalId)).toBe(false);
  expect(await exists("sales_briefings", g.briefingId)).toBe(false);
  expect(await exists("sales_contact_briefings", g.contactBriefingId)).toBe(false);
  // Send cascaded via its (now-deleted) contact.
  expect(await exists("sales_email_sends", g.sendId)).toBe(false);

  // Historical/reporting rows survive with their account FK NULLed.
  expect(await exists("sales_email_campaigns", g.campaignId)).toBe(true);
  expect(await colValue("sales_email_campaigns", "account_id", g.campaignId)).toBeNull();

  expect(await exists("sfdc_opportunities", g.oppId)).toBe(true);
  expect(await colValue("sfdc_opportunities", "account_id", g.oppId)).toBeNull();

  expect(await exists("sales_inbound_emails", g.inboundId)).toBe(true);
  expect(await colValue("sales_inbound_emails", "account_id", g.inboundId)).toBeNull();

  expect(await exists("sfdc_leads", g.leadId)).toBe(true);
  expect(await colValue("sfdc_leads", "converted_account_id", g.leadId)).toBeNull();
  // The contact cascaded too, so its converted_contact_id is also NULLed.
  expect(await colValue("sfdc_leads", "converted_contact_id", g.leadId)).toBeNull();

  // Hotlink survives (its page is intact) with contact_id NULLed.
  expect(await exists("sales_hotlinks", g.hotlinkId)).toBe(true);
  expect(await colValue("sales_hotlinks", "contact_id", g.hotlinkId)).toBeNull();
}

/** Post-state after the CONTACT was deleted (account untouched). */
async function assertContactDeleted(g: SeededGraph): Promise<void> {
  // Contact itself is gone; the parent account is untouched.
  expect(await exists("sales_contacts", g.contactId)).toBe(false);
  expect(await exists("sales_accounts", g.accountId)).toBe(true);

  // Owned children of the contact cascaded away.
  expect(await exists("sales_contact_briefings", g.contactBriefingId)).toBe(false);
  expect(await exists("sales_email_sends", g.sendId)).toBe(false);

  // Historical rows survive with their contact FK NULLed.
  expect(await exists("sales_hotlinks", g.hotlinkId)).toBe(true);
  expect(await colValue("sales_hotlinks", "contact_id", g.hotlinkId)).toBeNull();

  expect(await exists("sfdc_leads", g.leadId)).toBe(true);
  expect(await colValue("sfdc_leads", "converted_contact_id", g.leadId)).toBeNull();
  // The account survived, so converted_account_id is still set.
  expect(await colValue("sfdc_leads", "converted_account_id", g.leadId)).toBe(g.accountId);

  expect(await exists("sales_inbound_emails", g.inboundId)).toBe(true);
  expect(await colValue("sales_inbound_emails", "contact_id", g.inboundId)).toBeNull();
  expect(await colValue("sales_inbound_emails", "account_id", g.inboundId)).toBe(g.accountId);

  // Account-scoped children are untouched.
  expect(await exists("sales_signals", g.signalId)).toBe(true);
  expect(await exists("sales_briefings", g.briefingId)).toBe(true);
  expect(await exists("sales_email_campaigns", g.campaignId)).toBe(true);
  expect(await colValue("sales_email_campaigns", "account_id", g.campaignId)).toBe(g.accountId);
}

describe("sales account deletion — child FKs (regression for #781/#796)", () => {
  it("DELETE /accounts/:id succeeds; owned children cascade, historical rows survive nulled", async () => {
    const g = await seedFullGraph("acct-single");

    const res = await injectSid({ method: "DELETE", url: `/accounts/${g.accountId}` });
    expect(res.status).toBe(200);
    expect((res.json as { ok?: boolean }).ok).toBe(true);

    await assertAccountDeleted(g);
  });

  it("DELETE /accounts/bulk succeeds; owned children cascade, historical rows survive nulled", async () => {
    const g = await seedFullGraph("acct-bulk");

    const res = await injectSid({
      method: "DELETE",
      url: `/accounts/bulk`,
      body: { ids: [g.accountId] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { deleted?: number }).deleted).toBe(1);

    await assertAccountDeleted(g);
  });

  // The legacy clear-all path (DELETE /accounts, no id) used to hand-roll an
  // in-code UPDATE pass that referenced sfdc_leads.account_id — a column that
  // doesn't exist — so it 500'd the moment a converted lead was present. It now
  // just deletes the accounts and relies on the same ON DELETE constraints, so it
  // must reach the SAME end state as the two constraint-driven paths above
  // (task #798).
  it("DELETE /accounts (clear-all) succeeds; reaches the same end state as the id/bulk paths", async () => {
    const g = await seedFullGraph("acct-clear-all");

    const res = await injectSid({ method: "DELETE", url: `/accounts` });
    expect(res.status).toBe(200);
    expect((res.json as { ok?: boolean }).ok).toBe(true);

    await assertAccountDeleted(g);
  });
});

describe("sales contact deletion — child FKs (regression for #786/#796)", () => {
  it("DELETE /contacts/:id succeeds; owned children cascade, historical rows survive nulled", async () => {
    const g = await seedFullGraph("contact-single");

    const res = await injectSid({ method: "DELETE", url: `/contacts/${g.contactId}` });
    expect(res.status).toBe(200);
    expect((res.json as { ok?: boolean }).ok).toBe(true);

    await assertContactDeleted(g);
  });

  it("DELETE /contacts/bulk succeeds; owned children cascade, historical rows survive nulled", async () => {
    const g = await seedFullGraph("contact-bulk");

    const res = await injectSid({
      method: "DELETE",
      url: `/contacts/bulk`,
      body: { ids: [g.contactId] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { deleted?: number }).deleted).toBe(1);

    await assertContactDeleted(g);
  });
});
