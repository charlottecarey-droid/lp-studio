/**
 * Integration test for the hotlink token-collision retry (Prompt 1, Fix 6).
 *
 * ensureHotlinkForContact() previously did a SELECT-then-INSERT to pick a unique
 * token — a TOCTOU race that could throw on the `token` unique constraint under
 * concurrency. The fix attempts the insert directly and, on a 23505 token
 * collision (NOT absorbed by the ON CONFLICT on the (contact, page) index),
 * regenerates a fresh candidate and retries.
 *
 * This test forces a deterministic collision by stubbing `randomBytes` so the
 * first generated token equals an already-stored token: the function must catch
 * the 23505, retry, and return a DIFFERENT token + a real row. It also covers
 * the find-or-create contract (same row for repeated calls; reactivation of a
 * soft-deleted row).
 *
 * Runs against the real Postgres pool; seeds + tears down its own rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

import { dbAvailable } from "../test-utils/dbAvailable";
// Queue of buffers the stubbed randomBytes will return (in order); when empty it
// falls through to the real implementation. Hoisted so the vi.mock factory (which
// is itself hoisted above imports) can close over it safely.
const hoisted = vi.hoisted(() => ({ queued: [] as Buffer[] }));
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    default: actual,
    randomBytes: (size: number) =>
      hoisted.queued.length ? hoisted.queued.shift()! : actual.randomBytes(size),
  };
});

import { randomBytes } from "crypto";
import { pool } from "@workspace/db";
import { ensureHotlinkForContact } from "./ensureHotlink";

const createdTenantIds: number[] = [];

function tokenFor(buf: Buffer): string {
  return buf.toString("base64url").slice(0, 16);
}

async function seedTenant(): Promise<number> {
  const slug = `it-hotlink-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Hotlink Tenant', $1, 'active', 'growth') RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedPage(tenantId: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status)
     VALUES ($1, 'IT Hotlink Page', $2, 'published') RETURNING id`,
    [tenantId, `it-hotlink-page-${Date.now()}-${Math.floor(Math.random() * 1e6)}`],
  );
  return r.rows[0].id;
}

async function seedAccount(tenantId: number): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, 'IT Hotlink Account', 'active') RETURNING id`,
    [tenantId],
  );
  return r.rows[0].id;
}

async function seedContact(tenantId: number, accountId: number, email: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
     VALUES ($1, $2, 'IT', 'Contact', $3, 'active') RETURNING id`,
    [tenantId, accountId, email],
  );
  return r.rows[0].id;
}

beforeAll(() => {
  hoisted.queued = [];
});

afterAll(async () => {
  hoisted.queued = [];
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("ensureHotlinkForContact token-collision retry (Fix 6)", () => {
  it("retries with a fresh token when the first candidate collides (23505)", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const accountId = await seedAccount(tenantId);
    const occupyingContact = await seedContact(tenantId, accountId, `occupy-${Date.now()}@it.example`);
    const targetContact = await seedContact(tenantId, accountId, `target-${Date.now()}@it.example`);

    // Real bytes (queue empty → falls through to the actual implementation).
    const collidingBuf = randomBytes(12);
    const freshBuf = randomBytes(12);
    const collidingToken = tokenFor(collidingBuf);
    const freshToken = tokenFor(freshBuf);
    expect(collidingToken).not.toBe(freshToken);

    // Pre-occupy `collidingToken` on a DIFFERENT (contact, page) so the first
    // insert attempt violates the token unique constraint.
    await pool.query(
      `INSERT INTO sales_hotlinks (tenant_id, token, contact_id, page_id) VALUES ($1, $2, $3, $4)`,
      [tenantId, collidingToken, occupyingContact, pageId],
    );

    // Force the first generated candidate to collide, the second to be fresh.
    hoisted.queued = [collidingBuf, freshBuf];

    const res = await ensureHotlinkForContact(tenantId, targetContact, pageId, null);
    hoisted.queued = [];

    // It must have skipped the colliding token and landed on the fresh one.
    expect(res.token).toBe(freshToken);
    expect(res.token).not.toBe(collidingToken);

    const row = await pool.query<{ contact_id: number; token: string }>(
      `SELECT contact_id, token FROM sales_hotlinks WHERE id = $1`,
      [res.id],
    );
    expect(row.rows[0].contact_id).toBe(targetContact);
    expect(row.rows[0].token).toBe(freshToken);
  });

  it("returns the same row for repeated calls and reactivates a soft-deleted one", async () => {
    const tenantId = await seedTenant();
    const pageId = await seedPage(tenantId);
    const accountId = await seedAccount(tenantId);
    const contactId = await seedContact(tenantId, accountId, `repeat-${Date.now()}@it.example`);

    const first = await ensureHotlinkForContact(tenantId, contactId, pageId, null);
    const second = await ensureHotlinkForContact(tenantId, contactId, pageId, null);
    expect(second.id).toBe(first.id);
    expect(second.token).toBe(first.token);

    // Soft-delete then re-ensure → same row, reactivated.
    await pool.query(`UPDATE sales_hotlinks SET is_active = false WHERE id = $1`, [first.id]);
    const third = await ensureHotlinkForContact(tenantId, contactId, pageId, null);
    expect(third.id).toBe(first.id);
    const row = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM sales_hotlinks WHERE id = $1`,
      [first.id],
    );
    expect(row.rows[0].is_active).toBe(true);
  });
});
