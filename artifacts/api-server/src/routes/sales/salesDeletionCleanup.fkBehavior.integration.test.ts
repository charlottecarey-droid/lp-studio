/**
 * Regression guard for sales/SFDC deletion cleanup (tasks #781, #786, #797 → #817).
 *
 * Over several tasks we added/healed the foreign keys across the sales + SFDC
 * schema so deleting a contact, account, campaign, or hotlink correctly
 * CASCADE-deletes owned children (send records) and SET-NULLs the references in
 * historical/reporting rows (campaigns, opportunities, leads, inbound emails)
 * that must outlive the deleted parent. Nothing pinned that behavior, so a
 * future schema change could silently re-introduce orphan rows or flip an FK
 * back to RESTRICT and break the delete.
 *
 * This test builds the REAL schema straight from the drizzle definitions
 * (lib/db/src/schema — the forward source of truth that GENERATES the
 * migrations and carries the same `onDelete` rules the fix-migrations install on
 * already-drifted prod DBs) via `drizzle-kit push` against a HERMETIC, throwaway
 * Postgres, then for each parent table:
 *   1. asserts every relevant FK's `confdeltype` ('c' = cascade, 'n' = set null)
 *   2. seeds a parent + its children, deletes the parent, and asserts the
 *      children were cascaded away / orphaned (reference NULLed, row survives).
 *
 * It must NOT touch prod Neon: dev's `NEON_DATABASE_URL` points at the
 * production DB and `@workspace/db`'s pool binds it at import time, so we stand
 * up our own ephemeral cluster and repoint the env BEFORE the first
 * `@workspace/db` import. (The full migration set can't be replayed on a blank
 * DB — the earliest migrations ALTER push-created tables the migrations never
 * CREATE — which is exactly why we push the schema rather than run migrations.)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// `@workspace/db`'s pool reads the connection string at import time. Any static
// top-level import of `@workspace/db` would defeat the repointing. Typed via
// `typeof import(...)` so the rest of the file stays type-checked.
type Pg = typeof import("@workspace/db");
let pgMod: Pg;

let epg: EphemeralPg;

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

/**
 * The ON DELETE action of the single-column foreign key on `childTable.column`,
 * read straight from the catalog: 'c' = cascade, 'n' = set null, 'a' = no
 * action, 'r' = restrict. Returns null if no such FK exists (which is itself a
 * regression — a declared FK silently demoted to a plain column).
 */
async function fkDeleteAction(childTable: string, column: string): Promise<string | null> {
  const { pool } = pgMod;
  const res = await pool.query<{ confdeltype: string }>(
    `SELECT con.confdeltype
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_attribute att
         ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND child.relname = $1
        AND att.attname = $2
        AND array_length(con.conkey, 1) = 1`,
    [childTable, column],
  );
  return res.rows[0]?.confdeltype ?? null;
}

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env at it BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  // 2. Build the real schema (including every FK `onDelete`) straight from the
  //    drizzle schema definitions. `drizzle-kit push` is non-interactive with
  //    --force and reads the same NEON_DATABASE_URL we just repointed.
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

  // 3. Now it is safe to load the db layer.
  pgMod = await import("@workspace/db");
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

/** Insert a tenant and return its id. */
async function seedTenant(label: string): Promise<number> {
  const uniq = `${label}-${randomUUID().slice(0, 8)}`;
  const t = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
       VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT Del ${uniq}`, `it-del-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedAccount(tenantId: number, label: string): Promise<number> {
  const a = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status)
       VALUES ($1, $2, 'prospect') RETURNING id`,
    [tenantId, `Acme ${label}-${randomUUID().slice(0, 6)}`],
  );
  return a.rows[0].id;
}

async function seedContact(tenantId: number, accountId: number): Promise<number> {
  const c = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name)
       VALUES ($1, $2, 'Pat', 'Lee') RETURNING id`,
    [tenantId, accountId],
  );
  return c.rows[0].id;
}

async function seedCampaign(tenantId: number, accountId: number | null): Promise<number> {
  const c = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_email_campaigns (tenant_id, name, account_id, status)
       VALUES ($1, $2, $3, 'sent') RETURNING id`,
    [tenantId, `Campaign ${randomUUID().slice(0, 6)}`, accountId],
  );
  return c.rows[0].id;
}

async function seedSend(opts: {
  campaignId: number | null;
  contactId: number;
  hotlinkId: number | null;
}): Promise<number> {
  const s = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_email_sends (campaign_id, contact_id, hotlink_id, email, status)
       VALUES ($1, $2, $3, 'send@example.com', 'sent') RETURNING id`,
    [opts.campaignId, opts.contactId, opts.hotlinkId],
  );
  return s.rows[0].id;
}

