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
  const lockClient = new pg.Client({ connectionString });
  await lockClient.connect();
  try {
    await acquireMigrationLock(lockClient as unknown as LockClient);
    try {
      await runMigrationsBody();
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
    await runStep("notifications schema self-heal (0041)", async () => {
      const notificationsSql = readFileSync(
        path.join(MIGRATIONS_FOLDER, "0041_notifications.sql"),
        "utf8",
      );
      // Use the raw pool with a single string argument so node-postgres runs
      // this through the SIMPLE query protocol, which allows the file's
      // multiple statements in one round-trip. db.execute(sql.raw(...)) would
      // send a params array and force the EXTENDED protocol, which rejects
      // multi-statement SQL ("cannot insert multiple commands into a prepared
      // statement").
      await pool.query(notificationsSql);
      // Post-step assertion: confirm both tables actually exist now. A silent
      // no-op (e.g. the file ever stops creating them) would otherwise pass
      // unnoticed; fail the release loudly instead.
      const { rows } = await pool.query<{ present: number }>(
        `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN ('notification_sends', 'notification_templates')`,
      );
      const present = rows[0]?.present ?? 0;
      if (present < 2) {
        throw new Error(
          `notifications schema self-heal did not produce both tables (found ${present}/2) — aborting release`,
        );
      }
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
    await runStep("workflow_send_failures self-heal (0051)", async () => {
      const sendFailuresSql = readFileSync(
        path.join(MIGRATIONS_FOLDER, "0051_workflow_send_failures.sql"),
        "utf8",
      );
      await pool.query(sendFailuresSql);
      const { rows } = await pool.query<{ present: number }>(
        `SELECT count(*)::int AS present
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'workflow_send_failures'`,
      );
      if ((rows[0]?.present ?? 0) < 1) {
        throw new Error(
          "workflow_send_failures self-heal did not produce the table — aborting release",
        );
      }
    });

    // Durable self-heal for the tenant_email_shells.physical_address column.
    // Same high-water-mark hazard as the notifications/workflow_send_failures
    // self-heals above: on a drifted DB whose drizzle.__drizzle_migrations max
    // created_at already sits ABOVE 0052's journal `when`, the node-postgres
    // migrator records nothing and never runs 0052's DDL, leaving the column
    // missing. Every tenant email footer injects {{physicalAddress}} and the
    // shell resolver SELECTs physical_address, so a missing column 500s the
    // whole tenant email-shell editor + breaks sends. Re-applying the file here
    // is independent of drizzle's dedup and idempotent (ADD COLUMN IF NOT
    // EXISTS), so it adds the column where missing and is a no-op elsewhere. The
    // .sql stays the single source of truth. Fails CLOSED: the column is
    // feature-critical, so any error aborts the release; a retry is always safe.
    await runStep("tenant_email_shells physical_address self-heal (0054)", async () => {
      const physicalAddressSql = readFileSync(
        path.join(MIGRATIONS_FOLDER, "0054_tenant_email_shells_physical_address.sql"),
        "utf8",
      );
      await pool.query(physicalAddressSql);
      const { rows } = await pool.query<{ present: number }>(
        `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tenant_email_shells'
            AND column_name = 'physical_address'`,
      );
      if ((rows[0]?.present ?? 0) < 1) {
        throw new Error(
          "tenant_email_shells physical_address self-heal did not produce the column — aborting release",
        );
      }
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
    await runStep("block_catalog ai_enabled self-heal (0049)", async () => {
      const aiEnabledSql = readFileSync(
        path.join(MIGRATIONS_FOLDER, "0049_block_catalog_ai_enabled.sql"),
        "utf8",
      );
      await pool.query(aiEnabledSql);
      const { rows } = await pool.query<{ present: number }>(
        `SELECT count(*)::int AS present
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'block_catalog'
            AND column_name = 'ai_enabled'`,
      );
      if ((rows[0]?.present ?? 0) < 1) {
        throw new Error(
          "block_catalog ai_enabled self-heal did not produce the column — aborting release",
        );
      }
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

    // Idempotent seed for the global landing-page templates available to all
    // generic-industry tenants. Owned by the lowest-id tenant (Dandy) by
    // default — `is_global=true` makes ownership irrelevant for visibility.
    // Marker-gated so we only attempt once per database.
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
      const SEED_MARKER = "global_templates_seed_v25";
      const marker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = ${SEED_MARKER}`
      );
      if (marker.rows.length === 0) {
        const ownerRow = await db.execute<{ id: number }>(
          sql`SELECT id FROM tenants ORDER BY id ASC LIMIT 1`,
        );
        const ownerId = ownerRow.rows[0]?.id;
        if (!ownerId) {
          logger.warn("Skipping global_templates seed — no tenants exist yet");
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
      const { rows } = await pool.query<{ role: string | null }>(
        `SELECT role FROM app_users WHERE LOWER(email) = LOWER($1)`,
        [rootEmail],
      );
      if (rows[0]?.role !== "superadmin") {
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
