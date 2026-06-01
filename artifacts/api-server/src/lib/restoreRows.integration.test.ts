/**
 * Undo-delete restore logic.
 *
 * `restoreRows` powers the "Undo" toast on the Accounts / Contacts / Signals /
 * Reviews delete controls: the delete endpoints return the full deleted rows,
 * and Undo POSTs them back here to be re-inserted with their original primary
 * keys. This exercises the real Postgres pool against a throwaway seeded tenant.
 *
 * Guards:
 *   - rows come back with their original id + timestamps (so FK children and
 *     "created at" event times survive a round-trip)
 *   - the tenantId override is forced onto every row (a tampered payload can
 *     never land a row in another tenant)
 *   - onConflictDoNothing makes restore idempotent (re-running is a no-op)
 *   - account → contacts → signals restore order keeps cascade FKs satisfiable
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, db, salesAccountsTable, salesContactsTable, salesSignalsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { restoreRows } from "./restoreRows";

const SLUG = `it-restore-${Date.now()}`;
let tenantId: number;
let otherTenantId: number;

async function cleanup(): Promise<void> {
  for (const id of [tenantId, otherTenantId]) {
    if (!id) continue;
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
}

beforeAll(async () => {
  const a = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Restore', $1, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [SLUG],
  );
  tenantId = a.rows[0].id;
  const b = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT Restore Other', $1, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`${SLUG}-other`],
  );
  otherTenantId = b.rows[0].id;
});

afterAll(async () => {
  await cleanup();
});

describe("restoreRows — undo delete", () => {
  it("restores an account with its contacts and signals, preserving ids and timestamps", async () => {
    // Seed an account + child contact + child signal.
    const [acct] = await db.insert(salesAccountsTable).values({
      tenantId, name: "Acme Dental", status: "prospect",
    }).returning();
    const [contact] = await db.insert(salesContactsTable).values({
      tenantId, accountId: acct.id, firstName: "Pat", lastName: "Lee",
    }).returning();
    const signalCreatedAt = new Date("2025-01-02T03:04:05.000Z");
    const [signal] = await db.insert(salesSignalsTable).values({
      tenantId, accountId: acct.id, type: "page_view", createdAt: signalCreatedAt,
    }).returning();

    // Snapshot (what the delete endpoint returns), then delete (cascade clears children).
    const snapshot = { accounts: [acct], contacts: [contact], signals: [signal] };
    await db.delete(salesAccountsTable).where(eq(salesAccountsTable.id, acct.id));
    const gone = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, acct.id));
    expect(gone).toHaveLength(0);

    // Restore in dependency order.
    expect(await restoreRows(salesAccountsTable, snapshot.accounts, { tenantId })).toBe(1);
    expect(await restoreRows(salesContactsTable, snapshot.contacts, { tenantId })).toBe(1);
    expect(await restoreRows(salesSignalsTable, snapshot.signals, { tenantId })).toBe(1);

    const [restoredAcct] = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, acct.id));
    expect(restoredAcct?.name).toBe("Acme Dental");
    const [restoredContact] = await db.select().from(salesContactsTable).where(eq(salesContactsTable.id, contact.id));
    expect(restoredContact?.accountId).toBe(acct.id);
    const [restoredSignal] = await db.select().from(salesSignalsTable).where(eq(salesSignalsTable.id, signal.id));
    // The original event time must survive the JSON round-trip, not reset to now().
    expect(restoredSignal?.createdAt?.toISOString()).toBe(signalCreatedAt.toISOString());
  });

  it("forces the tenantId override even when the payload claims another tenant", async () => {
    const [acct] = await db.insert(salesAccountsTable).values({
      tenantId, name: "Tamper Co", status: "prospect",
    }).returning();
    await db.delete(salesAccountsTable).where(eq(salesAccountsTable.id, acct.id));

    // A tampered payload tries to plant the row in another tenant.
    const tampered = { ...acct, tenantId: otherTenantId };
    expect(await restoreRows(salesAccountsTable, [tampered], { tenantId })).toBe(1);

    const [restored] = await db.select().from(salesAccountsTable).where(eq(salesAccountsTable.id, acct.id));
    expect(restored?.tenantId).toBe(tenantId);

    const leaked = await db.select().from(salesAccountsTable)
      .where(and(eq(salesAccountsTable.id, acct.id), eq(salesAccountsTable.tenantId, otherTenantId)));
    expect(leaked).toHaveLength(0);
  });

  it("is idempotent — restoring an already-present row inserts nothing", async () => {
    const [acct] = await db.insert(salesAccountsTable).values({
      tenantId, name: "Idem Co", status: "prospect",
    }).returning();
    // Row still exists → conflict on PK → skipped.
    expect(await restoreRows(salesAccountsTable, [acct], { tenantId })).toBe(0);
  });

  it("treats empty/missing input as a no-op", async () => {
    expect(await restoreRows(salesAccountsTable, undefined, { tenantId })).toBe(0);
    expect(await restoreRows(salesAccountsTable, [], { tenantId })).toBe(0);
  });
});
