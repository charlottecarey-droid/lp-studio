// One-shot migration runner. Replaces the previous behavior where the api-server
// ran the full DDL + seed batch on every cold boot — that flow regularly
// pushed cold starts past Cloud Run's startup-probe window and forced the
// advisory-lock contention work in Task #348. This script is invoked once per
// release via the artifact production build hook (see
// `.replit-artifact/artifact.toml`, which chains `pnpm migrate` after build)
// and as part of
// the api-server dev npm script (development), so each running api-server
// instance starts already-migrated and the boot path no longer touches DDL.
//
// Behavior is otherwise unchanged: the same advisory-lock contract, the same
// idempotent DDL/seed batch, the same per-step logging. Failure exits non-zero
// so deploy hooks abort the release.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "./lib/logger";

// Schema SQL lives in `lib/db/migrations/*.sql` and is applied via
// drizzle's tracked migrator (`__drizzle_migrations` table + `meta/_journal.json`)
// so each .sql file runs at most once per database. The path is resolved
// relative to this bundle's own location so it works both in dev
// (`artifacts/api-server/dist/migrate.mjs`) and in the prod build container.
const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../../lib/db/migrations");

// Stable 64-bit key for the advisory lock that serializes migration runs
// across processes sharing this database. Picked once and never changed —
// any process running this codebase uses the same key so concurrent boots
// (parallel agent runs, leftover api-server from a prior workflow) wait
// instead of fighting over ACCESS EXCLUSIVE locks during the DDL batch.
export const MIGRATION_ADVISORY_LOCK_KEY = "7421894200310042319";

// Task #348 — advisory-lock contention thresholds. The historical
// `pg_advisory_lock(...)` call blocked silently for the entire migration
// timeout (180s in CI) when a previous api-server was killed mid-migration
// and never released its session lock, or when a concurrent boot was
// genuinely slow. Now we poll with `pg_try_advisory_lock`, warn loudly
// after WARN_MS naming the holding PID, and after STEAL_MS either steal
// the lock (in development) or fail with a clear remediation message
// (in production) so the e2e webServer surfaces a real error instead of
// timing out with no signal.
// Task #442 — both thresholds are env-overridable so the regression test
// can drive the steal path in under a second. Production values are
// unchanged unless the env vars are explicitly set.
const STALE_LOCK_WARN_MS = Number(process.env.MIGRATE_STALE_LOCK_WARN_MS ?? 15_000);
const STALE_LOCK_STEAL_MS = Number(process.env.MIGRATE_STALE_LOCK_STEAL_MS ?? 30_000);

// When pg_advisory_lock is called with a single bigint, Postgres stores
// the value split across (classid, objid): classid = high 32 bits,
// objid = low 32 bits. We need these exact two values to filter pg_locks
// to ONLY the migration lock and never touch (or terminate the holders
// of) unrelated advisory locks held by other parts of the system.
const MIGRATION_LOCK_KEY_BIGINT = BigInt(MIGRATION_ADVISORY_LOCK_KEY);
export const MIGRATION_LOCK_CLASSID = Number(MIGRATION_LOCK_KEY_BIGINT >> 32n) >>> 0;
export const MIGRATION_LOCK_OBJID = Number(MIGRATION_LOCK_KEY_BIGINT & 0xffffffffn) >>> 0;

// Neon's pooled endpoint (the `-pooler` host) runs PgBouncer in transaction
// mode, which keeps a server backend alive after our client disconnects. A
// session-scoped advisory lock taken over that pooler can therefore SURVIVE
// an interrupted migrate (a cancelled or killed publish): the backend lingers
// holding the lock with state='active', which the production steal path
// refuses to terminate, so every later deploy aborts until the backend is
// manually killed (`pg_terminate_backend`).
//
// Holding the migration lock on the DIRECT (non-pooled) endpoint instead
// means the lock is released the instant this process's TCP socket closes —
// even on a hard kill — because there is no pooler keeping the backend alive.
// This only rewrites the host used by the dedicated lock client; the
// migration DDL itself still runs over the normal pooled `db`/`pool`, where
// drizzle wraps the batch in a single (transaction-scoped) transaction that
// the pooler releases on commit/rollback regardless.
//
// The rewrite is deliberately narrow: Neon encodes the pool marker as a
// `-pooler` SUFFIX on the FIRST host label (the endpoint id), e.g.
// `ep-x-123-pooler.<region>.aws.neon.tech` → direct `ep-x-123.<region>...`.
// We only touch `*.neon.tech` hosts and only strip the suffix on that first
// label, so non-Neon connection strings (and any incidental `-pooler` text
// elsewhere in the host) are left untouched — a malformed rewrite here would
// abort every deploy.
function rewriteNeonHostToDirect(host: string): string {
  if (!host.endsWith(".neon.tech")) return host;
  const labels = host.split(".");
  if (labels[0]?.endsWith("-pooler")) {
    labels[0] = labels[0].slice(0, -"-pooler".length);
  }
  return labels.join(".");
}

export function toDirectConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.hostname = rewriteNeonHostToDirect(url.hostname);
    return url.toString();
  } catch {
    // Not a URL-style DSN (e.g. `host=... user=...`). Best-effort: strip the
    // pooled suffix only when it directly precedes a Neon host, never a blind
    // global replace.
    return connectionString.replace(/-pooler(\.[^\s/]*\.neon\.tech)/, "$1");
  }
}

// Minimal shape — @types/pg isn't reachable from this package, so we
// can't import PoolClient directly. Only the two methods we actually use
// are declared here; the runtime object is a full pg Client and
// supports a lot more.
interface LockClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

type AdvisoryLockHolder = {
  pid: number;
  classid: number;
  objid: number;
  granted: boolean;
  state: string | null;
  query: string | null;
  backend_start: Date | null;
  state_change: Date | null;
};

// Task #442 — heuristics for the production-safe steal path. The holder is
// only eligible for termination in production when its session is clearly
// NOT actively running a migration: it's idle (state != 'active'), its
// last-seen statement doesn't look like DDL or one of our seed/marker
// statements, and the backend has been idle for at least this threshold.
// This keeps the dev-mode aggressive steal unchanged while letting a leaked
// lock on an idle app pool connection self-heal on the next deploy.
const PROD_STEAL_MIN_IDLE_MS = Number(process.env.MIGRATE_PROD_STEAL_MIN_IDLE_MS ?? 30_000);
const MIGRATION_QUERY_HINTS = [
  /\b(create|alter|drop)\s+(table|index|schema|extension|type|function|policy|view|sequence|materialized)\b/i,
  /\b__drizzle_migrations\b/i,
  /\b_schema_migration_markers\b/i,
  /\bpg_advisory_lock\b/i,
  /\bpg_try_advisory_lock\b/i,
  /\bpg_advisory_unlock\b/i,
];

export function looksLikeMigrationQuery(q: string | null): boolean {
  if (!q) return false;
  return MIGRATION_QUERY_HINTS.some((re) => re.test(q));
}

// Returns ONLY rows for the specific migration advisory lock (classid+objid
// match). This filter is critical: the steal path calls pg_terminate_backend
// on the returned PIDs, so widening this query to "all advisory locks" would
// allow Task #348's recovery code to kill unrelated sessions that happen to
// hold a different advisory lock. Filtered by current database too, so a
// shared Neon dev branch with another schema can't be touched either.
async function inspectAdvisoryLockHolders(lockClient: LockClient): Promise<AdvisoryLockHolder[]> {
  try {
    const { rows } = await lockClient.query<AdvisoryLockHolder>(
      `SELECT l.pid, l.classid, l.objid, l.granted,
              a.state, a.query, a.backend_start, a.state_change
         FROM pg_locks l
         LEFT JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory'
          AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND l.classid = $1
          AND l.objid = $2`,
      [MIGRATION_LOCK_CLASSID, MIGRATION_LOCK_OBJID],
    );
    return rows;
  } catch {
    return [];
  }
}

// Task #442 — production-safe steal eligibility. The historical incident:
// the migration acquired the advisory lock on a connection borrowed from
// the shared app pool, the unlock errored, and the connection (still
// holding the lock) was returned to the pool and reused for normal app
// SELECTs. The next deploy's migrate couldn't acquire the lock; because
// NODE_ENV=production the steal path was disabled, so the build aborted.
//
// A holder is safe to terminate in production ONLY when we're confident
// it isn't actively running a migration. We require: state != 'active'
// (idle / idle in transaction), the last-seen query doesn't look like
// migration DDL or one of our seed markers, and the backend has been
// idle for at least PROD_STEAL_MIN_IDLE_MS. That matches exactly the
// leak-into-app-pool pattern we need to recover from, without ever
// killing a peer that's mid-migrate.
export function isHolderProdStealEligible(h: AdvisoryLockHolder, now: number): boolean {
  if (!h.granted) return false;
  // Fail closed when pg_stat_activity telemetry is missing — if we can't
  // confirm the holder is idle on a non-migration query, we MUST NOT
  // terminate it in production.
  if (!h.state) return false;
  if (h.state === "active") return false;
  if (!h.state_change) return false;
  if (looksLikeMigrationQuery(h.query)) return false;
  const sinceChange = now - new Date(h.state_change).getTime();
  return sinceChange >= PROD_STEAL_MIN_IDLE_MS;
}

