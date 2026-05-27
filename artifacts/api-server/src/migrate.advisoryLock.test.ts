/**
 * Task #442 regression — verify the migration advisory lock can never
 * wedge a production deploy via a leaked-into-app-pool holder.
 *
 * The historical incident:
 *   1. `runMigrationsLocked` acquired the lock on a connection borrowed
 *      from the shared app pool.
 *   2. The post-migration `pg_advisory_unlock` errored and was swallowed
 *      by `.catch(() => undefined)`.
 *   3. The connection (still holding the session-scoped advisory lock)
 *      was returned to the pool and reused for normal app SELECTs.
 *   4. The next deploy's `migrate` step blocked trying to acquire the
 *      same lock; because `NODE_ENV=production` the steal path was
 *      disabled, so the build aborted instead of self-healing.
 *
 * This file exercises the two pieces of the fix that have to keep working:
 *   (a) `isHolderProdStealEligible` — only idle holders running
 *       non-migration queries are eligible for termination in production.
 *   (b) `acquireMigrationLock` — when a leaked-style idle holder is
 *       present and NODE_ENV=production, the steal path runs and the
 *       lock is acquired (instead of the build hard-failing).
 *
 * The integration portion runs against the real Postgres pool so
 * `pg_try_advisory_lock` / `pg_terminate_backend` are exercised
 * end-to-end. Steal/warn thresholds are driven down via env vars so
 * the test completes in ~1s.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Drive the steal path quickly. MUST be set BEFORE migrate.ts is imported
// because the thresholds are read at module load.
process.env.MIGRATE_STALE_LOCK_WARN_MS = "100";
process.env.MIGRATE_STALE_LOCK_STEAL_MS = "500";
process.env.MIGRATE_PROD_STEAL_MIN_IDLE_MS = "500";

vi.mock("./lib/logger", () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import pg from "pg";
import {
  acquireMigrationLock,
  isHolderProdStealEligible,
  looksLikeMigrationQuery,
  MIGRATION_ADVISORY_LOCK_KEY,
  MIGRATION_LOCK_CLASSID,
  MIGRATION_LOCK_OBJID,
} from "./migrate";

const CONNECTION_STRING =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

function newClient(): pg.Client {
  return new pg.Client({ connectionString: CONNECTION_STRING });
}

// Query via a fresh dedicated pg.Client. We deliberately do NOT use the
// shared @workspace/db pool here: many managed Postgres setups (Neon,
// pgbouncer) front the database with a transaction-mode pooler that
// multiplexes client connections onto a smaller set of server backends,
// so pool.query(...) sees a server-backend PID that may itself hold (or
// appear to hold) advisory locks taken by other tests / app traffic.
// A direct connection sees the real backend cleanly.
async function withDirectClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = newClient();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end().catch(() => undefined);
  }
}

async function holdersGrantedPids(): Promise<number[]> {
  return withDirectClient(async (c) => {
    const { rows } = await c.query<{ pid: number }>(
      `SELECT pid FROM pg_locks
        WHERE locktype = 'advisory'
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND classid = $1 AND objid = $2 AND granted = true
          AND pid <> pg_backend_pid()`,
      [MIGRATION_LOCK_CLASSID, MIGRATION_LOCK_OBJID],
    );
    return rows.map((r) => r.pid);
  });
}

describe("migrate advisory lock helpers", () => {
  it("looksLikeMigrationQuery flags DDL and migration tables", () => {
    expect(looksLikeMigrationQuery("CREATE TABLE foo (id int)")).toBe(true);
    expect(looksLikeMigrationQuery("alter table tenants add column x text")).toBe(true);
    expect(looksLikeMigrationQuery("INSERT INTO __drizzle_migrations VALUES (...)")).toBe(true);
    expect(looksLikeMigrationQuery("SELECT 1 FROM _schema_migration_markers")).toBe(true);
    expect(looksLikeMigrationQuery("SELECT pg_advisory_unlock(123)")).toBe(true);
  });

  it("looksLikeMigrationQuery ignores normal app SELECTs", () => {
    expect(looksLikeMigrationQuery("SELECT id, slug FROM lp_proof_points WHERE tenant_id = $1")).toBe(false);
    expect(looksLikeMigrationQuery(null)).toBe(false);
    expect(looksLikeMigrationQuery("")).toBe(false);
    expect(looksLikeMigrationQuery("UPDATE tenants SET settings = $1 WHERE id = $2")).toBe(false);
  });

  it("isHolderProdStealEligible refuses active or migration-like holders", () => {
    const now = Date.now();
    const baseHolder = {
      pid: 1,
      classid: MIGRATION_LOCK_CLASSID,
      objid: MIGRATION_LOCK_OBJID,
      granted: true,
      state: "idle",
      query: "SELECT 1 FROM lp_proof_points",
      backend_start: new Date(now - 60_000),
      state_change: new Date(now - 60_000),
    };
    // Idle app query, idle long enough → eligible
    expect(isHolderProdStealEligible(baseHolder, now)).toBe(true);
    // Not granted → no
    expect(isHolderProdStealEligible({ ...baseHolder, granted: false }, now)).toBe(false);
    // Active → no
    expect(isHolderProdStealEligible({ ...baseHolder, state: "active" }, now)).toBe(false);
    // Migration-like query → no
    expect(
      isHolderProdStealEligible({ ...baseHolder, query: "CREATE TABLE foo (id int)" }, now),
    ).toBe(false);
    // Not idle long enough → no
    expect(
      isHolderProdStealEligible({ ...baseHolder, state_change: new Date(now - 100) }, now),
    ).toBe(false);
    // Missing telemetry → fail closed
    expect(isHolderProdStealEligible({ ...baseHolder, state: null }, now)).toBe(false);
    expect(isHolderProdStealEligible({ ...baseHolder, state_change: null }, now)).toBe(false);
  });
});

const integrationDescribe = CONNECTION_STRING ? describe : describe.skip;

integrationDescribe("acquireMigrationLock (integration)", () => {
  let leakedHolder: pg.Client | null = null;
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterAll(async () => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (leakedHolder) {
      await leakedHolder.end().catch(() => undefined);
      leakedHolder = null;
    }
  });

  beforeEach(async () => {
    // Belt-and-suspenders: drop any holders from prior runs so the test
    // starts from a clean slate. We can only target the specific
    // (classid, objid) of the migration lock — never widen this.
    const stalePids = await holdersGrantedPids();
    if (stalePids.length > 0) {
      await withDirectClient(async (c) => {
        for (const pid of stalePids) {
          await c.query(`SELECT pg_terminate_backend($1::int)`, [pid]).catch(() => undefined);
        }
      });
    }
  });

  it("steals an idle non-migration holder in production and acquires the lock", async () => {
    process.env.NODE_ENV = "production";

    // Simulate the leak: a separate connection holds the migration
    // advisory lock and then goes idle running a non-migration query.
    // This is exactly the shape of the prod incident's leaked app-pool
    // connection — granted=true, state=idle, query=SELECT ...
    leakedHolder = newClient();
    await leakedHolder.connect();
    const got = await leakedHolder.query<{ ok: boolean }>(
      `SELECT pg_try_advisory_lock($1::bigint) AS ok`,
      [MIGRATION_ADVISORY_LOCK_KEY],
    );
    expect(got.rows[0]?.ok).toBe(true);
    // Run a benign non-migration query so pg_stat_activity.query reflects
    // an app-shaped SELECT (not the pg_try_advisory_lock above).
    await leakedHolder.query(`SELECT 1 AS app_query`);

    // Wait past PROD_STEAL_MIN_IDLE_MS so the holder qualifies as
    // "clearly idle, not running a migration".
    await new Promise((r) => setTimeout(r, 1_000));

    const acquirer = newClient();
    await acquirer.connect();
    try {
      await acquireMigrationLock(acquirer);
      // We now hold it. Releasing on this connection should succeed.
      const release = await acquirer.query<{ released: boolean }>(
        `SELECT pg_advisory_unlock($1::bigint) AS released`,
        [MIGRATION_ADVISORY_LOCK_KEY],
      );
      expect(release.rows[0]?.released).toBe(true);
    } finally {
      await acquirer.end().catch(() => undefined);
    }

    // The leaked holder's backend was terminated by the steal path.
    // pg.Client surfaces this as a connection error on the next query.
    try {
      await leakedHolder.query(`SELECT 1`);
    } catch {
      /* expected */
    }
    await leakedHolder.end().catch(() => undefined);
    leakedHolder = null;

    // No app-pool connection holds the migration lock once the test
    // releases it. This is the post-condition that protects the next
    // deploy from the same wedge. pg_locks / pg_stat_activity can lag
    // briefly after pg_terminate_backend + client.end() — poll for up
    // to 2s before asserting.
    let stillHeld: number[] = [];
    for (let i = 0; i < 20; i++) {
      stillHeld = await holdersGrantedPids();
      if (stillHeld.length === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(stillHeld).toEqual([]);
  }, 90_000);
});