async function seedInbound(opts: {
  tenantId: number;
  contactId: number | null;
  accountId: number | null;
}): Promise<number> {
  const i = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_inbound_emails (tenant_id, contact_id, account_id, from_email, to_email)
       VALUES ($1, $2, $3, 'from@example.com', 'to@example.com') RETURNING id`,
    [opts.tenantId, opts.contactId, opts.accountId],
  );
  return i.rows[0].id;
}

async function seedOpportunity(tenantId: number, accountId: number | null): Promise<number> {
  const o = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sfdc_opportunities (tenant_id, salesforce_id, name, account_id, stage_name)
       VALUES ($1, $2, $3, $4, 'Closed Won') RETURNING id`,
    [tenantId, `opp-${randomUUID().slice(0, 8)}`, `Opp ${randomUUID().slice(0, 6)}`, accountId],
  );
  return o.rows[0].id;
}

async function seedLead(opts: {
  tenantId: number;
  convertedAccountId: number | null;
  convertedContactId: number | null;
}): Promise<number> {
  const l = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sfdc_leads (tenant_id, salesforce_id, last_name, status, converted_account_id, converted_contact_id)
       VALUES ($1, $2, 'Lee', 'Converted', $3, $4) RETURNING id`,
    [opts.tenantId, `lead-${randomUUID().slice(0, 8)}`, opts.convertedAccountId, opts.convertedContactId],
  );
  return l.rows[0].id;
}

async function seedPage(tenantId: number): Promise<number> {
  const p = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug)
       VALUES ($1, 'Page', $2) RETURNING id`,
    [tenantId, `page-${randomUUID().slice(0, 8)}`],
  );
  return p.rows[0].id;
}

