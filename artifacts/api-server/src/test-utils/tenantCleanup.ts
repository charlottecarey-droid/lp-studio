/**
 * Shared teardown helpers for api-server INTEGRATION tests that seed real
 * tenants into the (shared, production-backed) Postgres database.
 *
 * THE INVARIANT (read before seeding a tenant in a test):
 * Every table holding a foreign key to `tenants` must have its rows cleared
 * before `DELETE FROM tenants` runs, or the delete raises a 23503 and the
 * leftover tenant lingers in the shared DB forever (clogging the workspace).
 *
 * Rather than hand-maintain a per-test list of child tables — which silently
 * rots whenever a new tenant-scoped table is added and a swallowed FK error
 * orphans the tenant — these helpers DISCOVER the full set of
 * tenant-referencing tables from the Postgres catalog at runtime, so a newly
 * added table is covered automatically with zero edits here. This mirrors the
 * Playwright `royal-tenant.ts` teardown that already proved this pattern out.
 *
 * SAFETY: because the dev/test DB is the SHARED production Neon instance, the
 * stale-purge helper deliberately requires MULTIPLE predicates (slug prefix +
 * exact seeded name) AND a minimum-age guard, so it can neither destroy a real
 * tenant that merely shares a slug prefix nor race-delete a concurrent run's
 * freshly-seeded fixture.
 */
import type { Pool, PoolClient } from "pg";

/** Escape LIKE wildcards so a prefix is matched literally (default `\` escape). */
function likePrefix(prefix: string): string {
  return `${prefix.replace(/[%_\\]/g, "\\$&")}%`;
}

let cachedTenantTables: { table: string; column: string }[] | null = null;

/**
 * All tables with a single-column FK referencing `tenants` (excluding tenants
 * itself). `conkey[1]` is the local FK column; `confrelid` the referenced
 * relation; `conrelid::regclass::text` a ready-to-use identifier.
 */
async function discoverTenantReferencingTables(
  client: PoolClient,
): Promise<{ table: string; column: string }[]> {
  if (cachedTenantTables) return cachedTenantTables;
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `SELECT con.conrelid::regclass::text AS table_name, att.attname AS column_name
       FROM pg_constraint con
       JOIN pg_attribute att
         ON att.attrelid = con.conrelid
        AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f'
        AND con.confrelid = 'tenants'::regclass
        AND con.conrelid <> 'tenants'::regclass
        AND array_length(con.conkey, 1) = 1
      ORDER BY table_name`,
  );
  cachedTenantTables = rows.map((r) => ({ table: r.table_name, column: r.column_name }));
  return cachedTenantTables;
}

/**
 * Clear every row referencing `tenantId` from every tenant-FK table. Must run
 * inside a transaction (uses SAVEPOINTs). Retries tables blocked by an
 * intra-set NO ACTION FK (e.g. sales_email_campaigns.template_id ->
 * sales_email_templates) until their blocker is gone; CASCADE / SET NULL
 * children disappear when their parent row does. Throws (rather than silently
 * orphaning the tenant) if a non-tenant-scoped NO ACTION FK can't be resolved.
 */
async function deleteTenantReferencingRows(
  client: PoolClient,
  tenantId: number,
): Promise<void> {
  const tables = await discoverTenantReferencingTables(client);
  let remaining = [...tables];
  while (remaining.length) {
    const blocked: typeof remaining = [];
    let madeProgress = false;
    for (const t of remaining) {
      await client.query("SAVEPOINT del_sp");
      try {
        await client.query(`DELETE FROM ${t.table} WHERE "${t.column}" = $1`, [tenantId]);
        await client.query("RELEASE SAVEPOINT del_sp");
        madeProgress = true;
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT del_sp");
        if ((err as { code?: string }).code === "23503") {
          blocked.push(t);
        } else {
          throw err;
        }
      }
    }
    if (blocked.length && !madeProgress) {
      throw new Error(
        `tenantCleanup: could not delete tenant-referencing rows for tenant ${tenantId}; ` +
          `tables still blocked by a foreign key: ${blocked.map((b) => b.table).join(", ")}. ` +
          `A child table references one of these via an ON DELETE NO ACTION FK that is NOT ` +
          `tenant-scoped (so it can't be auto-discovered). Give that FK ON DELETE CASCADE/SET ` +
          `NULL, or delete its rows explicitly before calling deleteTenantCascade.`,
      );
    }
    remaining = blocked;
  }
}

/**
 * Fully delete a single seeded test tenant and every row that references it.
 * Note: `app_sessions` has no tenant FK (keyed by `sid`), so sessions are NOT
 * cleared here — track + delete those separately (see purgeExpiredTestSessionsBySid).
 */
export async function deleteTenantCascade(pool: Pool, tenantId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await deleteTenantReferencingRows(client, tenantId);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export interface PurgeStaleTenantsOptions {
  /** Slug prefix every fixture tenant of this suite shares (e.g. "it-ms-smoke-"). */
  slugPrefix: string;
  /**
   * Exact `tenants.name` the suite seeds (e.g. "IT Microsite Tenant"). REQUIRED
   * secondary guard so a real customer tenant that merely starts with the same
   * slug prefix is never matched on a shared production DB.
   */
  name: string;
  /**
   * Only purge tenants created more than this many minutes ago. Guards against
   * race-deleting a concurrent run's freshly-seeded fixture. Defaults to 30 —
   * far longer than any test run, so only genuine stragglers are removed.
   */
  minAgeMinutes?: number;
}

/**
 * Idempotent cleanup of leftover test tenants from an earlier run (crash, or an
 * older teardown whose swallowed FK error orphaned the tenant). Call in
 * beforeAll. Best-effort per tenant: one stubborn row never blocks the rest, but
 * failures are logged (never silently swallowed) so FK drift stays visible.
 */
export async function purgeStaleTestTenants(
  pool: Pool,
  opts: PurgeStaleTenantsOptions,
): Promise<void> {
  const minAge = opts.minAgeMinutes ?? 30;
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM tenants
      WHERE slug LIKE $1
        AND name = $2
        AND created_at < now() - ($3 || ' minutes')::interval`,
    [likePrefix(opts.slugPrefix), opts.name, String(minAge)],
  );
  for (const row of rows) {
    try {
      await deleteTenantCascade(pool, row.id);
    } catch (err) {
      // Surface (don't swallow) so a newly-added unhandled FK doesn't silently
      // start leaking tenants again — the exact failure mode this helper fixes.
      console.warn(
        `[tenantCleanup] failed to purge stale tenant ${row.id} (${opts.slugPrefix}*):`,
        (err as Error).message,
      );
    }
  }
}

/**
 * Delete EXPIRED orphan `app_sessions` rows whose `sid` starts with `prefix`.
 * app_sessions has no tenant FK, so test sessions are keyed by their
 * test-prefixed sid. Scoped to already-expired rows so it can't race-delete a
 * concurrent run's still-valid session (the suite's afterAll deletes its own
 * live sessions by exact sid; anything left here is a stale straggler).
 */
export async function purgeExpiredTestSessionsBySid(pool: Pool, prefix: string): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid LIKE $1 AND expire < now()`, [
    likePrefix(prefix),
  ]);
}
