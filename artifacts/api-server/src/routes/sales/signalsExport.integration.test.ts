/**
 * Signals CSV export (GET /sales/signals/export.csv, routes/sales/signals.ts).
 *
 * Pins the resolution ladder the export promises:
 *   • contact-joined signals carry SFDC account id, account name, account
 *     owner, first/last/title and the contact's real email (assumed blank);
 *   • a contact with NO email gets an "assumed_email" guessed from the
 *     naming pattern of the account's known emails (never in the email col);
 *   • a signal with no contactId resolves through the tenant-scoped
 *     metadata-email match, case-insensitively, and backfills the account
 *     columns from the matched contact's account;
 *   • visitor_identified rows with metadata-only identity fall back to the
 *     metadata fields — and NEVER match a contact from another tenant;
 *   • the ?type= filter narrows the file.
 *
 * Real Postgres via inject(); no external services touched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../../middleware/requireAuth";

const { pool } = await import("@workspace/db");
const { SESSION_COOKIE, requireAuth } = await import("../../middleware/requireAuth");
const { inject } = await import("../../test-utils/injectRequest");
const salesRouter = (await import("./index")).default;

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999850000 + Math.floor(Math.random() * 100000),
    email: "signals-export-it@example.com",
    name: "IT Signals Export Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-signals-export-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-signals-export-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Signals Export Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

async function seedAccount(tenantId: number, salesforceId: string, name: string, owner: string, domain: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, salesforce_id, name, owner, domain)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [tenantId, salesforceId, name, owner, domain],
  );
  return r.rows[0].id;
}

async function seedContact(
  tenantId: number, accountId: number,
  firstName: string, lastName: string, email: string | null, title: string | null,
): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, title)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [tenantId, accountId, firstName, lastName, email, title],
  );
  return r.rows[0].id;
}

async function seedSignal(
  tenantId: number,
  fields: { accountId?: number | null; contactId?: number | null; type: string; source?: string | null; metadata?: Record<string, unknown> },
): Promise<void> {
  await pool.query(
    `INSERT INTO sales_signals (tenant_id, account_id, contact_id, type, source, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, fields.accountId ?? null, fields.contactId ?? null, fields.type, fields.source ?? null, JSON.stringify(fields.metadata ?? {})],
  );
}

function exportCsv(sid: string, qs = "") {
  return inject(app, {
    method: "GET",
    url: `/sales/signals/export.csv${qs}`,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
  });
}

/** Parse the CSV into header-keyed rows (seed data contains no commas/quotes). */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.trim().split("\r\n").filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("signals CSV export", () => {
  it("resolves people + accounts and guesses assumed emails", async () => {
    const { tenantId, sid } = await seedTenant();
    const other = await seedTenant(); // decoy tenant for the scoping check

    const acme = await seedAccount(tenantId, "001ACME0000000AAA", "Acme Dental", "Riley Rep", "acmedental.com");
    const john = await seedContact(tenantId, acme, "John", "Smith", "jsmith@acmedental.com", "COO");
    void john;
    await seedContact(tenantId, acme, "Sara", "Lee", "slee@acmedental.com", "CFO");
    const jane = await seedContact(tenantId, acme, "Jane", "Doe", null, "CEO");

    // Decoy: another tenant owns the same email the visitor left behind —
    // it must never resolve across the tenant boundary.
    const decoyAcct = await seedAccount(other.tenantId, "001DECOY000000AAA", "Decoy Co", "Nobody", "decoy.example");
    await seedContact(other.tenantId, decoyAcct, "Leaky", "Contact", "vic@mystery.example", "Spy");

    // Contact join, has email.
    await seedSignal(tenantId, { accountId: acme, contactId: john, type: "email_open", source: "campaign-42" });
    // Contact join, NO email → assumed from the account's flast@ majority.
    await seedSignal(tenantId, { accountId: acme, contactId: jane, type: "page_view", source: "/acme-microsite" });
    // No contactId; uppercase metadata email must match tenant-scoped + backfill the account.
    await seedSignal(tenantId, { type: "form_submit", metadata: { email: "SLEE@acmedental.com" } });
    // Metadata-only identity (visitor_identified) with a cross-tenant email decoy.
    await seedSignal(tenantId, {
      type: "visitor_identified", source: "rb2b",
      metadata: { firstName: "Vic", lastName: "Visitor", title: "Office Manager", companyName: "Mystery Co", email: "vic@mystery.example" },
    });

    const res = await exportCsv(sid);
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"])).toContain("text/csv");

    const rows = parseCsv(res.text);
    expect(rows).toHaveLength(4);
    const byType = new Map(rows.map((r) => [r.signal_type, r]));

    const opened = byType.get("email_open")!;
    expect(opened).toMatchObject({
      sfdc_account_id: "001ACME0000000AAA",
      account_name: "Acme Dental",
      account_owner: "Riley Rep",
      first_name: "John",
      last_name: "Smith",
      title: "COO",
      email: "jsmith@acmedental.com",
      assumed_email: "",
      source: "campaign-42",
    });

    const viewed = byType.get("page_view")!;
    expect(viewed).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      title: "CEO",
      email: "",
      assumed_email: "jdoe@acmedental.com", // flast is the account's majority pattern
    });

    const submitted = byType.get("form_submit")!;
    expect(submitted).toMatchObject({
      sfdc_account_id: "001ACME0000000AAA", // backfilled from the matched contact's account
      account_owner: "Riley Rep",
      first_name: "Sara",
      last_name: "Lee",
      email: "slee@acmedental.com",
      assumed_email: "",
    });

    const identified = byType.get("visitor_identified")!;
    expect(identified).toMatchObject({
      sfdc_account_id: "",
      account_name: "Mystery Co",
      first_name: "Vic", // NOT the other tenant's "Leaky"
      last_name: "Visitor",
      title: "Office Manager",
      email: "vic@mystery.example",
    });

    // Type filter narrows the file.
    const filtered = await exportCsv(sid, "?type=email_open");
    const filteredRows = parseCsv(filtered.text);
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].signal_type).toBe("email_open");
  });
});