async function seedHotlink(opts: {
  tenantId: number;
  contactId: number | null;
  pageId: number;
}): Promise<number> {
  const h = await pgMod.pool.query<{ id: number }>(
    `INSERT INTO sales_hotlinks (tenant_id, token, contact_id, page_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
    [opts.tenantId, `tok-${randomUUID().slice(0, 8)}`, opts.contactId, opts.pageId],
  );
  return h.rows[0].id;
}

async function rowExists(table: string, id: number): Promise<boolean> {
  const r = await pgMod.pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  return r.rows.length === 1;
}

async function columnValue<T = unknown>(table: string, column: string, id: number): Promise<T> {
  const r = await pgMod.pool.query<Record<string, T>>(
    `SELECT ${column} AS v FROM ${table} WHERE id = $1`,
    [id],
  );
  return (r.rows[0] as unknown as { v: T }).v;
}

describe("sales/SFDC deletion cleanup — FK ON DELETE behavior (regression for #781/#786/#797)", () => {
  describe("FK ON DELETE actions are declared correctly (confdeltype)", () => {
    it("contact children: sends CASCADE, inbound + converted-lead SET NULL", async () => {
      expect(await fkDeleteAction("sales_email_sends", "contact_id")).toBe("c");
      expect(await fkDeleteAction("sales_inbound_emails", "contact_id")).toBe("n");
      expect(await fkDeleteAction("sfdc_leads", "converted_contact_id")).toBe("n");
    });

    it("account children: campaign/opp/lead/inbound all SET NULL", async () => {
      expect(await fkDeleteAction("sales_email_campaigns", "account_id")).toBe("n");
      expect(await fkDeleteAction("sfdc_opportunities", "account_id")).toBe("n");
      expect(await fkDeleteAction("sfdc_leads", "converted_account_id")).toBe("n");
      expect(await fkDeleteAction("sales_inbound_emails", "account_id")).toBe("n");
    });

    it("hotlink child: send hotlink_id SET NULL", async () => {
      expect(await fkDeleteAction("sales_email_sends", "hotlink_id")).toBe("n");
    });

    it("campaign child: send campaign_id CASCADE", async () => {
      expect(await fkDeleteAction("sales_email_sends", "campaign_id")).toBe("c");
    });
  });

  describe("deleting a sales_contacts row", () => {
    it("CASCADE-deletes its sends and SET-NULLs inbound.contact_id + lead.converted_contact_id", async () => {
      const tenantId = await seedTenant("contact");
      const accountId = await seedAccount(tenantId, "contact");
      const contactId = await seedContact(tenantId, accountId);

      const sendId = await seedSend({ campaignId: null, contactId, hotlinkId: null });
      const inboundId = await seedInbound({ tenantId, contactId, accountId: null });
      const leadId = await seedLead({
        tenantId,
        convertedAccountId: null,
        convertedContactId: contactId,
      });

      await pgMod.pool.query(`DELETE FROM sales_contacts WHERE id = $1`, [contactId]);

      expect(await rowExists("sales_contacts", contactId)).toBe(false);
      // Owned send row is cascaded away.
      expect(await rowExists("sales_email_sends", sendId)).toBe(false);
      // Historical rows survive with the reference NULLed.
      expect(await rowExists("sales_inbound_emails", inboundId)).toBe(true);
      expect(await columnValue("sales_inbound_emails", "contact_id", inboundId)).toBeNull();
      expect(await rowExists("sfdc_leads", leadId)).toBe(true);
      expect(await columnValue("sfdc_leads", "converted_contact_id", leadId)).toBeNull();
    });
  });

  describe("deleting a sales_accounts row", () => {
    it("SET-NULLs campaign/opp/lead/inbound account references (rows survive)", async () => {
      const tenantId = await seedTenant("account");
      const accountId = await seedAccount(tenantId, "account");

      const campaignId = await seedCampaign(tenantId, accountId);
      const oppId = await seedOpportunity(tenantId, accountId);
      const leadId = await seedLead({
        tenantId,
        convertedAccountId: accountId,
        convertedContactId: null,
      });
      const inboundId = await seedInbound({ tenantId, contactId: null, accountId });

      await pgMod.pool.query(`DELETE FROM sales_accounts WHERE id = $1`, [accountId]);

      expect(await rowExists("sales_accounts", accountId)).toBe(false);

      expect(await rowExists("sales_email_campaigns", campaignId)).toBe(true);
      expect(await columnValue("sales_email_campaigns", "account_id", campaignId)).toBeNull();

      expect(await rowExists("sfdc_opportunities", oppId)).toBe(true);
      expect(await columnValue("sfdc_opportunities", "account_id", oppId)).toBeNull();

      expect(await rowExists("sfdc_leads", leadId)).toBe(true);
      expect(await columnValue("sfdc_leads", "converted_account_id", leadId)).toBeNull();

      expect(await rowExists("sales_inbound_emails", inboundId)).toBe(true);
      expect(await columnValue("sales_inbound_emails", "account_id", inboundId)).toBeNull();
    });
  });

  describe("deleting a sales_hotlinks row", () => {
    it("SET-NULLs send.hotlink_id (the send survives)", async () => {
      const tenantId = await seedTenant("hotlink");
      const accountId = await seedAccount(tenantId, "hotlink");
      const contactId = await seedContact(tenantId, accountId);
      const pageId = await seedPage(tenantId);
      const hotlinkId = await seedHotlink({ tenantId, contactId, pageId });

      const sendId = await seedSend({ campaignId: null, contactId, hotlinkId });

      await pgMod.pool.query(`DELETE FROM sales_hotlinks WHERE id = $1`, [hotlinkId]);

      expect(await rowExists("sales_hotlinks", hotlinkId)).toBe(false);
      expect(await rowExists("sales_email_sends", sendId)).toBe(true);
      expect(await columnValue("sales_email_sends", "hotlink_id", sendId)).toBeNull();
    });
  });

  describe("deleting a sales_email_campaigns row", () => {
    it("CASCADE-deletes its sends", async () => {
      const tenantId = await seedTenant("campaign");
      const accountId = await seedAccount(tenantId, "campaign");
      const contactId = await seedContact(tenantId, accountId);
      const campaignId = await seedCampaign(tenantId, accountId);

      const sendId = await seedSend({ campaignId, contactId, hotlinkId: null });

      await pgMod.pool.query(`DELETE FROM sales_email_campaigns WHERE id = $1`, [campaignId]);

      expect(await rowExists("sales_email_campaigns", campaignId)).toBe(false);
      expect(await rowExists("sales_email_sends", sendId)).toBe(false);
    });
  });
});