export async function acquireMigrationLock(lockClient: LockClient): Promise<void> {
  const started = Date.now();
  let warned = false;
  let stealAttempted = false;
  // Loop until acquired or we give up. Each iteration is a non-blocking
  // try-acquire so we get a chance to inspect contention and surface it.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await lockClient.query<{ ok: boolean }>(
      `SELECT pg_try_advisory_lock($1::bigint) AS ok`,
      [MIGRATION_ADVISORY_LOCK_KEY],
    );
    if (rows[0]?.ok) {
      const waitedMs = Date.now() - started;
      if (waitedMs >= 1_000) {
        logger.info({ waitedMs }, "Acquired migration advisory lock after contention");
      }
      return;
    }
    const waitedMs = Date.now() - started;
    if (!warned && waitedMs >= STALE_LOCK_WARN_MS) {
      warned = true;
      const holders = await inspectAdvisoryLockHolders(lockClient);
      logger.warn(
        { waitedMs, holders },
        "Migration advisory lock contention — still waiting for previous holder to release",
      );
    }
    if (waitedMs >= STALE_LOCK_STEAL_MS) {
      const holders = await inspectAdvisoryLockHolders(lockClient);
      const grantedHolders = holders.filter((h) => h.granted);
      const holderPids = grantedHolders.map((h) => h.pid);
      const isProduction = process.env.NODE_ENV === "production";
      // Task #442 — in production, only steal from holders that are clearly
      // not running a migration (idle app pool connections that leaked the
      // lock). In development, the previous behavior is preserved: steal
      // from every granted holder once.
      const stealablePids = isProduction
        ? grantedHolders.filter((h) => isHolderProdStealEligible(h, Date.now())).map((h) => h.pid)
        : holderPids;
      if (!stealAttempted && stealablePids.length > 0) {
        stealAttempted = true;
        logger.warn(
          { holderPids, stealablePids, waitedMs, isProduction },
          isProduction
            ? "Stealing leaked migration advisory lock — terminating idle holder backend(s) (NODE_ENV=production, non-migration query)"
            : "Stealing stale migration advisory lock — terminating holder backend(s) (NODE_ENV != production)",
        );
        for (const pid of stealablePids) {
          await lockClient
            .query(`SELECT pg_terminate_backend($1::int)`, [pid])
            .catch((err) => logger.warn({ err, pid }, "pg_terminate_backend failed (will retry acquire)"));
        }
        // fall through — next loop iteration will retry; terminated backend
        // releases its session-scoped advisory locks immediately.
      } else {
        const pidList = holderPids.length > 0 ? holderPids.join(", ") : "unknown";
        const remediation = holderPids.length > 0
          ? `Run \`SELECT pg_terminate_backend(${holderPids[0]})\` against the database to release it, then re-trigger this build.`
          : `Check for a stuck api-server process holding the migration lock and re-trigger this build.`;
        throw new Error(
          `Migration advisory lock held by PID(s) ${pidList} for ${Math.round(waitedMs / 1000)}s — refusing to wait further. ${remediation}`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Postgres SQLSTATEs that signal a transient, retryable failure of the DDL
// batch. 40P01 = deadlock_detected, 40001 = serialization_failure. During a
// zero-downtime publish, `migrate` runs while the PREVIOUS api-server instance
// is still serving live traffic: its RowExclusiveLocks (from INSERT/UPDATE)
// can deadlock against the migration's ShareLock / AccessExclusiveLock on
// overlapping relations. Postgres breaks the cycle by aborting one side — when
// that side is the migrate, the statement throws 40P01 and the deploy hook
// exits non-zero, failing the publish. The advisory lock above only serializes
// migrate-vs-migrate; it cannot prevent a deadlock against the live app.
//
// Every step in runMigrationsBody is idempotent — drizzle dedups already-applied
// .sql files via __drizzle_migrations (and rolls back its batch transaction on
// error, so nothing is half-applied), and the self-heals are all
// IF NOT EXISTS / ON CONFLICT DO NOTHING. So simply re-running the whole body on
// a transient lock failure is always safe and clears the contention once the
// timing shifts (the live app's conflicting transaction commits in the meantime).
const RETRYABLE_MIGRATION_PG_CODES = new Set(["40P01", "40001"]);
const MAX_MIGRATION_BODY_ATTEMPTS = 5;

export function isRetryableMigrationError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" && RETRYABLE_MIGRATION_PG_CODES.has(code);
}

// Run runMigrationsBody, retrying the whole body on a transient lock failure
// (see RETRYABLE_MIGRATION_PG_CODES). Backoff is exponential and bounded so a
// stuck deploy still fails in reasonable time rather than spinning forever. The
// migration advisory lock is held across retries (the caller acquired it on a
// dedicated client), so this never races another migrate.
async function runMigrationsBodyWithRetry(): Promise<void> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await runMigrationsBody();
      if (attempt > 1) {
        logger.info(
          { attempt },
          "Migration body succeeded after retrying a transient lock failure",
        );
      }
      return;
    } catch (err) {
      if (attempt < MAX_MIGRATION_BODY_ATTEMPTS && isRetryableMigrationError(err)) {
        const code = (err as { code?: string }).code;
        const backoffMs = Math.min(8_000, 500 * 2 ** (attempt - 1));
        logger.warn(
          { attempt, maxAttempts: MAX_MIGRATION_BODY_ATTEMPTS, code, backoffMs },
          `Migration hit a transient lock failure (${code}) — retrying after backoff`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
}

export async function runMigrationsLocked(): Promise<void> {
  // Task #442 — hold the advisory lock on a DEDICATED pg.Client (NOT a
  // connection borrowed from the shared app pool). Previously this used
  // `pool.connect()`; when the post-migration unlock errored, the still-
  // locked connection got returned to the pool and reused for normal app
  // SELECTs, wedging the next deploy's migrate (visible in prod build logs
  // as a `SELECT ... FROM lp_proof_points` PID holding the advisory lock).
  //
  // Using a dedicated Client guarantees `client.end()` destroys the
  // underlying TCP socket — Postgres releases all session-scoped advisory
  // locks when the backend exits, so a leak into the app pool is now
  // structurally impossible even if pg_advisory_unlock errors.
  //
  // pg_advisory_lock is session-scoped, so the lock also auto-releases if
  // the process crashes — preventing permanently-stuck startups.
  const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set for migrations");
  }
  // Hold the lock on the DIRECT (non-pooled) Neon endpoint so it always
  // releases when this process exits — see toDirectConnectionString above.
  // No-op for non-Neon / non-pooled connection strings.
  const lockClient = new pg.Client({ connectionString: toDirectConnectionString(connectionString) });
  await lockClient.connect();
  try {
    await acquireMigrationLock(lockClient as unknown as LockClient);
    try {
      await runMigrationsBodyWithRetry();
    } finally {
      try {
        await (lockClient as unknown as LockClient).query(
          `SELECT pg_advisory_unlock($1::bigint)`,
          [MIGRATION_ADVISORY_LOCK_KEY],
        );
      } catch (err) {
        // Task #442 — surface unlock failures loudly. The previous
        // `.catch(() => undefined)` swallowed exactly the failure mode
        // that caused the prod incident: unlock errored, connection went
        // back to the pool still holding the lock, next deploy hung.
        // We still don't rethrow so the underlying migration result
        // (success or the real migration error) is preserved; the
        // dedicated-Client `end()` below guarantees the lock cannot leak
        // regardless.
        logger.error(
          { err, lockKey: MIGRATION_ADVISORY_LOCK_KEY },
          "pg_advisory_unlock failed after migration — connection will be destroyed so lock cannot leak",
        );
      }
    }
  } finally {
    // Destroy the connection — Postgres releases session-scoped advisory
    // locks on backend exit, so even if unlock above failed the lock is
    // gone the moment this resolves.
    await lockClient.end().catch((err) => {
      logger.error({ err }, "lockClient.end() failed — advisory lock will release on TCP timeout");
    });
  }
}

// Task #348 — wrap each migration phase so the workflow log shows which
// step is running and how long it took. Without this, a hang inside the
// big DDL batch or one of the seed phases was invisible: the only signal
// was Playwright's eventual webServer timeout. Now a stuck step is
// obvious — the last "migration step start: <name>" line names it.
async function runStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  logger.info({ step: name }, `migration step start: ${name}`);
  try {
    const result = await fn();
    logger.info({ step: name, elapsedMs: Date.now() - started }, `migration step done: ${name}`);
    return result;
  } catch (err) {
    logger.error({ step: name, elapsedMs: Date.now() - started, err }, `migration step failed: ${name}`);
    throw err;
  }
}

// Run an idempotent constraint/FK self-heal that would otherwise issue
// DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT (or ALTER TABLE) on EVERY deploy.
// Even a no-op ALTER acquires AccessExclusiveLock on the table(s) involved — for
// an FK, on BOTH the child and the referenced parent. During a zero-downtime
// publish that lock collides with the live previous instance's RowExclusiveLocks
// (ongoing INSERT/UPDATE), and Postgres aborts one side with a deadlock
// (SQLSTATE 40P01) — which, when it picks the migrate, fails the publish.
//
// The fix: probe the catalog FIRST with `checkSql` (a SELECT returning a single
// integer `present`). A SELECT takes only an AccessShareLock and never deadlocks
// against writers, so when the desired state already holds — the overwhelmingly
// common steady-state deploy — we skip the locking DDL entirely and take no
// table lock at all. Only a genuinely drifted DB falls through to apply the .sql
// (where the retry wrapper + idempotent SQL still make a transient lock failure
// safe), after which we re-assert and fail CLOSED on any shortfall.
async function runProbedSelfHeal(opts: {
  name: string;
  applySqlFile: string;
  checkSql: string;
  expected: number;
  shortfall: (present: number) => string;
}): Promise<void> {
  await runStep(opts.name, async () => {
    const probe = await pool.query<{ present: number }>(opts.checkSql);
    if ((probe.rows[0]?.present ?? 0) >= opts.expected) {
      logger.info(
        { step: opts.name },
        `${opts.name}: already satisfied — skipping DDL (no table lock taken)`,
      );
      return;
    }
    const applySql = readFileSync(path.join(MIGRATIONS_FOLDER, opts.applySqlFile), "utf8");
    await pool.query(applySql);
    const { rows } = await pool.query<{ present: number }>(opts.checkSql);
    const present = rows[0]?.present ?? 0;
    if (present < opts.expected) {
      throw new Error(opts.shortfall(present));
    }
  });
}

async function runMigrationsBody(): Promise<void> {
  try {
    // Apply schema migrations from `lib/db/migrations/*.sql` via drizzle's
    // tracked migrator. Each file runs at most once per database (deduped by
    // hash in `drizzle.__drizzle_migrations`). Drizzle wraps the whole batch
    // in a single transaction.
    await runStep("drizzle migrate (lib/db/migrations)", async () => {
      await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    });
    logger.info("Migrations applied successfully");

    // Durable self-heal for the in-app notifications schema. The drizzle
    // node-postgres migrator only applies a journal entry whose `when` is
    // GREATER than the max created_at already recorded in
    // drizzle.__drizzle_migrations. 0041_notifications.sql is journaled with a
    // `when` that sits BELOW that high-water mark on DBs whose journal was
    // hand-renumbered AFTER they were migrated, so drizzle skips 0041 forever —
    // notification_sends / notification_templates silently never get created,
    // and the dispatcher only logs the resulting insert error (the feature
    // looks healthy while dropping every notification). Re-applying the file
    // here is independent of drizzle's high-water-mark dedup and self-heals any
    // such drifted DB. It is safe on every DB: the file is entirely
    // CREATE TABLE/INDEX IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING, so
    // it creates the tables where missing and is a no-op everywhere else. The
    // .sql file stays the single source of truth (read, not duplicated here).
    //
    // Unlike the best-effort data backfills below, this step fails CLOSED: it
    // is table-existence-critical (the whole point of this task is guaranteeing
    // notification_sends / notification_templates exist), so any error here —
    // bad path, permission, malformed SQL — must abort the release rather than
    // ship an api-server that silently drops every notification. The SQL is
    // idempotent, so a retry on the next deploy is always safe.
    await runProbedSelfHeal({
      name: "notifications schema self-heal (0041)",
      applySqlFile: "0041_notifications.sql",
      expected: 2,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('notification_sends', 'notification_templates')`,
      shortfall: (present) =>
        `notifications schema self-heal did not produce both tables (found ${present}/2) — aborting release`,
    });

    // Durable self-heal for the workflow_send_failures ledger (Task #625). Same
    // high-water-mark hazard as the notifications/block_catalog self-heals: on a
    // DB whose journal was renumbered after it was migrated, drizzle can record
    // 0051 as applied without its DDL ever running (or skip it entirely when its
    // `when` collides with an existing high-water mark), leaving the table
    // missing. recordWorkflowSendFailure swallows its own errors by contract
    // (the safety-net must never throw out of the send loop), so a missing table
    // would silently disable the entire safety-net with no signal. Re-applying
    // the file here is independent of drizzle's dedup. It is safe on every DB:
    // the file is CREATE TABLE/INDEX IF NOT EXISTS, so it creates the table where
    // missing and is a no-op everywhere else. The .sql stays the single source of
    // truth. Fails CLOSED: the table is feature-critical, so any error aborts the
    // release; the SQL is idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "workflow_send_failures self-heal (0051)",
      applySqlFile: "0051_workflow_send_failures.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'workflow_send_failures'`,
      shortfall: () =>
        "workflow_send_failures self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the tenant_email_shells.physical_address column.
    // Same high-water-mark hazard as the notifications/workflow_send_failures
    // self-heals above: on a drifted DB whose drizzle.__drizzle_migrations max
    // created_at already sits ABOVE 0054's journal `when`, the node-postgres
    // migrator records nothing and never runs 0054's DDL, leaving the column
    // missing. Every tenant email footer injects {{physicalAddress}} and the
    // shell resolver SELECTs physical_address, so a missing column 500s the
    // whole tenant email-shell editor + breaks sends. Re-applying the file here
    // is independent of drizzle's dedup and idempotent (ADD COLUMN IF NOT
    // EXISTS), so it adds the column where missing and is a no-op elsewhere. The
    // .sql stays the single source of truth. Fails CLOSED: the column is
    // feature-critical, so any error aborts the release; a retry is always safe.
    await runProbedSelfHeal({
      name: "tenant_email_shells physical_address self-heal (0054)",
      applySqlFile: "0054_tenant_email_shells_physical_address.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenant_email_shells'
            AND column_name = 'physical_address'`,
      shortfall: () =>
        "tenant_email_shells physical_address self-heal did not produce the column — aborting release",
    });

    // Durable self-heal for the tenant_email_shells.brand_invite_emails column
    // (the self-serve "use my branded shell for seat-activation/invite emails"
    // override). Same high-water-mark hazard as the self-heals above: on a
    // drifted DB whose drizzle max created_at already sits ABOVE 0074's journal
    // `when`, the migrator records nothing and never runs 0074's DDL. The tenant
    // shell editor SELECTs and writes brand_invite_emails, so a missing column
    // 500s the editor + the invite send path's flag lookup. Re-applying the file
    // here is independent of drizzle's dedup and idempotent (ADD COLUMN IF NOT
    // EXISTS), so it adds the column where missing and is a no-op elsewhere. The
    // .sql stays the single source of truth. Fails CLOSED: any error aborts the
    // release; a retry is always safe.
    await runProbedSelfHeal({
      name: "tenant_email_shells brand_invite_emails self-heal (0074)",
      applySqlFile: "0074_tenant_email_shells_brand_invite_emails.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenant_email_shells'
            AND column_name = 'brand_invite_emails'`,
      shortfall: () =>
        "tenant_email_shells brand_invite_emails self-heal did not produce the column — aborting release",
    });

    // Durable self-heal for the email_shell_templates.physical_address column.
    // Same high-water-mark hazard as the self-heals above: on a drifted DB whose
    // drizzle.__drizzle_migrations max created_at already sits ABOVE 0064's
    // journal `when`, the node-postgres migrator records nothing and never runs
    // 0064's DDL, leaving the column missing. The platform shell resolver SELECTs
    // physical_address and the superadmin shell editor reads/writes it, so a
    // missing column 500s the editor + breaks the address auto-fill on every
    // platform/auth email. Re-applying the file here is independent of drizzle's
    // dedup and idempotent (ADD COLUMN IF NOT EXISTS), so it adds the column where
    // missing and is a no-op elsewhere. The .sql stays the single source of
    // truth. Fails CLOSED: the column is feature-critical, so any error aborts the
    // release; a retry is always safe.
    await runProbedSelfHeal({
      name: "email_shell_templates physical_address self-heal (0064)",
      applySqlFile: "0064_email_shell_templates_physical_address.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'email_shell_templates'
            AND column_name = 'physical_address'`,
      shortfall: () =>
        "email_shell_templates physical_address self-heal did not produce the column — aborting release",
    });

    // Durable self-heal for the trial phone-gating tables (Task #637). Same
    // high-water-mark hazard as the self-heals above: on a DB whose journal was
    // renumbered after it was migrated, drizzle can record 0055 as applied
    // without its DDL ever running, leaving the tables missing. Without
    // trial_phone_numbers the one-trial-per-number gate silently fails open
    // (every number could re-trial); without trial_phone_tokens signup can't
    // redeem a verification, blocking all gated signups. Re-applying the file
    // here is independent of drizzle's dedup and idempotent (CREATE ... IF NOT
    // EXISTS), so it creates the tables where missing and is a no-op elsewhere.
    // Fails CLOSED: both tables are feature-critical, so a missing table aborts
    // the release; the SQL is idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "trial phone-gating self-heal (0055)",
      applySqlFile: "0055_trial_phone_verification.sql",
      expected: 2,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('trial_phone_numbers', 'trial_phone_tokens')`,
      shortfall: (present) =>
        `trial phone-gating self-heal did not produce both tables (found ${present}/2) — aborting release`,
    });

    // Durable self-heal for the trial-phone release audit log (Task #669). Same
    // high-water-mark hazard as the self-heals above: on a DB whose journal was
    // renumbered after it was migrated, drizzle can record 0056 as applied
    // without its DDL ever running, leaving the table missing. The DELETE
    // /superadmin/trial-phones route best-effort-inserts into this table on
    // every release; a missing table would silently lose the durable audit
    // trail (the whole point of this task). Re-applying the file here is
    // independent of drizzle's dedup and idempotent (CREATE ... IF NOT EXISTS),
    // so it creates the table where missing and is a no-op elsewhere. Fails
    // CLOSED: the table is feature-critical, so a missing table aborts the
    // release; the SQL is idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "trial_phone_release_log self-heal (0056)",
      applySqlFile: "0056_trial_phone_release_log.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'trial_phone_release_log'`,
      shortfall: () =>
        "trial_phone_release_log self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the app_users.github_id column ("Sign in with
    // GitHub"). Same high-water-mark hazard as the self-heals above: on a DB
    // whose journal was renumbered after it was migrated, drizzle can record
    // 0057 as applied without its DDL ever running, leaving the column missing.
    // The GitHub OAuth callback INSERTs/UPSERTs github_id on every sign-in; a
    // missing column would 500 the callback and break GitHub login entirely.
    // Re-applying the file here is independent of drizzle's dedup and idempotent
    // (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS), so it adds
    // the column where missing and is a no-op elsewhere. Fails CLOSED: the
    // column is feature-critical, so a missing column aborts the release.
    await runProbedSelfHeal({
      name: "app_users github_id self-heal (0057)",
      applySqlFile: "0057_app_users_github_id.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'app_users'
            AND column_name = 'github_id'`,
      shortfall: () =>
        "app_users github_id self-heal did not produce the column — aborting release",
    });

    // Durable self-heal for the shared superadmin audit log (Task #672). Same
    // high-water-mark hazard as the self-heals above: on a DB whose journal was
    // renumbered after it was migrated, drizzle can record 0057 as applied
    // without its DDL ever running, leaving the table missing. Several
    // superadmin routes best-effort-insert into this table on every sensitive
    // action; a missing table would silently lose the durable audit trail (the
    // whole point of this task). Re-applying the file here is independent of
    // drizzle's dedup and idempotent (CREATE ... IF NOT EXISTS), so it creates
    // the table where missing and is a no-op elsewhere. Fails CLOSED: the table
    // is feature-critical, so a missing table aborts the release; the SQL is
    // idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "audit_log self-heal (0058)",
      applySqlFile: "0058_audit_log.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'audit_log'`,
      shortfall: () =>
        "audit_log self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the trial-phone lookup audit log (Task #673). Same
    // high-water-mark hazard as the self-heals above: on a DB whose journal was
    // renumbered after it was migrated, drizzle can record 0059 as applied
    // without its DDL ever running, leaving the table missing. The POST
    // /superadmin/trial-phones/lookup route best-effort-inserts into this table
    // on every lookup; a missing table would silently lose the durable audit
    // trail (the whole point of this task). Re-applying the file here is
    // independent of drizzle's dedup and idempotent (CREATE ... IF NOT EXISTS),
    // so it creates the table where missing and is a no-op elsewhere. Fails
    // CLOSED: the table is feature-critical, so a missing table aborts the
    // release; the SQL is idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "trial_phone_lookup_log self-heal (0059)",
      applySqlFile: "0059_trial_phone_lookup_log.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'trial_phone_lookup_log'`,
      shortfall: () =>
        "trial_phone_lookup_log self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the oauth_login_states table (OAuth login-CSRF
    // hardening). Same high-water-mark hazard as the self-heals above: on a DB
    // whose journal was renumbered after it was migrated, drizzle can record
    // 0060 as applied without its DDL ever running, leaving the table missing.
    // Both OAuth callbacks redeem a single-use state nonce from this table
    // BEFORE token exchange; a missing table would throw on every redeem and
    // break ALL Google + GitHub logins (fail closed, as designed). Re-applying
    // the file here is independent of drizzle's dedup and idempotent
    // (CREATE TABLE/INDEX IF NOT EXISTS), so it creates the table where missing
    // and is a no-op elsewhere. Fails CLOSED: the table is auth-critical, so a
    // missing table aborts the release; the SQL is idempotent so a retry is
    // always safe.
    await runProbedSelfHeal({
      name: "oauth_login_states self-heal (0060)",
      applySqlFile: "0060_oauth_login_states.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'oauth_login_states'`,
      shortfall: () =>
        "oauth_login_states self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the sales_accounts child-FK ON DELETE actions
    // (Task #781). Deleting a sales account 500s with a Postgres FK violation
    // when the account has ever had an email campaign, an SFDC opportunity, or
    // a converted SFDC lead, because three FKs into sales_accounts default to
    // RESTRICT/NO ACTION in prod:
    //   1. sales_email_campaigns.account_id — 0008 declares ON DELETE SET NULL,
    //      but 0008 is journaled BELOW the prod DB's migration high-water mark
    //      (the same drift trap as the notifications/0041 case), so drizzle
    //      silently skipped it forever; the live constraint still has no ON
    //      DELETE action.
    //   2. sfdc_opportunities.account_id — never had an ON DELETE clause.
    //   3. sfdc_leads.converted_account_id — never had an ON DELETE clause and
    //      the FK isn't even declared in the drizzle schema (plain integer).
    // These are historical/reporting rows that should outlive the account, so
    // all three must become ON DELETE SET NULL. Re-applying 0066 here is
    // independent of drizzle's high-water-mark dedup and self-heals any drifted
    // DB. It is safe on every DB: the file is DROP CONSTRAINT IF EXISTS +
    // ADD CONSTRAINT, so it reconciles the constraints where missing and is a
    // no-op everywhere else. The .sql stays the single source of truth.
    //
    // Fails CLOSED: account deletion is broken until all three FKs carry
    // ON DELETE SET NULL, so after running we assert each constraint exists with
    // confdeltype = 'n' (SET NULL) and abort the release otherwise. The SQL is
    // idempotent, so a retry on the next deploy is always safe.
    // Each FK into sales_accounts must SET NULL on delete
    // (pg_constraint.confdeltype = 'n'). Anything else still blocks the delete.
    // Probe first (AccessShareLock only); only a drifted DB runs the locking
    // DROP/ADD CONSTRAINT DDL.
    await runProbedSelfHeal({
      name: "sales_accounts child-FK ON DELETE SET NULL self-heal (0066)",
      applySqlFile: "0066_sales_account_fk_set_null.sql",
      expected: 3,
      checkSql: `SELECT count(*)::int AS present
           FROM pg_constraint c
           JOIN pg_class child ON child.oid = c.conrelid
           JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
           JOIN pg_class parent ON parent.oid = c.confrelid
           JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
          WHERE c.contype = 'f'
            AND c.confdeltype = 'n'
            AND child_ns.nspname = 'public'
            AND parent_ns.nspname = 'public'
            AND parent.relname = 'sales_accounts'
            AND (
              (child.relname = 'sales_email_campaigns' AND c.conname = 'sales_email_campaigns_account_id_fkey')
              OR (child.relname = 'sfdc_opportunities' AND c.conname = 'sfdc_opportunities_account_id_fkey')
              OR (child.relname = 'sfdc_leads' AND c.conname = 'sfdc_leads_converted_account_id_fkey')
            )`,
      shortfall: (present) =>
        `sales_accounts child-FK self-heal did not produce all three ON DELETE SET NULL constraints (found ${present}/3) — aborting release`,
    });

    // Durable self-heal for the sfdc_leads.converted_contact_id FK (Task #786).
    // Deleting a sales_contacts row 500s with a Postgres FK violation when the
    // contact was ever the conversion target of an SFDC lead, because
    // sfdc_leads.converted_contact_id was created in 0001 as
    //   converted_contact_id integer REFERENCES sales_contacts(id)
    // with NO ON DELETE clause, so it defaults to RESTRICT/NO ACTION in prod.
    // Its sibling converted_account_id was healed to SET NULL by 0066, but
    // converted_contact_id was left behind and isn't even declared in the
    // drizzle schema (until this task), so the landmine was invisible. This is
    // the last remaining RESTRICT FK in the sales/sfdc schema; every other FK is
    // already CASCADE (owned children) or SET NULL (historical/reporting rows).
    // A converted lead's contact link is historical data that should outlive the
    // contact, so it becomes ON DELETE SET NULL. Re-applying 0067 here is
    // independent of drizzle's high-water-mark dedup and self-heals any drifted
    // DB. It is safe on every DB: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT, so
    // it reconciles where missing and is a no-op everywhere else.
    //
    // Fails CLOSED: contact deletion is broken until the FK carries ON DELETE
    // SET NULL, so after running we assert the constraint exists with
    // confdeltype = 'n' (SET NULL) and abort the release otherwise. The SQL is
    // idempotent, so a retry on the next deploy is always safe.
    // The FK into sales_contacts must SET NULL on delete (confdeltype = 'n').
    // Probe first (AccessShareLock only); only a drifted DB runs the locking
    // DROP/ADD CONSTRAINT DDL.
    await runProbedSelfHeal({
      name: "sfdc_leads converted_contact_id ON DELETE SET NULL self-heal (0067)",
      applySqlFile: "0067_sfdc_leads_converted_contact_fk_set_null.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM pg_constraint c
           JOIN pg_class child ON child.oid = c.conrelid
           JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
           JOIN pg_class parent ON parent.oid = c.confrelid
           JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
          WHERE c.contype = 'f'
            AND c.confdeltype = 'n'
            AND child_ns.nspname = 'public'
            AND parent_ns.nspname = 'public'
            AND parent.relname = 'sales_contacts'
            AND child.relname = 'sfdc_leads'
            AND c.conname = 'sfdc_leads_converted_contact_id_fkey'`,
      shortfall: (present) =>
        `sfdc_leads converted_contact_id self-heal did not produce the ON DELETE SET NULL constraint (found ${present}/1) — aborting release`,
    });

    // Durable self-heal for the sales_email_sends / sales_inbound_emails child
    // FKs (Task #797). The drizzle schema declares relationships on
    // sales_email_sends.contact_id / hotlink_id and sales_inbound_emails.
    // contact_id / account_id, but migration 0000 created both tables with those
    // columns as PLAIN integers (no REFERENCES clause) and no later migration
    // ever added the FKs — so the live DB never enforced them. The drift is
    // quiet: deleting a contact, campaign, or hotlink does NOT error, but it also
    // does NOT clean up the related send / inbound rows, leaving orphans that
    // point at IDs that no longer exist and pollute reporting data. 0070 adds the
    // four missing FKs with the intended ON DELETE behavior (contact_id on sends
    // CASCADE for owned rows; hotlink_id + both inbound columns SET NULL for
    // historical/reporting rows) after first reconciling existing orphans so the
    // constraints can be added. Re-applying 0070 here is independent of drizzle's
    // high-water-mark dedup and self-heals any drifted DB. It is safe on every
    // DB: orphan cleanup is bounded to dangling rows, and the FK reconciliation
    // is DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT, so it is a no-op everywhere
    // the FKs already exist.
    //
    // Fails CLOSED: until all four FKs exist with their intended ON DELETE
    // action, deletes leak orphans, so after running we assert each constraint
    // exists with the expected confdeltype ('c' = CASCADE, 'n' = SET NULL) and
    // abort the release otherwise. The SQL is idempotent, so a retry on the next
    // deploy is always safe.
    // Each FK must exist with its intended ON DELETE action: contact_id on
    // sales_email_sends is CASCADE (confdeltype 'c'); the other three are SET
    // NULL (confdeltype 'n'). Probe first (AccessShareLock only); only a drifted
    // DB runs the locking orphan-cleanup + DROP/ADD CONSTRAINT DDL. Once all
    // four FKs exist the enforcement prevents new orphans, so skipping the
    // cleanup when already healed is safe.
    await runProbedSelfHeal({
      name: "sales_email_sends/inbound child-FK self-heal (0070)",
      applySqlFile: "0070_sales_email_sends_inbound_fks.sql",
      expected: 4,
      checkSql: `SELECT count(*)::int AS present
           FROM pg_constraint c
           JOIN pg_class child ON child.oid = c.conrelid
           JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
           JOIN pg_class parent ON parent.oid = c.confrelid
           JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
          WHERE c.contype = 'f'
            AND child_ns.nspname = 'public'
            AND parent_ns.nspname = 'public'
            AND (
              (child.relname = 'sales_email_sends' AND parent.relname = 'sales_contacts' AND c.conname = 'sales_email_sends_contact_id_fkey' AND c.confdeltype = 'c')
              OR (child.relname = 'sales_email_sends' AND parent.relname = 'sales_hotlinks' AND c.conname = 'sales_email_sends_hotlink_id_fkey' AND c.confdeltype = 'n')
              OR (child.relname = 'sales_inbound_emails' AND parent.relname = 'sales_contacts' AND c.conname = 'sales_inbound_emails_contact_id_fkey' AND c.confdeltype = 'n')
              OR (child.relname = 'sales_inbound_emails' AND parent.relname = 'sales_accounts' AND c.conname = 'sales_inbound_emails_account_id_fkey' AND c.confdeltype = 'n')
            )`,
      shortfall: (present) =>
        `sales_email_sends/inbound child-FK self-heal did not produce all four FKs with their intended ON DELETE action (found ${present}/4) — aborting release`,
    });

    // sales_hotlinks (contact_id, page_id) partial unique index self-heal (0017).
    // Campaign send / preview / test paths call ensureHotlinkForContact, which mints
    // one personalized hotlink per (contact, page) via INSERT ... ON CONFLICT
    // (contact_id, page_id) WHERE contact_id IS NOT NULL for concurrency safety. That
    // ON CONFLICT requires the PARTIAL unique index created by migration 0017. On DBs
    // where 0017 is journaled below the migration high-water mark, drizzle skips it
    // forever (same drift trap as 0041/0066/0067), so the index is missing and every
    // hotlink mint throws 42P10 ("no unique or exclusion constraint matching the ON
    // CONFLICT specification") — silently breaking {{microsite_url}} personalization
    // in campaigns. Re-create it here independent of drizzle's high-water-mark dedup.
    //
    // A unique index can't be built while duplicate (contact_id, page_id) rows exist
    // (these accumulate precisely because the ON CONFLICT was failing), so first
    // collapse duplicates to the oldest row (lowest id) before creating the index.
    // The index SQL is idempotent (CREATE UNIQUE INDEX IF NOT EXISTS), so retries are
    // safe. Fails CLOSED: campaign personalization is broken without it, so we assert
    // the index exists afterward and abort the release otherwise.
    await runStep("sales_hotlinks (contact_id, page_id) partial unique index self-heal (0017)", async () => {
      // Probe first (AccessShareLock only): if the partial unique index already
      // exists with the correct unique + (contact_id IS NOT NULL) predicate, skip
      // both the duplicate collapse and the lock-taking CREATE UNIQUE INDEX. On
      // every already-healed DB (i.e. every steady-state deploy) this takes no
      // index/table lock, removing the deadlock hazard against the still-draining
      // old instance's hotlink writes during the deploy hook.
      // Catalog-precise probe: a false-POSITIVE here (skipping when the index is
      // wrong/missing) would leave hotlink minting broken, so qualify by owning
      // table (sales_hotlinks) AND schema (public) — not index name alone — and
      // verify it is UNIQUE, carries the (contact_id IS NOT NULL) partial
      // predicate, and indexes BOTH key columns. A false-NEGATIVE is safe: it
      // just falls through to the dup-cleanup + idempotent CREATE below.
      const existing = await pool.query<{ is_unique: boolean; def: string }>(
        `SELECT i.indisunique AS is_unique, pg_get_indexdef(i.indexrelid) AS def
           FROM pg_index i
           JOIN pg_class ic ON ic.oid = i.indexrelid
           JOIN pg_class tc ON tc.oid = i.indrelid
           JOIN pg_namespace tn ON tn.oid = tc.relnamespace
          WHERE ic.relname = 'sales_hotlinks_contact_page_unique'
            AND tc.relname = 'sales_hotlinks'
            AND tn.nspname = 'public'`,
      );
      const existingDef = existing.rows[0];
      if (
        existingDef &&
        existingDef.is_unique &&
        /contact_id IS NOT NULL/i.test(existingDef.def) &&
        /\bcontact_id\b/i.test(existingDef.def) &&
        /\bpage_id\b/i.test(existingDef.def)
      ) {
        logger.info(
          { step: "sales_hotlinks (contact_id, page_id) partial unique index self-heal (0017)" },
          "sales_hotlinks contact_page self-heal: index already present — skipping DDL (no lock taken)",
        );
        return;
      }
      // Observability before any mutation: log how many (contact_id, page_id)
      // duplicate rows we're about to collapse and which ids lose their token, so
      // any impact is traceable. Duplicates are expected to be rare/zero — while
      // the index was missing every ON CONFLICT insert threw 42P10, so no new rows
      // accrued; any survivors are historical. Hard-deleting the newer duplicates
      // is safe: the click route redirects to the destination URL carried in the
      // link's query string regardless of whether the hotlink row exists, and
      // sales_email_sends.n -> sales_hotlinks.id is ON DELETE SET NULL (no orphan
      // crash). Keeping the OLDEST row (lowest id) preserves the earliest-minted,
      // most-likely-already-shared token.
      const { rows: dupRows } = await pool.query<{ id: number; token: string }>(`
        SELECT a.id, a.token
          FROM sales_hotlinks a
          JOIN sales_hotlinks b
            ON a.contact_id = b.contact_id
           AND a.page_id = b.page_id
           AND a.id > b.id
         WHERE a.contact_id IS NOT NULL
      `);
      if (dupRows.length > 0) {
        logger.warn(
          { count: dupRows.length, removedIds: dupRows.map((r) => r.id) },
          "sales_hotlinks contact_page self-heal: collapsing duplicate (contact_id,page_id) rows before unique index",
        );
        await pool.query(`
          DELETE FROM sales_hotlinks a
          USING sales_hotlinks b
          WHERE a.contact_id IS NOT NULL
            AND a.contact_id = b.contact_id
            AND a.page_id = b.page_id
            AND a.id > b.id
        `);
      }
      const indexSql = readFileSync(
        path.join(MIGRATIONS_FOLDER, "0017_sales_hotlinks_contact_page_unique.sql"),
        "utf8",
      );
      await pool.query(indexSql);
      // Post-step assertion: the index ensureHotlinkForContact's ON CONFLICT targets
      // must now exist AND be a UNIQUE index with the exact partial predicate
      // (contact_id IS NOT NULL). A name-only check could pass on a drifted/wrong
      // definition, so validate indisunique + the predicate text; otherwise hotlink
      // minting stays broken, so fail the release loudly.
      const { rows } = await pool.query<{ is_unique: boolean; def: string }>(
        `SELECT i.indisunique AS is_unique, pg_get_indexdef(i.indexrelid) AS def
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indexrelid
          WHERE c.relname = 'sales_hotlinks_contact_page_unique'`,
      );
      const heal = rows[0];
      if (!heal || !heal.is_unique || !/contact_id IS NOT NULL/i.test(heal.def)) {
        throw new Error(
          `sales_hotlinks contact_page unique index self-heal produced an unexpected definition (unique=${heal?.is_unique ?? "missing"}, def=${heal?.def ?? "none"}) — aborting release`,
        );
      }
    });

    // Durable self-heal + seed for the featured_homepage_templates table. The
    // marketing homepage "templates" section is superadmin-editable and reads
    // its list from this table; the superadmin editor 500s on save if the table
    // is missing. Same high-water-mark hazard as the self-heals above: on a DB
    // whose journal was renumbered after it was migrated, drizzle can record
    // 0076 as applied without its DDL ever running, leaving the table missing.
    // Re-applying the file here is independent of drizzle's dedup and idempotent
    // (CREATE TABLE IF NOT EXISTS + a seed guarded by WHERE NOT EXISTS, so it
    // never resurrects rows a superadmin deleted), so it creates the table where
    // missing and is a no-op elsewhere. Fails CLOSED: any error aborts the
    // release; the SQL is idempotent so a retry is always safe.
    await runProbedSelfHeal({
      name: "featured_homepage_templates self-heal (0076)",
      applySqlFile: "0076_featured_homepage_templates.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'featured_homepage_templates'`,
      shortfall: () =>
        "featured_homepage_templates self-heal did not produce the table — aborting release",
    });

    // Durable self-heal for the Marketo two-way integration tables (Task #943).
    // Same high-water-mark hazard as the self-heals above: on a drifted DB whose
    // drizzle.__drizzle_migrations max created_at already sits ABOVE 0077's
    // journal `when`, the node-postgres migrator records nothing and never runs
    // 0077's DDL, leaving the tables/columns missing. The Marketo settings UI,
    // sync routes, and the outbound push triggers (campaigns/hotlinks/signals)
    // all read these tables and sales_contacts.marketo_lead_id; a missing object
    // 500s the integration and silently drops every write-back. Re-applying the
    // file here is independent of drizzle's dedup and idempotent (CREATE ... IF
    // NOT EXISTS + ADD COLUMN IF NOT EXISTS), so it creates the schema where
    // missing and is a no-op elsewhere. The .sql stays the single source of
    // truth. Fails CLOSED: the schema is feature-critical, so any error aborts
    // the release; the SQL is idempotent so a retry is always safe.
    // Probe combines the 5 tables + 2 sales_contacts columns into one count
    // (expected 7) so an already-healed DB skips the locking CREATE/ALTER DDL
    // entirely — eliminating the AccessExclusiveLock that previously deadlocked
    // the deploy hook against the still-draining old instance's writes to
    // sales_contacts.
    await runProbedSelfHeal({
      name: "marketo integration schema self-heal (0077)",
      applySqlFile: "0077_marketo_integration.sql",
      expected: 7,
      checkSql: `SELECT (
             (SELECT count(*) FROM information_schema.tables
               WHERE table_schema = 'public'
                 AND table_name IN (
                   'marketo_connections',
                   'marketo_field_mappings',
                   'marketo_sync_log',
                   'marketo_lists',
                   'marketo_activities_pushed'
                 ))
           + (SELECT count(*) FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'sales_contacts'
                 AND column_name IN ('marketo_lead_id', 'marketo_last_synced_at'))
           )::int AS present`,
      shortfall: (present) =>
        `marketo integration schema self-heal did not produce all tables + sales_contacts columns (found ${present}/7) — aborting release`,
    });

    // Durable self-heal for the HubSpot two-way integration tables. Same
    // high-water-mark hazard as the self-heals above: on a drifted DB whose
    // drizzle.__drizzle_migrations max created_at already sits ABOVE 0081's
    // journal `when`, the node-postgres migrator records nothing and never runs
    // 0081's DDL, leaving the tables/columns missing. The symptom that motivated
    // this step: any sales test (and the HubSpot sync/settings routes) inserting
    // a sales_contact errors with `column "hubspot_contact_id" of relation
    // "sales_contacts" does not exist`. Re-applying the file here is independent
    // of drizzle's dedup and idempotent (CREATE ... IF NOT EXISTS + ADD COLUMN
    // IF NOT EXISTS), so it creates the schema where missing and is a no-op
    // elsewhere. The .sql stays the single source of truth. Fails CLOSED: the
    // schema is feature-critical, so any error aborts the release; the SQL is
    // idempotent so a retry is always safe.
    // Probe combines the 5 tables + 2 sales_contacts columns into one count
    // (expected 7) so an already-healed DB skips the locking CREATE/ALTER DDL
    // entirely — same deadlock-avoidance rationale as the Marketo step above.
    await runProbedSelfHeal({
      name: "hubspot integration schema self-heal (0081)",
      applySqlFile: "0081_hubspot_integration.sql",
      expected: 7,
      checkSql: `SELECT (
             (SELECT count(*) FROM information_schema.tables
               WHERE table_schema = 'public'
                 AND table_name IN (
                   'hubspot_connections',
                   'hubspot_field_mappings',
                   'hubspot_sync_log',
                   'hubspot_lists',
                   'hubspot_activities_pushed'
                 ))
           + (SELECT count(*) FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'sales_contacts'
                 AND column_name IN ('hubspot_contact_id', 'hubspot_last_synced_at'))
           )::int AS present`,
      shortfall: (present) =>
        `hubspot integration schema self-heal did not produce all tables + sales_contacts columns (found ${present}/7) — aborting release`,
    });

    // Durable self-heal for the Strict Facts review schema (0085): the
    // lp_page_fact_flags table + the lp_proof_points quote/attribution columns.
    // Same high-water-mark hazard as the self-heals above: on a drifted DB whose
    // drizzle.__drizzle_migrations max created_at already sits ABOVE 0085's
    // journal `when`, the node-postgres migrator records nothing and never runs
    // 0085's DDL, leaving the columns/table missing. The symptom that motivated
    // this step: the Review Facts modal's "Save to library" /
    // /lp/fact-flags/:id/save-to-library route INSERTs into lp_proof_points with
    // fact_kind + attribution_* columns and 500s with `column "fact_kind" of
    // relation "lp_proof_points" does not exist`. Re-applying the file here is
    // independent of drizzle's dedup and idempotent (CREATE TABLE/INDEX IF NOT
    // EXISTS + ADD COLUMN IF NOT EXISTS), so it creates the schema where missing
    // and is a no-op elsewhere. The .sql stays the single source of truth. Fails
    // CLOSED: the schema is feature-critical, so any error aborts the release;
    // the SQL is idempotent so a retry is always safe.
    // Probe combines the lp_page_fact_flags table + the 6 lp_proof_points
    // columns into one count (expected 7) so an already-healed DB skips the
    // locking CREATE/ALTER DDL entirely.
    await runProbedSelfHeal({
      name: "strict-facts review schema self-heal (0085)",
      applySqlFile: "0085_lp_page_fact_flags.sql",
      expected: 7,
      checkSql: `SELECT (
             (SELECT count(*) FROM information_schema.tables
               WHERE table_schema = 'public'
                 AND table_name = 'lp_page_fact_flags')
           + (SELECT count(*) FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = 'lp_proof_points'
                 AND column_name IN (
                   'fact_kind',
                   'attribution_name',
                   'attribution_title',
                   'attribution_company',
                   'attribution_photo_url',
                   'consent_note'
                 ))
           )::int AS present`,
      shortfall: (present) =>
        `strict-facts review schema self-heal did not produce the lp_page_fact_flags table + all lp_proof_points columns (found ${present}/7) — aborting release`,
    });

    // Task #147 — seed Dandy's webhook secrets so the existing rb2b/apollo/
    // letterdrop integrations don't break the moment we cut over the routes.
    // Generates one secret per integration for tenant #1, idempotent under
    // ON CONFLICT (the unique (tenant_id, integration) index). The marker
    // ensures we only generate fresh values once; subsequent boots are no-ops.
    // Operators must update the third-party trackers to point at the new
    // /webhooks/<integration>/<secret> URLs (logged on first seed).
    await runStep("dandy webhook secrets seed", async () => {
    try {
      const webhookMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'dandy_webhook_secrets_v1'`
      );
      if (webhookMarker.rows.length === 0) {
        const { randomBytes } = await import("node:crypto");
        const integrations = ["rb2b", "apollo", "letterdrop"] as const;
        const seeded: { integration: string; secret: string }[] = [];
        for (const integration of integrations) {
          const secret = randomBytes(24).toString("base64url");
          const result = await db.execute<{ secret: string }>(sql`
            INSERT INTO tenant_webhook_secrets (tenant_id, integration, secret)
            VALUES (1, ${integration}, ${secret})
            ON CONFLICT (tenant_id, integration) DO NOTHING
            RETURNING secret
          `);
          if (result.rows.length > 0) {
            seeded.push({ integration, secret: result.rows[0].secret });
          }
        }
        if (seeded.length > 0) {
          logger.warn(
            { seeded: seeded.map((s) => ({ integration: s.integration, urlSuffix: `/webhooks/${s.integration}/${s.secret}` })) },
            "Seeded Dandy webhook secrets — update RB2B/Apollo/Letterdrop dashboards to the new URLs"
          );
        }
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('dandy_webhook_secrets_v1') ON CONFLICT DO NOTHING`
        );
      }
    } catch (whErr) {
      logger.error({ err: whErr }, "Dandy webhook secret seed failed (non-fatal)");
    }
    });

    // One-shot backfill of tenants.settings.industry so existing rows get the
    // correct industry without manual DB intervention. Tenants #1 and #5 are
    // Dandy dental tenants; everyone else defaults to "generic". Guarded by a
    // marker so we never overwrite later admin edits.
    await runStep("tenant industry backfill", async () => {
    try {
      const backfillMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'tenant_industry_backfill_v1'`
      );
      if (backfillMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb)
                          || jsonb_build_object('industry', CASE WHEN id IN (1, 5) THEN 'dental' ELSE 'generic' END)
           WHERE settings IS NULL
              OR NOT (settings ? 'industry')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('tenant_industry_backfill_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("tenants.settings.industry backfill applied");
      }
    } catch (backfillErr) {
      logger.error({ err: backfillErr }, "tenant industry backfill failed (non-fatal)");
    }
    });

    // Task #108 — page review workflow rollout. Two backfills, both idempotent
    // and marker-guarded so reboots are no-ops:
    //   1. Add the system "Content Manager" role to every tenant that lacks
    //      one. Existing custom roles are NEVER touched.
    //   2. Extend the system "Admin" role's permissions with the new
    //      pages.publish + pages.review keys so today's tenant admins keep the
    //      ability to publish without anyone re-saving the role through the UI.
    await runStep("page review role seed", async () => {
    try {
      const reviewMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'page_review_role_seed_v1'`
      );
      if (reviewMarker.rows.length === 0) {
        const cmPerms = JSON.stringify({
          pages: true, "pages.publish": true, "pages.review": true,
          tests: true, analytics: true, forms_leads: true, brand: true,
          blocks: true, sales_dashboard: true, sales_contacts: true, sales_accounts: true,
          sales_outreach: true, sales_campaigns: false, sales_signals: true, settings: false, team: false, roles: false,
        });
        await db.execute(sql`
          INSERT INTO tenant_roles (tenant_id, name, permissions, is_admin, is_system)
          SELECT t.id, 'Content Manager', ${cmPerms}::jsonb, false, true
            FROM tenants t
           WHERE NOT EXISTS (
             SELECT 1 FROM tenant_roles r
              WHERE r.tenant_id = t.id AND r.name = 'Content Manager'
           )
        `);
        await db.execute(sql`
          UPDATE tenant_roles
             SET permissions = permissions
                            || '{"pages.publish": true, "pages.review": true}'::jsonb,
                 updated_at = now()
           WHERE is_system = true
             AND name = 'Admin'
             AND (NOT (permissions ? 'pages.publish') OR NOT (permissions ? 'pages.review'))
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('page_review_role_seed_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("Content Manager role + admin perms backfill applied");
      }
    } catch (cmErr) {
      logger.error({ err: cmErr }, "page-review role backfill failed (non-fatal)");
    }
    });

    // Task #113 — page-review-workflow toggle rollout. Mark every tenant that
    // existed BEFORE this change as `requireReviewBeforePublish=true` so they
    // continue to see the Submit/Approve/Reject UI without anyone toggling
    // anything. Tenants created AFTER this change default to FALSE in the
    // POST /api/admin/tenants insert. Marker-guarded so reboots are no-ops
    // and admins who later flip the toggle off are never overwritten.
    await runStep("requireReviewBeforePublish backfill", async () => {
    try {
      const reviewToggleMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'require_review_toggle_backfill_v1'`
      );
      if (reviewToggleMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb)
                          || '{"requireReviewBeforePublish": true}'::jsonb,
                 updated_at = now()
           WHERE settings IS NULL
              OR NOT (settings ? 'requireReviewBeforePublish')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('require_review_toggle_backfill_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("requireReviewBeforePublish backfill applied");
      }
    } catch (toggleErr) {
      logger.error({ err: toggleErr }, "require-review toggle backfill failed (non-fatal)");
    }
    });

    // Task #494 — SEO robots controls rollout. Backfill every tenant that
    // existed BEFORE this change with `seo: { allowIndexing: true,
    // allowFollowing: true }` so their published pages stay implicitly
    // indexable exactly as they are today (zero HTML diff). Tenants created
    // AFTER this change default to FALSE/FALSE in the POST /api/admin/tenants
    // insert (ABM-safe — a 1:1 prospect microsite should not surface in
    // Google by default). The two sites INTENTIONALLY differ; do not "align"
    // them. Marker-guarded so reboots are no-ops and an admin who later opts
    // in/out via the SEO settings page is never overwritten.
    await runStep("seo robots defaults backfill", async () => {
    try {
      const seoMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'seo_robots_defaults_backfill_v1'`
      );
      if (seoMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET settings = COALESCE(settings, '{}'::jsonb)
                          || '{"seo":{"allowIndexing":true,"allowFollowing":true}}'::jsonb,
                 updated_at = now()
           WHERE settings IS NULL
              OR NOT (settings ? 'seo')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('seo_robots_defaults_backfill_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("seo robots defaults backfill applied");
      }
    } catch (seoErr) {
      logger.error({ err: seoErr }, "seo robots defaults backfill failed (non-fatal)");
    }
    });

    // Task #967 — seed the Dandy tenant(s) with a "Default share card" (OG)
    // title + image so every Dandy page that lacks a per-page override advertises
    // the brand card to scrapers. We only set columns that are still NULL/empty
    // so an admin edit via the brand-settings panel is never clobbered (the
    // marker guard makes reboots no-ops anyway). Description is intentionally
    // left unset — the cascade falls through to the page's own content, which is
    // more specific than a generic tagline. The image is the exact 1200×630 card
    // served from the marketing host. Targets both protected Dandy slugs.
    await runStep("tenant og defaults dandy seed", async () => {
    try {
      const ogMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'tenant_og_defaults_dandy_seed_v1'`
      );
      if (ogMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET default_og_title = COALESCE(NULLIF(default_og_title, ''),
                   'Meet Dandy | The Modern Operating System for Dentistry'),
                 default_og_image_url = COALESCE(NULLIF(default_og_image_url, ''),
                   'https://lpstudio.ai/dandy-og-card.png'),
                 updated_at = now()
           WHERE slug IN ('dandy', 'dandy-smb')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('tenant_og_defaults_dandy_seed_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("tenant og defaults dandy seed applied");
      }
    } catch (ogErr) {
      logger.error({ err: ogErr }, "tenant og defaults dandy seed failed (non-fatal)");
    }
    });

    // Corrective one-shot: strip a stale trailing "- LP Studio" / "| LP Studio"
    // brand suffix from any tenant's default_og_title. The og-defaults seed above
    // uses COALESCE(NULLIF(...)) so it never overwrote a pre-existing value — and
    // the Dandy tenant's stored default carried a "… - LP Studio" suffix (likely
    // captured from an app-wide document.title formatter). Now that tenant/Dandy
    // hosts serve default_og_title as their fallback share card, that suffix would
    // leak LP Studio branding onto Dandy's own social previews, which Task #999
    // forbids. Tenant hosts must never advertise LP Studio; the marketing site
    // sources its card from homepage-og, not tenants.default_og_title, so this is
    // safe there. Idempotent: the WHERE clause only matches rows still carrying
    // the suffix, and the marker makes reboots no-ops.
    await runStep("tenant og title strip lp studio suffix", async () => {
    try {
      // NOTE: patterns use the POSIX class [[:space:]] rather than \s — inside a
      // JS template literal an unrecognised escape like \s collapses to a bare
      // "s" before Postgres ever sees it, so \s* would match the letter s, not
      // whitespace. v1 of this marker shipped with that bug and ran as a no-op,
      // hence the v2 bump so the corrected statement runs once on every DB.
      const stripMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'tenant_og_title_strip_lpstudio_suffix_v2'`
      );
      if (stripMarker.rows.length === 0) {
        await db.execute(sql`
          UPDATE tenants
             SET default_og_title = regexp_replace(default_og_title, '[[:space:]]*[-–—|][[:space:]]*LP Studio[[:space:]]*$', '', 'i'),
                 updated_at = now()
           WHERE default_og_title ~* '[-–—|][[:space:]]*LP Studio[[:space:]]*$'
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('tenant_og_title_strip_lpstudio_suffix_v2') ON CONFLICT DO NOTHING`
        );
        logger.info("tenant og title strip lp studio suffix applied");
      }
    } catch (stripErr) {
      logger.error({ err: stripErr }, "tenant og title strip lp studio suffix failed (non-fatal)");
    }
    });

    // Durable self-heal for the block_catalog.ai_enabled column. Same
    // high-water-mark hazard as the notifications self-heal above: drizzle only
    // applies a journal entry whose `when` is GREATER than the max created_at
    // already recorded in drizzle.__drizzle_migrations. On DBs whose journal was
    // renumbered after they were migrated, 0049_block_catalog_ai_enabled.sql can
    // be recorded as applied without its ALTER ever running, leaving the column
    // missing and every block-catalog route 500-ing. Re-applying the file here
    // is independent of that dedup. It is safe on every DB: the file is a single
    // ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so it adds the column where
    // missing and is a no-op everywhere else. The .sql stays the single source
    // of truth. This must run BEFORE the block_catalog seed below, which writes
    // ai_enabled. Fails CLOSED: the column is route-critical, so any error must
    // abort the release. The SQL is idempotent, so a retry is always safe.
    await runProbedSelfHeal({
      name: "block_catalog ai_enabled self-heal (0049)",
      applySqlFile: "0049_block_catalog_ai_enabled.sql",
      expected: 1,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'block_catalog'
            AND column_name = 'ai_enabled'`,
      shortfall: () =>
        "block_catalog ai_enabled self-heal did not produce the column — aborting release",
    });

    // Durable self-heal for sfdc_leads.industry / sfdc_leads.rating. Same
    // high-water-mark hazard as the self-heals above. These two nullable text
    // columns are declared in @workspace/db and were part of the original
    // CREATE TABLE in 0001_sfdc_integration.sql, but on DBs where sfdc_leads
    // already existed when 0001 ran (its CREATE TABLE is IF NOT EXISTS) the
    // columns were never back-filled, leaving them missing — exactly the drift
    // the schema-drift guard (migrate.schemaDrift.integration.test.ts) flags.
    // Re-applying 0084 here is independent of drizzle's dedup; the file is two
    // ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so it heals where missing and is
    // a no-op everywhere else. The .sql stays the single source of truth. Both
    // columns are checked, so `expected: 2`.
    await runProbedSelfHeal({
      name: "sfdc_leads industry/rating self-heal (0084)",
      applySqlFile: "0084_sfdc_leads_industry_rating.sql",
      expected: 2,
      checkSql: `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sfdc_leads'
            AND column_name IN ('industry', 'rating')`,
      shortfall: () =>
        "sfdc_leads industry/rating self-heal did not produce both columns — aborting release",
    });

    // Idempotent first-boot seed for the block_catalog table. Safe to run on
    // every boot — uses ON CONFLICT DO NOTHING so admin edits are never
    // clobbered. Adds rows only when missing.
    await runStep("block_catalog seed", async () => {
    try {
      // Schema (block_catalog + _schema_migration_markers tables) is created
      // by lib/db/migrations/0023_block_catalog_init.sql via drizzleMigrate
      // above. This step only seeds rows.
      // v3: cleans up the 21 dandy-*/dso-* rows that v2 incorrectly seeded
      // into the generic catalog (their BLOCK_REGISTRY defaults leak Dandy
      // branding when rendered with DEFAULT_BRAND — caught by no-dandy-leak
      // tests). Also cleans up 5 "neutral-sounding" rows whose component
      // code hardcodes Dandy colors/copy. Then runs the standard upsert.
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'block_catalog_generic_seed_v3'`
      );
      const alreadySeeded = marker.rows.length > 0;
      if (!alreadySeeded) {
        // Targeted cleanup of the v2 mis-seed. Only deletes the specific
        // block_types we know we shouldn't have inserted; admin-curated
        // entries for any other block_type are untouched.
        const LEAKY_TYPES_TO_REMOVE = [
          "dandy-cta-block", "dandy-form-right-alt", "dandy-product-hero",
          "dandy-site-footer", "dandy-site-header", "dandy-switchback",
          "dandy-versus", "dandy-vertical-tabs", "dandy-video-testimonials",
          "dso-heartland-hero", "dso-insights-dashboard", "dso-insights-video",
          "dso-lab-tour", "dso-partnership-perks", "dso-practice-hero",
          "dso-practice-nav",
          "horizontal-showcase", "bold-statement", "sticky-stack",
          "event-page", "spatial-tour",
        ];
        let removed = 0;
        for (const badType of LEAKY_TYPES_TO_REMOVE) {
          const cleanup = await db.execute<{ block_type: string }>(sql`
            DELETE FROM block_catalog
             WHERE industry = 'generic' AND block_type = ${badType}
            RETURNING block_type
          `);
          removed += cleanup.rows.length;
        }

        const { GENERIC_BLOCK_CATALOG_SEED } = await import("./seeds/blockCatalog");
        let inserted = 0;
        for (const row of GENERIC_BLOCK_CATALOG_SEED) {
          const propsJson = JSON.stringify(row.default_props ?? {});
          const result = await db.execute<{ "?column?": number }>(sql`
            INSERT INTO block_catalog (block_type, industry, label, category, default_props, sort_order)
            VALUES (${row.block_type}, 'generic', ${row.label}, ${row.category}, ${propsJson}::jsonb, ${row.sort_order ?? 0})
            ON CONFLICT (block_type, industry) DO NOTHING
            RETURNING 1
          `);
          if (result.rows.length > 0) inserted++;
        }
        await db.execute(sql`
          INSERT INTO _schema_migration_markers (key) VALUES ('block_catalog_generic_seed_v3') ON CONFLICT DO NOTHING
        `);
        logger.info(
          { removed, inserted, total: GENERIC_BLOCK_CATALOG_SEED.length },
          "block_catalog generic seed applied (v3 cleanup)"
        );
      }
    } catch (seedErr) {
      // Don't block boot on seed errors — admins can re-run scripts/seed-block-catalog.cjs
      logger.error({ err: seedErr }, "block_catalog seed failed (non-fatal)");
    }
    });

    // Consolidate every global landing-page template under the dedicated
    // system tenant (slug `__system-templates`). Globals were historically
    // owned by whichever customer tenant created/promoted them (the seed used
    // the lowest-id tenant — Dandy — and manual promotions kept their original
    // owner), which gave the global library no neutral home and made the
    // superadmin "Open in builder" edit-in-place flow unreliable. This step is
    // self-healing (runs every boot, cheap): it pulls any global owned by a
    // real customer tenant back under the system tenant. It MUST run before the
    // global_templates seed below so the seed's ON CONFLICT (tenant_id, slug)
    // upsert targets the already-consolidated rows instead of inserting
    // duplicates under the system tenant.
    // Gate the seed below on the consolidation succeeding in THIS boot. If
    // consolidation throws (caught, non-fatal) but the seed still ran, the seed
    // would insert fresh system-owned rows while legacy globals stayed put — a
    // later boot's consolidation would then move those legacy rows under
    // suffixed slugs, leaving duplicate templates. Skipping the seed until a
    // boot where consolidation fully succeeds closes that window.
    let globalsConsolidated = false;
    await runStep("global_templates consolidate under system tenant", async () => {
    try {
      const { ensureSystemTenant } = await import("./lib/systemTenant");
      const systemTenantId = await ensureSystemTenant();
      const strays = await db.execute<{ id: number; slug: string }>(sql`
        SELECT id, slug FROM lp_pages
        WHERE is_global = true AND is_template = true AND tenant_id <> ${systemTenantId}
        ORDER BY id ASC
      `);
      let moved = 0;
      for (const row of strays.rows) {
        // Resolve slug collisions against rows already living under the system
        // tenant (and against earlier rows moved in this same loop). The page
        // id suffix is globally unique so the de-collided slug can never clash.
        let slug = row.slug;
        const clash = await db.execute<{ "?column?": number }>(sql`
          SELECT 1 FROM lp_pages
          WHERE tenant_id = ${systemTenantId} AND slug = ${slug} LIMIT 1
        `);
        if (clash.rows.length > 0) slug = `${row.slug}-${row.id}`;
        await db.execute(sql`
          UPDATE lp_pages
          SET tenant_id = ${systemTenantId}, slug = ${slug}
          WHERE id = ${row.id}
        `);
        moved++;
      }
      if (moved > 0) {
        logger.info({ moved, systemTenantId }, "global_templates consolidated under system tenant");
      }
      // Reached only when the move loop finished without throwing — every stray
      // global is now under the system tenant, so the seed below can run safely.
      globalsConsolidated = true;
    } catch (consolidateErr) {
      logger.error({ err: consolidateErr }, "global_templates consolidate failed (non-fatal)");
    }
    });

    // Idempotent seed for the global landing-page templates available to all
    // generic-industry tenants. Owned by the dedicated system tenant
    // (slug `__system-templates`) — `is_global=true` makes ownership irrelevant
    // for visibility, but a single neutral owner keeps the library out of any
    // real customer workspace. Marker-gated so we only attempt once per database.
    // Global templates seed — runs on every boot until the latest marker is
    // present. We bumped from v1 → v2 when the starter library was rewritten
    // with real BLOCK_REGISTRY block types and ogImage thumbnails. The upsert
    // below replaces blocks/labels/og_image on existing rows so older seeded
    // entries (v1) get their bogus block types fixed, but tenant edits to
    // titles or new template additions remain untouched.
    await runStep("global_templates seed", async () => {
    try {
      // v13: re-seed to fix the Conversion Capture Page template, whose
      // select field stored options as {label,value} objects and crashed
      // BlockForm with a minified "objects are not valid as a React
      // child" error in production.
      // v19: fix flagship templates — Creator Portfolio bold-statement
      // crashed (`statement` was named `headline`); flagship bento tiles
      // used invalid kind "headline" + headline/body fields (rendered
      // blank); two `dandy-versus` blocks shipped with empty props (no
      // text on either side).
      // v20: re-seed to pick up fc400e28 — flagship template images
      // (before/after gallery, speaker grids, carousels) and bento tile
      // backgrounds were repopulated in the seed file but never reached
      // the DB because the v19 marker was already present.
      // v25: surface the two newest generic flagships — Storefront (DTC)
      // [global-flagship-storefront-dtc, industry "ecommerce"] and Blog /
      // Editorial Series [global-flagship-blog-series-editorial, industry
      // "media"]. They were added to flagshipTemplates.ts after v24 was
      // recorded, so the marker-gated upsert never inserted them and they
      // were missing from the marketplace, the builder Template tab, and the
      // AI "starting point" dropdown. Bumping the marker inserts the two new
      // rows and refreshes every existing global row non-destructively (the
      // ON CONFLICT upsert below preserves tenant title edits).
      // v26: re-home the seed under the dedicated system tenant
      // (slug `__system-templates`) instead of the lowest-id customer tenant.
      // The consolidate step above already moved existing globals there, so
      // bumping the marker refreshes every row in place under its new owner.
      const SEED_MARKER = "global_templates_seed_v28";
      if (!globalsConsolidated) {
        logger.warn("Skipping global_templates seed — consolidation did not complete this boot");
        return;
      }
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${SEED_MARKER}`
      );
      if (marker.rows.length === 0) {
        const { ensureSystemTenant } = await import("./lib/systemTenant");
        const ownerId = await ensureSystemTenant();
        if (!ownerId) {
          logger.warn("Skipping global_templates seed — system tenant unavailable");
        } else {
          const { GLOBAL_TEMPLATE_SEEDS } = await import("./seeds/globalTemplates");
          let upserted = 0;
          for (const tpl of GLOBAL_TEMPLATE_SEEDS) {
            const blocksJson = JSON.stringify(tpl.blocks);
            const result = await db.execute<{ "?column?": number }>(sql`
              INSERT INTO lp_pages (
                tenant_id, title, slug, blocks, status,
                is_template, template_label, template_description,
                is_global, industry, mode, og_image
              ) VALUES (
                ${ownerId}, ${tpl.title}, ${tpl.slug}, ${blocksJson}::jsonb, 'draft',
                true, ${tpl.templateLabel}, ${tpl.templateDescription},
                true, ${tpl.industry}, 'marketing', ${tpl.ogImage}
              )
              ON CONFLICT (tenant_id, slug) DO UPDATE SET
                blocks               = EXCLUDED.blocks,
                template_label       = EXCLUDED.template_label,
                template_description = EXCLUDED.template_description,
                og_image             = EXCLUDED.og_image,
                is_template          = true,
                is_global            = true,
                industry             = EXCLUDED.industry
              RETURNING 1
            `);
            if (result.rows.length > 0) upserted++;
          }
          await db.execute(sql`
            INSERT INTO _schema_migration_markers (key) VALUES (${SEED_MARKER}) ON CONFLICT DO NOTHING
          `);
          logger.info({ upserted, total: GLOBAL_TEMPLATE_SEEDS.length }, "global_templates seed applied");
        }
      }
    } catch (seedErr) {
      logger.error({ err: seedErr }, "global_templates seed failed (non-fatal)");
    }
    });

    // Starter image library seed — image URLs harvested from the global
    // landing-page template seeds. Inserted as shared lp_media rows
    // (tenant_id = NULL, is_shared = true) so every tenant sees them in the
    // "Starter" category of the image picker, mirroring how shared starters
    // uploaded via /api/lp/media/shared/upload work today. Marker-gated so
    // it only runs once per database; bump the version suffix to re-apply.
    // Idempotency is enforced at insert-time via a NOT EXISTS guard on
    // (url, is_shared) — lp_media has no unique index on url, so we can't
    // rely on ON CONFLICT. This makes partial-failure reruns safe: rows
    // already inserted on a prior boot are skipped instead of duplicated.
    await runStep("starter_images seed", async () => {
    try {
      const STARTER_MARKER = "starter_images_seed_v1";
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${STARTER_MARKER}`
      );
      if (marker.rows.length === 0) {
        const { STARTER_IMAGE_SEEDS } = await import("./seeds/starterImages");
        let inserted = 0;
        let skipped = 0;
        for (const img of STARTER_IMAGE_SEEDS) {
          const result = await db.execute<{ "?column?": number }>(sql`
            INSERT INTO lp_media (
              tenant_id, title, url, media_type, mime_type, tags, is_shared
            )
            SELECT
              NULL, ${img.title}, ${img.url}, 'image', 'image/jpeg',
              ${JSON.stringify(img.tags)}::jsonb, true
            WHERE NOT EXISTS (
              SELECT 1 FROM lp_media
              WHERE url = ${img.url} AND is_shared = true
            )
            RETURNING 1
          `);
          if (result.rows.length > 0) inserted++;
          else skipped++;
        }
        await db.execute(sql`
          INSERT INTO _schema_migration_markers (key) VALUES (${STARTER_MARKER}) ON CONFLICT DO NOTHING
        `);
        logger.info(
          { inserted, skipped, total: STARTER_IMAGE_SEEDS.length },
          "starter_images seed applied"
        );
      }
    } catch (seedErr) {
      logger.error({ err: seedErr }, "starter_images seed failed (non-fatal)");
    }
    });

    // Task #1206 — retroactively reserve existing team-member headshots from AI
    // reuse. New saves are tagged in routes/lp/library.ts, but headshots uploaded
    // BEFORE this change are still in the media pool the AI scores. This one-shot
    // pass merges the `team-photo` tag onto every lp_media row whose URL matches a
    // saved `team_member` library item's `content->>'photo'` (tenant-scoped match
    // on tenant_id + url). Idempotent — the `?` guard skips rows already tagged,
    // so even ignoring the marker it is safe to re-run; the marker just makes
    // reboots no-ops. Best-effort: a failure here never aborts the release.
    await runStep("team_photo media backfill", async () => {
    try {
      const TEAM_PHOTO_MARKER = "team_photo_media_backfill_v1";
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${TEAM_PHOTO_MARKER}`
      );
      if (marker.rows.length === 0) {
        const result = await db.execute(sql`
          UPDATE lp_media m
             SET tags = COALESCE(m.tags, '[]'::jsonb) || '["team-photo"]'::jsonb
            FROM lp_library_items li
           WHERE li.type = 'team_member'
             AND li.content ->> 'photo' IS NOT NULL
             AND li.content ->> 'photo' <> ''
             AND m.tenant_id = li.tenant_id
             AND m.url = li.content ->> 'photo'
             AND NOT (COALESCE(m.tags, '[]'::jsonb) ? 'team-photo')
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES (${TEAM_PHOTO_MARKER}) ON CONFLICT DO NOTHING`
        );
        logger.info({ tagged: result.rowCount ?? 0 }, "team_photo media backfill applied");
      }
    } catch (backfillErr) {
      logger.error({ err: backfillErr }, "team_photo media backfill failed (non-fatal)");
    }
    });

    // One-shot, best-effort backfill so existing campaign engagement signals are
    // clearly attributed for EVERY tenant (matches the forward-fixes in the
    // signals + hotlink-tracking routes). Three idempotent passes, each strictly
    // tenant-scoped (no cross-tenant fallback) and non-fatal:
    //   1. Attach contact_id (+ derive account_id) to NULL-contact signals via
    //      an UNAMBIGUOUS tenant-scoped match on metadata.email — only when
    //      exactly one contact in that tenant owns the address, so we never
    //      mis-attribute.
    //   2. Reconcile email-send rows from historical hotlink (microsite)
    //      open/click signals so old campaigns' recipient tables + summary cards
    //      include microsite engagement, not just pixel/direct opens. Guarded by
    //      IS NULL so it never downgrades a stronger state.
    //   3. Replace the opaque "outreach" source with a human-readable label
    //      derived from the signal type so the activity feed never shows a bare
    //      machine token.
    await runStep("sales signal attribution backfill", async () => {
    try {
      const SIGNAL_ATTR_MARKER = "sales_signal_attribution_backfill_v1";
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${SIGNAL_ATTR_MARKER}`
      );
      if (marker.rows.length === 0) {
        const attributed = await db.execute(sql`
          UPDATE sales_signals s
             SET contact_id = m.contact_id,
                 account_id = COALESCE(s.account_id, m.account_id)
            FROM (
              SELECT s2.id AS signal_id,
                     (array_agg(c.id))[1] AS contact_id,
                     (array_agg(c.account_id))[1] AS account_id
                FROM sales_signals s2
                JOIN sales_contacts c
                  ON c.tenant_id = s2.tenant_id
                 AND lower(c.email) = lower(s2.metadata ->> 'email')
               WHERE s2.contact_id IS NULL
                 AND COALESCE(s2.metadata ->> 'email', '') <> ''
               GROUP BY s2.id
              HAVING count(*) = 1
            ) m
           WHERE s.id = m.signal_id
        `);

        const opensReconciled = await db.execute(sql`
          UPDATE sales_email_sends es
             SET status = 'opened',
                 opened_at = COALESCE(es.opened_at, sig.first_open)
            FROM (
              SELECT hotlink_id, min(created_at) AS first_open
                FROM sales_signals
               WHERE type = 'email_open' AND hotlink_id IS NOT NULL
               GROUP BY hotlink_id
            ) sig
           WHERE es.hotlink_id = sig.hotlink_id
             AND es.opened_at IS NULL
             AND es.status NOT IN ('clicked', 'bounced', 'complained')
        `);

        const clicksReconciled = await db.execute(sql`
          UPDATE sales_email_sends es
             SET status = 'clicked',
                 clicked_at = COALESCE(es.clicked_at, sig.first_click),
                 opened_at = COALESCE(es.opened_at, sig.first_click)
            FROM (
              SELECT hotlink_id, min(created_at) AS first_click
                FROM sales_signals
               WHERE type = 'email_click' AND hotlink_id IS NOT NULL
               GROUP BY hotlink_id
            ) sig
           WHERE es.hotlink_id = sig.hotlink_id
             AND es.clicked_at IS NULL
             AND es.status NOT IN ('bounced', 'complained')
        `);

        const sourceRewritten = await db.execute(sql`
          UPDATE sales_signals
             SET source = CASE type
               WHEN 'email_open' THEN 'Opened email'
               WHEN 'email_click' THEN 'Clicked email link'
               WHEN 'email_sent' THEN 'Email sent'
               WHEN 'email_replied' THEN 'Replied to email'
               WHEN 'email_bounced' THEN 'Email bounced'
               WHEN 'email_complained' THEN 'Marked as spam'
               WHEN 'page_view' THEN 'Viewed page'
               WHEN 'form_submit' THEN 'Submitted form'
               WHEN 'link_click' THEN 'Clicked link'
               WHEN 'visitor_identified' THEN 'Identified visitor'
               ELSE 'Engagement'
             END
           WHERE source = 'outreach'
        `);

        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES (${SIGNAL_ATTR_MARKER}) ON CONFLICT DO NOTHING`
        );
        logger.info({
          attributed: attributed.rowCount ?? 0,
          opensReconciled: opensReconciled.rowCount ?? 0,
          clicksReconciled: clicksReconciled.rowCount ?? 0,
          sourceRewritten: sourceRewritten.rowCount ?? 0,
        }, "sales signal attribution backfill applied");
      }
    } catch (backfillErr) {
      logger.error({ err: backfillErr }, "sales signal attribution backfill failed (non-fatal)");
    }
    });

    // Task #641 — seed the root superadmin platform-operator account. This is
    // the single bootstrap account (admin@lpstudio.ai by default, overridable
    // via ROOT_SUPERADMIN_EMAIL) that owns the superadmin roster and can never
    // be demoted/removed. It belongs to NO tenant (tenant_id stays NULL) — it
    // is a platform operator, not a tenant member. Idempotent: the INSERT keys
    // on the unique email and, on conflict, only ensures the role is
    // 'superadmin' (so a fresh DB ends up with EXACTLY one superadmin, and an
    // accidental demotion of the root account self-heals on the next boot). We
    // never null out an existing row's tenant_id on conflict so we don't detach
    // a pre-existing account; on a fresh insert there is no tenant scope by
    // construction. Fails CLOSED: this account is the only way into the
    // superadmin surface on a fresh DB, so a failure here must abort the
    // release rather than ship a database with no operator access.
    await runStep("root superadmin seed", async () => {
      const { getRootSuperadminEmail } = await import("./lib/rootSuperadmin");
      const rootEmail = getRootSuperadminEmail();
      await db.execute(sql`
        INSERT INTO app_users (email, name, role, status, tenant_id)
        VALUES (${rootEmail}, 'LP Studio Root Admin', 'superadmin', 'active', NULL)
        ON CONFLICT (email) DO UPDATE SET role = 'superadmin', updated_at = now()
      `);
      // Verify the invariant we actually care about: a superadmin row exists
      // for this email. We must NOT read an arbitrary row via `rows[0]` — a
      // case-variant collision (e.g. a tenant user who signed up as
      // "Admin@lpstudio.ai" with role 'user') makes a bare
      // `WHERE LOWER(email)=LOWER($1)` return multiple rows in nondeterministic
      // order, which would intermittently abort an otherwise-healthy release.
      // Filtering on role = 'superadmin' + EXISTS keys on the row the INSERT
      // above actually upserts, independent of unrelated collision rows.
      const { rows } = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM app_users
           WHERE LOWER(email) = LOWER($1) AND role = 'superadmin'
         ) AS exists`,
        [rootEmail],
      );
      if (!rows[0]?.exists) {
        throw new Error(
          `root superadmin seed did not produce a superadmin row for ${rootEmail} — aborting release`,
        );
      }
      logger.info({ rootEmail }, "root superadmin seed applied");
    });

    // Migrations 0019 / 0020 / 0022 (sales tenant scoping, Dandy salesConsole
    // seed, DCA proof-point rephrase) used to live here as inline runStep
    // blocks. They are now applied via drizzleMigrate from the tracked
    // .sql files of the same names in lib/db/migrations/ — drizzle's
    // __drizzle_migrations table is the gate now, so they run at most once
    // per database without needing the _schema_migration_markers fallback.
  } catch (err) {
    // Surface a single concise line that names the failing SQL fragment so the
    // failure stands out in the api-server workflow log instead of being buried
    // in a multi-screen drizzle stack trace. The verbose error stays available
    // via the `cause` chain for anyone who needs the full payload.
    const e = err as { message?: string; code?: string; position?: string | number; where?: string; query?: string };
    const fragment = extractSqlFragment(e);
    logger.error(
      `Migration failed — halting server startup: ${e.code ? `[${e.code}] ` : ""}${e.message ?? String(err)}${fragment ? ` — near: ${fragment}` : ""}`,
    );
    throw err;
  }
}

// Best-effort: pull a short snippet of the failing SQL out of a node-postgres
// error envelope. `position` is a 1-based char offset into the original query;
// `where` is Postgres' own context blurb. We prefer the explicit position when
// both are present.
function extractSqlFragment(e: { position?: string | number; where?: string; query?: string }): string {
  const pos = typeof e.position === "string" ? Number(e.position) : e.position;
  if (e.query && pos && Number.isFinite(pos)) {
    const start = Math.max(0, pos - 60);
    const end = Math.min(e.query.length, pos + 60);
    return e.query.slice(start, end).replace(/\s+/g, " ").trim();
  }
  if (e.where) return e.where.replace(/\s+/g, " ").trim().slice(0, 200);
  return "";
}

// Public entry — wraps the migration body in a Postgres advisory lock so two
// processes booting against the same database don't deadlock fighting for
// table-level ACCESS EXCLUSIVE locks during the DDL batch.
async function runMigrations(): Promise<void> {
  return runMigrationsLocked();
}


// CLI entrypoint. Wrap in an async IIFE so we can `await` and translate
// failures to a non-zero exit code; the pool is always closed on the way out
// so the process terminates promptly instead of waiting on idle clients.
async function main(): Promise<void> {
  const started = Date.now();
  logger.info("migrate: starting");
  try {
    await runMigrations();
    logger.info({ elapsedMs: Date.now() - started }, "migrate: complete");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

// Only auto-run when invoked as the CLI entrypoint (e.g. `node dist/migrate.mjs`).
// Importing this module from tests must NOT trigger the full migration batch
// or close the shared pool. Task #442 — the regression test imports
// `acquireMigrationLock` and friends from here directly.
const invokedAsCli =
  typeof process.argv[1] === "string" &&
  /(?:^|[\\/])migrate\.(?:mjs|js|ts|cjs)$/.test(process.argv[1]);
if (invokedAsCli) {
  main().catch((err) => {
    logger.error({ err }, "migrate: failed");
    process.exit(1);
  });
}
