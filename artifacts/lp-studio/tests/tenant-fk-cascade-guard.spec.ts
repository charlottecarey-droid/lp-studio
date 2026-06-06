// Safety guard for the shared-Neon e2e teardown invariant (task #1052).
//
// The lp-studio Playwright suite runs against the shared prod Neon DB with
// workers: 1. Its royal-tenant teardown (tests/setup/royal-tenant.ts) clears a
// test tenant by DISCOVERING every tenant-scoped table (any table with a
// single-column FK to `tenants`) from the Postgres catalog and deleting its
// rows, then `DELETE FROM tenants`. That discovery covers tenant→tenant FKs
// automatically, but it rests on ONE catalog-level assumption it can't
// self-heal:
//
//   Every FK from a NON-tenant-scoped table into a tenant-scoped table (or into
//   `tenants` itself via a multi-column FK that discovery skips) MUST be
//   ON DELETE CASCADE or SET NULL.
//
// If someone adds a NO ACTION / RESTRICT FK from a non-tenant-scoped child into
// a tenant-scoped table, the teardown can't reach that child, `DELETE FROM
// tenants` raises 23503, and because purgeStaleRoyalTenants deletes ALL
// royal-test tenants in beforeAll, a single leftover orphan poisons EVERY later
// spec's setup — a whole-suite cascade that persists across runs until the DB
// is cleaned by hand.
//
// This spec fails the run the MOMENT such an FK is introduced, naming the
// offending child table + constraint, so the schema change is caught in CI
// instead of as a mysterious suite-wide flake. It is a pure catalog query — no
// browser, no tenant fixture, no writes.

import { test, expect } from "./setup/pw";
import pg from "pg";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for tenant-fk-cascade-guard.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 2 });

interface OffendingFk {
  constraint_name: string;
  child_table: string;
  parent_table: string;
  on_delete: string;
}

// pg_constraint.confdeltype letters → human-readable ON DELETE action.
const DELETE_ACTION: Record<string, string> = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

test.afterAll(async () => {
  await pool.end();
});

test.describe("tenant FK cascade guard", () => {
  test("no NO-ACTION/RESTRICT FK from a non-tenant-scoped table into a tenant-scoped table", async () => {
    // tenant_scoped = every relation that owns a single-column FK to `tenants`
    // (exactly what royal-tenant.ts discovers) PLUS `tenants` itself. The
    // teardown can clear rows of these tables generically.
    //
    // A violation is any FK whose referenced (parent) table is tenant-scoped
    // but whose referencing (child) table is NOT tenant-scoped AND whose
    // ON DELETE action is NO ACTION ('a') or RESTRICT ('r') — i.e. an
    // undiscoverable child that would block the teardown's DELETE.
    const { rows } = await pool.query<OffendingFk>(
      `WITH tenant_scoped AS (
         SELECT con.conrelid AS oid
           FROM pg_constraint con
          WHERE con.contype = 'f'
            AND con.confrelid = 'tenants'::regclass
            AND con.conrelid <> 'tenants'::regclass
            AND array_length(con.conkey, 1) = 1
         UNION
         SELECT 'tenants'::regclass::oid
       )
       SELECT con.conname                       AS constraint_name,
              con.conrelid::regclass::text       AS child_table,
              con.confrelid::regclass::text      AS parent_table,
              con.confdeltype                    AS on_delete
         FROM pg_constraint con
        WHERE con.contype = 'f'
          AND con.confrelid IN (SELECT oid FROM tenant_scoped)
          AND con.conrelid  NOT IN (SELECT oid FROM tenant_scoped)
          AND con.confdeltype IN ('a', 'r')
        ORDER BY child_table, constraint_name`,
    );

    if (rows.length) {
      const detail = rows
        .map(
          (r) =>
            `  • ${r.child_table}.${r.constraint_name} → ${r.parent_table} ` +
            `(ON DELETE ${DELETE_ACTION[r.on_delete] ?? r.on_delete})`,
        )
        .join("\n");
      throw new Error(
        `Found ${rows.length} foreign key(s) from a NON-tenant-scoped table into a ` +
          `tenant-scoped table with ON DELETE NO ACTION/RESTRICT.\n` +
          `The royal-tenant e2e teardown cannot reach these child rows, so ` +
          `DELETE FROM tenants will 23503 and a single leftover test tenant will ` +
          `poison the whole suite.\n` +
          `Give each FK below ON DELETE CASCADE or SET NULL (or make the child ` +
          `table tenant-scoped):\n${detail}`,
      );
    }

    expect(rows).toEqual([]);
  });
});
