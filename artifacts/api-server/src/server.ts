// Main server entry. dotenv + `initSentry()` are loaded by `src/instrument.ts`
// via Node's `--import` flag (see package.json `start`) BEFORE this module is
// evaluated, so by the time express is imported below, Sentry has already
// hooked the module loader for express/http auto-instrumentation.
import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { invalidateTenantHostCache, WILDCARD_BASE_HOSTS } from "./lib/tenantHosts";
import { sendSlugRedirectExpiryWarning } from "./lib/notifications";
import { startSentryHeartbeat } from "./lib/sentryHeartbeat";
import { setReady } from "./lib/readiness";

const SLUG_REDIRECT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
// Task #152 — warn admins ~7 days before an old workspace URL stops working.
// Run on a daily cadence so a row created at any time of day still gets at
// least one scan inside the warning window before it expires.
const SLUG_REDIRECT_NOTIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SLUG_REDIRECT_NOTIFY_LEAD_DAYS = 7;

async function cleanupExpiredSlugRedirects(): Promise<void> {
  try {
    const result = await pool.query(
      `DELETE FROM tenant_slug_redirects WHERE expires_at < now()`
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info({ deleted: result.rowCount }, "expired tenant_slug_redirects cleaned up");
      invalidateTenantHostCache();
    }
  } catch (err) {
    logger.error({ err }, "tenant_slug_redirects cleanup failed (non-fatal)");
  }
}

type ExpiringRedirectRow = {
  old_slug: string;
  tenant_id: number;
  expires_at: Date;
  tenant_name: string;
  tenant_slug: string;
  tenant_domain: string | null;
};

type AdminRecipientRow = { email: string };

// In-process guard so two overlapping scans (e.g. boot + interval firing
// close together, or a slow scan still running when the next tick fires)
// don't both pick up the same row before notified_at gets stamped.
let slugRedirectNotifyInflight: Promise<void> | null = null;

// Task #152 — find slug redirects that expire inside the warning window and
// haven't been notified yet, email each tenant's admins, then stamp
// notified_at so re-runs are no-ops. Important: notified_at is only set
// AFTER at least one email is successfully accepted by the email provider,
// so a transient send failure doesn't permanently silence the warning.
async function notifyExpiringSlugRedirects(): Promise<void> {
  if (slugRedirectNotifyInflight) return slugRedirectNotifyInflight;
  slugRedirectNotifyInflight = (async () => {
    const baseHost = WILDCARD_BASE_HOSTS.find(h => !h.startsWith("app.")) ?? WILDCARD_BASE_HOSTS[0] ?? null;
    if (!baseHost) {
      logger.warn("notifyExpiringSlugRedirects: no WILDCARD_BASE_HOSTS configured — skipping");
      return;
    }
    let rows: ExpiringRedirectRow[];
    try {
      const result = await pool.query<ExpiringRedirectRow>(
        `SELECT r.old_slug, r.tenant_id, r.expires_at,
                t.name AS tenant_name, t.slug AS tenant_slug, t.domain AS tenant_domain
           FROM tenant_slug_redirects r
           JOIN tenants t ON t.id = r.tenant_id
          WHERE r.notified_at IS NULL
            AND r.expires_at > now()
            AND r.expires_at <= now() + ($1 || ' days')::interval
            AND t.status = 'active'`,
        [String(SLUG_REDIRECT_NOTIFY_LEAD_DAYS)],
      );
      rows = result.rows;
    } catch (err) {
      logger.error({ err }, "notifyExpiringSlugRedirects: query failed (non-fatal)");
      return;
    }
    if (!rows.length) return;

    for (const row of rows) {
      let admins: AdminRecipientRow[];
      try {
        const adminResult = await pool.query<AdminRecipientRow>(
          `SELECT DISTINCT lower(tm.email) AS email
             FROM tenant_members tm
             JOIN tenant_roles tr ON tr.id = tm.role_id
            WHERE tm.tenant_id = $1
              AND tr.is_admin = true
              AND tm.accepted_at IS NOT NULL
              AND tm.email IS NOT NULL AND tm.email <> ''`,
          [row.tenant_id],
        );
        admins = adminResult.rows;
      } catch (err) {
        logger.error({ err, oldSlug: row.old_slug, tenantId: row.tenant_id }, "notifyExpiringSlugRedirects: admin lookup failed");
        continue;
      }
      if (admins.length === 0) {
        // No admins to notify — stamp the row so we don't keep re-querying it
        // every day until it expires. This is also idempotent under concurrent
        // scans because of the WHERE notified_at IS NULL guard.
        await pool.query(
          `UPDATE tenant_slug_redirects SET notified_at = now()
            WHERE old_slug = $1 AND tenant_id = $2 AND notified_at IS NULL`,
          [row.old_slug, row.tenant_id],
        ).catch((err) => logger.error({ err }, "notifyExpiringSlugRedirects: stamp (no-admins) failed"));
        logger.info({ oldSlug: row.old_slug, tenantId: row.tenant_id }, "slug redirect expiry: no admins to notify");
        continue;
      }

      const oldUrl = `https://${row.old_slug}.${baseHost}`;
      const currentUrl = row.tenant_domain
        ? `https://${row.tenant_domain.toLowerCase()}`
        : `https://${row.tenant_slug.toLowerCase()}.${baseHost}`;
      const msUntil = row.expires_at.getTime() - Date.now();
      const daysUntilExpiry = Math.max(1, Math.ceil(msUntil / (24 * 60 * 60 * 1000)));

      // Send in parallel; collect successes so we only stamp notified_at when
      // at least one admin actually got the email. A transient provider
      // failure across all recipients leaves notified_at NULL so tomorrow's
      // scan retries.
      const results = await Promise.all(admins.map(a =>
        sendSlugRedirectExpiryWarning({
          recipientEmail: a.email,
          tenantName: row.tenant_name,
          oldUrl,
          currentUrl,
          expiresAt: row.expires_at,
          daysUntilExpiry,
        }),
      ));
      const sentCount = results.filter(Boolean).length;
      if (sentCount === 0) {
        logger.warn(
          { oldSlug: row.old_slug, tenantId: row.tenant_id, attempted: admins.length },
          "slug redirect expiry: every send failed — will retry on next scan",
        );
        continue;
      }
      try {
        await pool.query(
          `UPDATE tenant_slug_redirects SET notified_at = now()
            WHERE old_slug = $1 AND tenant_id = $2 AND notified_at IS NULL`,
          [row.old_slug, row.tenant_id],
        );
        logger.info(
          { oldSlug: row.old_slug, tenantId: row.tenant_id, sent: sentCount, attempted: admins.length, expiresAt: row.expires_at.toISOString() },
          "slug redirect expiry warning sent",
        );
      } catch (err) {
        logger.error({ err, oldSlug: row.old_slug, tenantId: row.tenant_id }, "notifyExpiringSlugRedirects: stamp failed (email already sent)");
      }
    }
  })().finally(() => { slugRedirectNotifyInflight = null; });
  return slugRedirectNotifyInflight;
}

// Stable 64-bit key for the advisory lock that serializes migration runs
// across processes sharing this database. Picked once and never changed —
// any process running this codebase uses the same key so concurrent boots
// (parallel agent runs, leftover api-server from a prior workflow) wait
// instead of fighting over ACCESS EXCLUSIVE locks during the DDL batch.
const MIGRATION_ADVISORY_LOCK_KEY = "7421894200310042319";

// Task #348 — advisory-lock contention thresholds. The historical
// `pg_advisory_lock(...)` call blocked silently for the entire migration
// timeout (180s in CI) when a previous api-server was killed mid-migration
// and never released its session lock, or when a concurrent boot was
// genuinely slow. Now we poll with `pg_try_advisory_lock`, warn loudly
// after WARN_MS naming the holding PID, and after STEAL_MS either steal
// the lock (in development) or fail with a clear remediation message
// (in production) so the e2e webServer surfaces a real error instead of
// timing out with no signal.
const STALE_LOCK_WARN_MS = 15_000;
const STALE_LOCK_STEAL_MS = 30_000;

// When pg_advisory_lock is called with a single bigint, Postgres stores
// the value split across (classid, objid): classid = high 32 bits,
// objid = low 32 bits. We need these exact two values to filter pg_locks
// to ONLY the migration lock and never touch (or terminate the holders
// of) unrelated advisory locks held by other parts of the system.
const MIGRATION_LOCK_KEY_BIGINT = BigInt(MIGRATION_ADVISORY_LOCK_KEY);
const MIGRATION_LOCK_CLASSID = Number(MIGRATION_LOCK_KEY_BIGINT >> 32n) >>> 0;
const MIGRATION_LOCK_OBJID = Number(MIGRATION_LOCK_KEY_BIGINT & 0xffffffffn) >>> 0;

// Minimal shape — @types/pg isn't reachable from this package, so we
// can't import PoolClient directly. Only the two methods we actually use
// are declared here; the runtime object returned by `pool.connect()` is
// a full pg PoolClient and supports a lot more.
interface LockClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  release(): void;
}

type AdvisoryLockHolder = {
  pid: number;
  classid: number;
  objid: number;
  granted: boolean;
  state: string | null;
  query: string | null;
  backend_start: Date | null;
};

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
              a.state, a.query, a.backend_start
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

async function acquireMigrationLock(lockClient: LockClient): Promise<void> {
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
      const holderPids = holders.filter(h => h.granted).map(h => h.pid);
      const isProduction = process.env.NODE_ENV === "production";
      if (!isProduction && !stealAttempted && holderPids.length > 0) {
        stealAttempted = true;
        logger.warn(
          { holderPids, waitedMs },
          "Stealing stale migration advisory lock — terminating holder backend(s) (NODE_ENV != production)",
        );
        for (const pid of holderPids) {
          await lockClient
            .query(`SELECT pg_terminate_backend($1::int)`, [pid])
            .catch((err) => logger.warn({ err, pid }, "pg_terminate_backend failed (will retry acquire)"));
        }
        // fall through — next loop iteration will retry; terminated backend
        // releases its session-scoped advisory locks immediately.
      } else {
        const pidList = holderPids.length > 0 ? holderPids.join(", ") : "unknown";
        const remediation = holderPids.length > 0
          ? `Run \`SELECT pg_terminate_backend(${holderPids[0]})\` against the dev database to release it, then restart this workflow.`
          : `Check for a stuck api-server process holding the migration lock and restart this workflow.`;
        throw new Error(
          `Migration advisory lock held by PID(s) ${pidList} for ${Math.round(waitedMs / 1000)}s — refusing to wait further. ${remediation}`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function runMigrationsLocked(): Promise<void> {
  // Hold the advisory lock on a dedicated connection for the full DDL run.
  // pg_advisory_lock is session-scoped, so the lock auto-releases if the
  // process crashes — preventing permanently-stuck startups.
  const lockClient = (await pool.connect()) as unknown as LockClient;
  try {
    await acquireMigrationLock(lockClient);
    try {
      await runMigrationsBody();
    } finally {
      await lockClient.query(`SELECT pg_advisory_unlock($1::bigint)`, [MIGRATION_ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
  } finally {
    lockClient.release();
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
    await runStep("core schema DDL batch", async () => {
    await db.execute(sql`
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS region text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS country text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS country_code text;

      CREATE TABLE IF NOT EXISTS lp_page_visits (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        session_id text NOT NULL,
        city text,
        region text,
        country text,
        country_code text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_library_items (
        id serial PRIMARY KEY,
        type text NOT NULL,
        name text NOT NULL DEFAULT '',
        content jsonb NOT NULL DEFAULT '{}',
        is_default boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_library_items_type_idx ON lp_library_items (type);
      ALTER TABLE lp_library_items ADD COLUMN IF NOT EXISTS tenant_id integer;
      -- Task #253 — "Approved for AI" flag (gated by Strict Facts Mode at
      -- generation time). Defaults to TRUE so existing rows stay usable.
      ALTER TABLE lp_library_items ADD COLUMN IF NOT EXISTS approved_for_ai boolean NOT NULL DEFAULT true;

      -- Task #256 — first-class, tenant-scoped proof-point library. One
      -- approved entry can flow through every page and segment that needs
      -- the same number, instead of re-typing it per segment.
      CREATE TABLE IF NOT EXISTS lp_proof_points (
        id              serial PRIMARY KEY,
        tenant_id       integer NOT NULL,
        value           text NOT NULL DEFAULT '',
        label           text NOT NULL DEFAULT '',
        source_url      text NOT NULL DEFAULT '',
        as_of_date      date,
        approved_for_ai boolean NOT NULL DEFAULT true,
        sort_order      integer NOT NULL DEFAULT 0,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_proof_points_tenant_idx ON lp_proof_points (tenant_id);

      CREATE TABLE IF NOT EXISTS lp_block_defaults (
        block_type text PRIMARY KEY,
        props jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lp_block_defaults ADD COLUMN IF NOT EXISTS block_settings jsonb NOT NULL DEFAULT '{}';

      CREATE TABLE IF NOT EXISTS lp_custom_blocks (
        id serial PRIMARY KEY,
        name text NOT NULL DEFAULT 'Untitled Block',
        block_type text NOT NULL DEFAULT 'rich-text',
        props jsonb NOT NULL DEFAULT '{}',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS block_settings jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE lp_custom_blocks ADD COLUMN IF NOT EXISTS segment text NOT NULL DEFAULT 'core';

      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS animations_enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS smooth_scroll boolean NOT NULL DEFAULT true;

      -- Task #208: track brand-import provenance (source URL + timestamp + per-field confidence)
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_source_url text;
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_at timestamptz;
      ALTER TABLE lp_brand_settings ADD COLUMN IF NOT EXISTS brand_import_summary jsonb;

      -- Task #209: per-page ad copy generation history. One row per
      -- generation run; the latest row populates the panel on open and the
      -- "previous runs" dropdown lists older runs for revisit/restore.
      CREATE TABLE IF NOT EXISTS lp_page_ad_copy_runs (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        tenant_id integer NOT NULL,
        input_summary jsonb NOT NULL DEFAULT '{}',
        output jsonb NOT NULL DEFAULT '{}',
        created_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_page_ad_copy_runs_page_idx ON lp_page_ad_copy_runs (page_id);
      CREATE INDEX IF NOT EXISTS lp_page_ad_copy_runs_tenant_idx ON lp_page_ad_copy_runs (tenant_id);
      -- If the table already existed (created in a prior boot) without the FK,
      -- attach it now. The DO block lets us no-op when the constraint is
      -- already in place.
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'lp_page_ad_copy_runs_page_id_fkey'
        ) THEN
          BEGIN
            ALTER TABLE lp_page_ad_copy_runs
              ADD CONSTRAINT lp_page_ad_copy_runs_page_id_fkey
              FOREIGN KEY (page_id) REFERENCES lp_pages(id) ON DELETE CASCADE;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;
      END$$;

      -- Page review workflow (task #108). All columns are nullable; only populated
      -- while a review is in flight or right after a decision is recorded.
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS submitted_by_user_id integer;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_decision_by text;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_decision_at timestamptz;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS last_review_note text;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS asana_task_id text;

      ALTER TABLE lp_media ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';

      CREATE TABLE IF NOT EXISTS lp_brand_presets (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        config jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_leads (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        variant_id integer,
        fields jsonb NOT NULL DEFAULT '{}',
        ip text,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS lp_leads_page_id_idx ON lp_leads (page_id);
      CREATE INDEX IF NOT EXISTS lp_leads_created_at_idx ON lp_leads (created_at);

      CREATE TABLE IF NOT EXISTS lp_form_notifications (
        id serial PRIMARY KEY,
        page_id integer NOT NULL UNIQUE REFERENCES lp_pages(id) ON DELETE CASCADE,
        email_recipients jsonb NOT NULL DEFAULT '[]',
        webhook_url text,
        marketo_config jsonb,
        salesforce_config jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_forms (
        id serial PRIMARY KEY,
        name text NOT NULL,
        description text,
        steps jsonb NOT NULL DEFAULT '[]',
        multi_step boolean NOT NULL DEFAULT false,
        submit_button_text text DEFAULT 'Submit',
        success_message text,
        redirect_url text,
        background_style text DEFAULT 'white',
        email_recipients jsonb NOT NULL DEFAULT '[]',
        webhook_url text,
        marketo_config jsonb,
        salesforce_config jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lp_integrations (
        id serial PRIMARY KEY,
        provider text NOT NULL UNIQUE,
        config jsonb NOT NULL DEFAULT '{}',
        enabled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Smart Traffic
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE lp_tests ADD COLUMN IF NOT EXISTS smart_traffic_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_tests ADD COLUMN IF NOT EXISTS smart_traffic_min_samples integer NOT NULL DEFAULT 100;

      CREATE TABLE IF NOT EXISTS lp_smart_traffic_stats (
        id serial PRIMARY KEY,
        test_id integer NOT NULL REFERENCES lp_tests(id) ON DELETE CASCADE,
        variant_id integer NOT NULL REFERENCES lp_variants(id) ON DELETE CASCADE,
        feature_bucket text NOT NULL DEFAULT 'global',
        successes integer NOT NULL DEFAULT 0,
        failures integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT smart_traffic_stats_unique UNIQUE (test_id, variant_id, feature_bucket)
      );

      CREATE TABLE IF NOT EXISTS lp_heatmap_events (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        session_id text NOT NULL,
        event_type text NOT NULL,
        x_pct real,
        y_pct real,
        block_id text,
        element_tag text,
        scroll_depth_pct real,
        viewport_width integer,
        viewport_height integer,
        device text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      -- ─── DSO tables (dso_ prefix to avoid collisions) ─────────────────────

      CREATE TABLE IF NOT EXISTS dso_microsites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text UNIQUE NOT NULL,
        company_name text NOT NULL,
        briefing_data jsonb NOT NULL DEFAULT '{}',
        tier text,
        skin text NOT NULL DEFAULT 'executive',
        salesforce_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_practice_signups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_slug text NOT NULL,
        company_name text NOT NULL,
        practice_name text NOT NULL,
        contact_name text NOT NULL,
        contact_email text NOT NULL,
        contact_phone text,
        practice_address text,
        num_operatories integer,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_views (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        slug text NOT NULL,
        viewed_at timestamptz NOT NULL DEFAULT now(),
        referrer text,
        user_agent text
      );
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_views_slug ON dso_microsite_views(slug);
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_views_microsite_id ON dso_microsite_views(microsite_id);

      CREATE TABLE IF NOT EXISTS dso_microsite_hotlinks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        recipient_name text NOT NULL,
        token text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE dso_microsite_views
        ADD COLUMN IF NOT EXISTS hotlink_id uuid REFERENCES dso_microsite_hotlinks(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS dso_microsite_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        slug text NOT NULL,
        event_type text NOT NULL,
        event_data jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_dso_microsite_events_microsite_id ON dso_microsite_events(microsite_id);

      CREATE TABLE IF NOT EXISTS dso_microsite_alerts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        alert_type text NOT NULL,
        title text NOT NULL,
        detail jsonb DEFAULT '{}',
        is_read boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_alert_emails (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid NOT NULL REFERENCES dso_microsites(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(microsite_id, email)
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_ab_tests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        skin_key text NOT NULL,
        test_name text NOT NULL,
        content_block text NOT NULL,
        variant_a_label text NOT NULL,
        variant_a_value text NOT NULL,
        variant_b_label text NOT NULL,
        variant_b_value text NOT NULL,
        success_metric text NOT NULL DEFAULT 'views',
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS dso_microsite_ab_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id uuid NOT NULL REFERENCES dso_microsite_ab_tests(id) ON DELETE CASCADE,
        variant text NOT NULL,
        event_type text NOT NULL,
        time_on_page_seconds numeric,
        visitor_id text,
        microsite_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_target_contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        salesforce_id text,
        parent_company text NOT NULL DEFAULT '',
        first_name text,
        last_name text,
        title text,
        title_level text,
        department text,
        contact_role text,
        email text,
        phone text,
        linkedin_url text,
        gender text,
        dso_size text,
        pe_firm text,
        created_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dso_target_contacts_email ON dso_target_contacts (LOWER(email)) WHERE email IS NOT NULL AND email != '';

      CREATE TABLE IF NOT EXISTS dso_email_lists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_list_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id uuid NOT NULL REFERENCES dso_email_lists(id) ON DELETE CASCADE,
        contact_id uuid NOT NULL REFERENCES dso_target_contacts(id) ON DELETE CASCADE,
        added_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (list_id, contact_id)
      );

      CREATE TABLE IF NOT EXISTS dso_marketing_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        subject text NOT NULL,
        html_body text,
        plain_body text,
        format text NOT NULL DEFAULT 'plain',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        list_id uuid REFERENCES dso_email_lists(id),
        template_id uuid REFERENCES dso_marketing_templates(id),
        template_b_id uuid REFERENCES dso_marketing_templates(id),
        status text NOT NULL DEFAULT 'draft',
        utm_source text DEFAULT 'dandy_dso',
        utm_medium text DEFAULT 'email',
        utm_campaign text,
        utm_content text,
        sender_name text NOT NULL DEFAULT 'Dandy DSO Partnerships',
        sender_email text NOT NULL DEFAULT 'partnerships',
        reply_to_email text NOT NULL DEFAULT 'sales@meetdandy.com',
        ab_test_enabled boolean NOT NULL DEFAULT false,
        scheduled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_email_campaign_sends (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id uuid NOT NULL REFERENCES dso_email_campaigns(id) ON DELETE CASCADE,
        contact_id uuid REFERENCES dso_target_contacts(id),
        recipient_email text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        sent_at timestamptz,
        opened_at timestamptz,
        clicked_at timestamptz,
        variant text
      );

      CREATE TABLE IF NOT EXISTS dso_email_outreach_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        microsite_id uuid REFERENCES dso_microsites(id) ON DELETE SET NULL,
        hotlink_id uuid REFERENCES dso_microsite_hotlinks(id) ON DELETE SET NULL,
        contact_id uuid REFERENCES dso_target_contacts(id) ON DELETE SET NULL,
        recipient_email text NOT NULL,
        recipient_name text NOT NULL,
        subject text,
        sent_at timestamptz NOT NULL DEFAULT now(),
        opened_at timestamptz,
        clicked_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS dso_email_unsubscribes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_suppressed_emails (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        reason text NOT NULL DEFAULT 'bounce',
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_layout_defaults (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key text NOT NULL UNIQUE,
        config jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_custom_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        background_url text NOT NULL DEFAULT '',
        orientation text NOT NULL DEFAULT 'portrait',
        fields jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_pdf_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dso_name text NOT NULL,
        practice_count integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS dso_cta_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        first_name text,
        last_name text,
        company_name text,
        source text,
        microsite_id uuid REFERENCES dso_microsites(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS first_name text;
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS last_name text;
      ALTER TABLE dso_cta_submissions ADD COLUMN IF NOT EXISTS company_name text;
      CREATE INDEX IF NOT EXISTS idx_dso_cta_submissions_email ON dso_cta_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_dso_cta_submissions_created_at ON dso_cta_submissions(created_at DESC);

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_view()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        site_name text;
        hl_name text;
      BEGIN
        SELECT company_name INTO site_name FROM dso_microsites WHERE id = NEW.microsite_id;
        IF NEW.hotlink_id IS NOT NULL THEN
          SELECT recipient_name INTO hl_name FROM dso_microsite_hotlinks WHERE id = NEW.hotlink_id;
        END IF;
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        VALUES (
          NEW.microsite_id,
          CASE WHEN NEW.hotlink_id IS NOT NULL THEN 'hotlink_visit' ELSE 'page_visit' END,
          CASE WHEN hl_name IS NOT NULL THEN hl_name || ' visited ' || COALESCE(site_name, 'a microsite')
               ELSE 'New visit on ' || COALESCE(site_name, 'a microsite') END,
          jsonb_build_object('slug', NEW.slug, 'recipient_name', hl_name, 'referrer', NEW.referrer)
        );
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_view ON dso_microsite_views;
      CREATE TRIGGER trg_dso_alert_on_view AFTER INSERT ON dso_microsite_views
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_view();

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_event()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        site_name text;
      BEGIN
        IF NEW.event_type <> 'cta_click' THEN RETURN NEW; END IF;
        SELECT company_name INTO site_name FROM dso_microsites WHERE id = NEW.microsite_id;
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        VALUES (
          NEW.microsite_id, 'cta_click',
          'CTA clicked on ' || COALESCE(site_name, 'a microsite'),
          COALESCE(NEW.event_data, '{}')
        );
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_event ON dso_microsite_events;
      CREATE TRIGGER trg_dso_alert_on_event AFTER INSERT ON dso_microsite_events
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_event();

      CREATE OR REPLACE FUNCTION fn_dso_alert_on_signup()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO dso_microsite_alerts (microsite_id, alert_type, title, detail)
        SELECT m.id, 'practice_signup',
          NEW.contact_name || ' signed up from ' || NEW.company_name,
          jsonb_build_object('practice_name', NEW.practice_name, 'contact_email', NEW.contact_email, 'contact_name', NEW.contact_name)
        FROM dso_microsites m WHERE m.slug = NEW.microsite_slug
        LIMIT 1;
        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_dso_alert_on_signup ON dso_practice_signups;
      CREATE TRIGGER trg_dso_alert_on_signup AFTER INSERT ON dso_practice_signups
      FOR EACH ROW EXECUTE FUNCTION fn_dso_alert_on_signup();

      -- Additional columns added post-initial migration
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS abm_stage text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS website text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS city text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS state text;
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS country text DEFAULT 'United States';
      ALTER TABLE dso_target_contacts ADD COLUMN IF NOT EXISTS segment text;
      ALTER TABLE dso_email_outreach_log ADD COLUMN IF NOT EXISTS salesforce_id text;
      CREATE INDEX IF NOT EXISTS idx_dso_email_outreach_log_sfdc ON dso_email_outreach_log(salesforce_id) WHERE salesforce_id IS NOT NULL;
      ALTER TABLE dso_microsites ADD COLUMN IF NOT EXISTS abm_stage text;
      ALTER TABLE dso_microsites ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

      -- Personalized links for LP Studio pages
      CREATE TABLE IF NOT EXISTS lp_personalized_links (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        contact_name text NOT NULL,
        company text,
        email text,
        token text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_lp_personalized_links_page ON lp_personalized_links(page_id);
      CREATE INDEX IF NOT EXISTS idx_lp_personalized_links_token ON lp_personalized_links(token);

      CREATE TABLE IF NOT EXISTS lp_personalized_link_visits (
        id serial PRIMARY KEY,
        link_id integer NOT NULL REFERENCES lp_personalized_links(id) ON DELETE CASCADE,
        ip text,
        city text,
        region text,
        country text,
        scroll_depth_pct real,
        cta_clicks integer NOT NULL DEFAULT 0,
        visited_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_lp_pl_visits_link ON lp_personalized_link_visits(link_id);

      CREATE TABLE IF NOT EXISTS lp_page_alert_emails (
        id serial PRIMARY KEY,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        email text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(page_id, email)
      );
      CREATE INDEX IF NOT EXISTS idx_lp_page_alert_emails_page ON lp_page_alert_emails(page_id);

      -- LP Studio page variables (personalization tokens)
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS page_variables jsonb DEFAULT '{}';

      -- Sales Console tables
      CREATE TABLE IF NOT EXISTS sales_accounts (
        id serial PRIMARY KEY,
        name text NOT NULL,
        domain text,
        industry text,
        segment text,
        parent_account_id integer,
        status text NOT NULL DEFAULT 'prospect',
        owner text,
        notes text,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sales_contacts (
        id serial PRIMARY KEY,
        account_id integer NOT NULL REFERENCES sales_accounts(id) ON DELETE CASCADE,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        title text,
        role text,
        phone text,
        status text NOT NULL DEFAULT 'active',
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_contacts_account ON sales_contacts(account_id);

      CREATE TABLE IF NOT EXISTS sales_signals (
        id serial PRIMARY KEY,
        account_id integer REFERENCES sales_accounts(id) ON DELETE CASCADE,
        contact_id integer,
        hotlink_id integer,
        type text NOT NULL,
        source text,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_signals_account ON sales_signals(account_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_created ON sales_signals(created_at DESC);

      CREATE TABLE IF NOT EXISTS sales_hotlinks (
        id serial PRIMARY KEY,
        token text NOT NULL UNIQUE,
        contact_id integer NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
        page_id integer NOT NULL REFERENCES lp_pages(id) ON DELETE CASCADE,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_token ON sales_hotlinks(token);

      CREATE TABLE IF NOT EXISTS sales_email_templates (
        id serial PRIMARY KEY,
        name text NOT NULL,
        subject text NOT NULL,
        body_html text NOT NULL,
        body_text text,
        merge_vars jsonb DEFAULT '[]',
        category text DEFAULT 'general',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      ALTER TABLE sales_email_templates ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'plain';

      CREATE TABLE IF NOT EXISTS sales_email_campaigns (
        id serial PRIMARY KEY,
        name text NOT NULL,
        -- template_id is nullable: draft campaigns are created without a
        -- template and a template is picked later in the campaign editor.
        -- Only "scheduled"/"sending"/"sent" campaigns must have one (enforced
        -- in the POST /sales/campaigns route).
        template_id integer REFERENCES sales_email_templates(id),
        account_id integer REFERENCES sales_accounts(id),
        status text NOT NULL DEFAULT 'draft',
        scheduled_at timestamptz,
        sent_at timestamptz,
        recipient_count integer DEFAULT 0,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      -- Existing prod tables were created with template_id NOT NULL, which
      -- breaks "New Campaign" (draft campaigns intentionally start without
      -- a template). CREATE TABLE IF NOT EXISTS skips the new definition
      -- above on existing databases, so we drop the constraint explicitly
      -- here. Safe to run repeatedly.
      ALTER TABLE sales_email_campaigns ALTER COLUMN template_id DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS sales_email_sends (
        id serial PRIMARY KEY,
        campaign_id integer REFERENCES sales_email_campaigns(id) ON DELETE CASCADE,
        contact_id integer NOT NULL,
        hotlink_id integer,
        email text NOT NULL,
        status text NOT NULL DEFAULT 'queued',
        sent_at timestamptz,
        opened_at timestamptz,
        clicked_at timestamptz,
        bounced_at timestamptz,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_email_sends_campaign ON sales_email_sends(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_sales_email_sends_contact ON sales_email_sends(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_contact ON sales_hotlinks(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_hotlinks_page ON sales_hotlinks(page_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_contact ON sales_signals(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_signals_type ON sales_signals(type);

      CREATE TABLE IF NOT EXISTS sales_inbound_emails (
        id serial PRIMARY KEY,
        contact_id integer,
        account_id integer,
        message_id text,
        in_reply_to text,
        from_email text NOT NULL,
        from_name text,
        to_email text NOT NULL,
        subject text,
        body_text text,
        body_html text,
        is_read text NOT NULL DEFAULT 'false',
        metadata jsonb DEFAULT '{}',
        received_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_inbound_contact ON sales_inbound_emails(contact_id);
      CREATE INDEX IF NOT EXISTS idx_sales_inbound_received ON sales_inbound_emails(received_at DESC);

      -- Sales one-pager custom templates
      CREATE TABLE IF NOT EXISTS sales_one_pager_templates (
        id serial PRIMARY KEY,
        tenant_id integer NOT NULL,
        name text NOT NULL,
        background_url text NOT NULL DEFAULT '',
        orientation text NOT NULL DEFAULT 'portrait',
        fields jsonb NOT NULL DEFAULT '[]',
        header_height integer NOT NULL DEFAULT 30,
        header_image_url text,
        is_deleted boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_sales_one_pager_templates_tenant ON sales_one_pager_templates(tenant_id);

      -- UTM tracking columns on sessions and page visits
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_content text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_content text;
      CREATE INDEX IF NOT EXISTS lp_sessions_utm_source_idx ON lp_sessions (utm_source) WHERE utm_source IS NOT NULL;
      CREATE INDEX IF NOT EXISTS lp_page_visits_utm_source_idx ON lp_page_visits (utm_source) WHERE utm_source IS NOT NULL;

      -- UTM tracking columns on leads (for SFDC attribution)
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_source text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_medium text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_campaign text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_term text;
      ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_content text;

      -- Schema migration marker table (used to run one-time data migrations safely)
      CREATE TABLE IF NOT EXISTS _schema_migration_markers (
        key text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );

      -- Short-lived exchange codes for cross-domain session handoff (prevents tokens in URLs)
      CREATE TABLE IF NOT EXISTS auth_exchange_codes (
        code text PRIMARY KEY,
        sid text NOT NULL REFERENCES app_sessions(sid) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_exchange_codes_expires ON auth_exchange_codes(expires_at);

      -- Tenant onboarding tracking
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
      -- Task #134 — gate the post-onboarding welcome email so it fires once per tenant
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

      -- Global landing-page templates (cross-tenant template library, scoped by industry)
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS industry text;

      -- One-time backfill: mark all tenants that existed BEFORE the onboarding wizard was
      -- introduced as already onboarded so they never see the wizard. This block only runs
      -- once (guarded by the migration marker) so new tenants created after deployment keep
      -- NULL until they complete the wizard themselves.
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM _schema_migration_markers WHERE key = 'onboarding_backfill_v1'
        ) THEN
          UPDATE tenants SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;
          INSERT INTO _schema_migration_markers (key) VALUES ('onboarding_backfill_v1');
        END IF;
      END;
      $$;

      -- Task #133 — slug rename redirects. Each row maps an old (renamed)
      -- slug back to its tenant for a limited window so existing bookmarks
      -- to <oldslug>.lpstudio.ai keep working.
      CREATE TABLE IF NOT EXISTS tenant_slug_redirects (
        old_slug      text PRIMARY KEY,
        tenant_id     integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        expires_at    timestamptz NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tenant_slug_redirects_tenant_id_idx
        ON tenant_slug_redirects (tenant_id);
      CREATE INDEX IF NOT EXISTS tenant_slug_redirects_expires_at_idx
        ON tenant_slug_redirects (expires_at);

      -- Task #152 — track when admins were warned that a slug redirect
      -- is about to expire so the warning job stays idempotent (each
      -- redirect notified at most once).
      ALTER TABLE tenant_slug_redirects
        ADD COLUMN IF NOT EXISTS notified_at timestamptz;

      -- Task #147 — per-tenant inbound webhook secrets. The public webhook
      -- endpoints (/webhooks/rb2b, /webhooks/apollo, /webhooks/letterdrop)
      -- now embed a per-tenant secret in the URL so signals route to the
      -- correct tenant instead of being hardcoded to Dandy (#1).
      CREATE TABLE IF NOT EXISTS tenant_webhook_secrets (
        id            serial PRIMARY KEY,
        tenant_id     integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        integration   text NOT NULL,
        secret        text NOT NULL UNIQUE,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tenant_webhook_secrets_tenant_integration_idx
        ON tenant_webhook_secrets (tenant_id, integration);
      CREATE INDEX IF NOT EXISTS tenant_webhook_secrets_secret_idx
        ON tenant_webhook_secrets (secret);

      -- Task #146 / #236 — explicit tenant_id on sales_briefings, sfdc_opportunities,
      -- and sfdc_leads. The corresponding migration file
      -- (lib/db/migrations/0009_sales_sfdc_tenant_id.sql) was renumbered on
      -- 2026-05-10, which left the prod __drizzle_migrations row pointing at
      -- the OLD content under hash 0009 — so the renumbered file was never
      -- replayed on Neon prod. Result: every read of sales_briefings 500s,
      -- which kills the AI account briefing endpoint and the AI microsite
      -- generator (which reads the briefing first).
      --
      -- This block heals prod on the next deploy. It mirrors the migration's
      -- backfill strategy, but expressed idempotently so it's safe on every
      -- boot (matches how the rest of this file already handles structural
      -- changes against Neon).
      ALTER TABLE sales_briefings    ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE sfdc_opportunities ADD COLUMN IF NOT EXISTS tenant_id integer;
      ALTER TABLE sfdc_leads         ADD COLUMN IF NOT EXISTS tenant_id integer;

      -- Backfill: prefer the parent's tenant_id; fall back to tenant 1 only
      -- if the parent vanished (the FK is ON DELETE CASCADE so this should
      -- be a no-op in practice).
      UPDATE sales_briefings sb
      SET tenant_id = sa.tenant_id
      FROM sales_accounts sa
      WHERE sb.account_id = sa.id AND sb.tenant_id IS NULL;
      UPDATE sales_briefings SET tenant_id = 1 WHERE tenant_id IS NULL;

      UPDATE sfdc_opportunities so
      SET tenant_id = sa.tenant_id
      FROM sales_accounts sa
      WHERE so.account_id = sa.id AND so.tenant_id IS NULL;
      -- Opportunities without an account row: pin to the unique sfdc_connection
      -- tenant if there's exactly one, else tenant 1.
      UPDATE sfdc_opportunities
      SET tenant_id = COALESCE(
        (SELECT tenant_id FROM sfdc_connections WHERE tenant_id IS NOT NULL
           GROUP BY tenant_id
           HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
           LIMIT 1),
        1)
      WHERE tenant_id IS NULL;

      -- Leads have no FK path to a connection in the schema today; same
      -- single-connection-or-tenant-1 fallback as the migration file.
      UPDATE sfdc_leads
      SET tenant_id = COALESCE(
        (SELECT tenant_id FROM sfdc_connections WHERE tenant_id IS NOT NULL
           GROUP BY tenant_id
           HAVING COUNT(*) = (SELECT COUNT(*) FROM sfdc_connections WHERE tenant_id IS NOT NULL)
           LIMIT 1),
        1)
      WHERE tenant_id IS NULL;

      -- Flip to NOT NULL only if it's still nullable (re-runs are no-ops).
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sales_briefings' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sales_briefings ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sfdc_opportunities' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sfdc_opportunities ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='sfdc_leads' AND column_name='tenant_id' AND is_nullable='YES') THEN
          ALTER TABLE sfdc_leads ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
      END
      $$;

      -- Add FK constraint only if missing (ADD CONSTRAINT itself is not idempotent).
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_briefings_tenant_id_fkey') THEN
          ALTER TABLE sales_briefings
            ADD CONSTRAINT sales_briefings_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sfdc_opportunities_tenant_id_fkey') THEN
          ALTER TABLE sfdc_opportunities
            ADD CONSTRAINT sfdc_opportunities_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sfdc_leads_tenant_id_fkey') THEN
          ALTER TABLE sfdc_leads
            ADD CONSTRAINT sfdc_leads_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
      END
      $$;

      CREATE INDEX IF NOT EXISTS idx_sales_briefings_tenant_id    ON sales_briefings    (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sfdc_opportunities_tenant_id ON sfdc_opportunities (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_sfdc_leads_tenant_id         ON sfdc_leads         (tenant_id);

      -- Per-contact AI call-prep briefs (mirrors sales_briefings but per
      -- person). Persists the markdown brief produced by /api/sales/person-brief
      -- so the contact-detail page can show yesterday's research without
      -- regenerating. See lib/db/migrations/0016_sales_contact_briefings.sql.
      CREATE TABLE IF NOT EXISTS sales_contact_briefings (
        id          serial PRIMARY KEY,
        tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        contact_id  integer NOT NULL REFERENCES sales_contacts(id) ON DELETE CASCADE,
        brief_text  text NOT NULL DEFAULT '',
        status      text NOT NULL DEFAULT 'complete',
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX        IF NOT EXISTS idx_sales_contact_briefings_tenant_id     ON sales_contact_briefings (tenant_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_contact_briefings_tenant_contact ON sales_contact_briefings (tenant_id, contact_id);

      -- Task #300 — follow-up email to form submitter (global forms + per-page overrides).
      ALTER TABLE lp_forms              ADD COLUMN IF NOT EXISTS send_follow_up_to_submitter boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_forms              ADD COLUMN IF NOT EXISTS follow_up_template_id       integer REFERENCES sales_email_templates(id) ON DELETE SET NULL;
      ALTER TABLE lp_form_notifications ADD COLUMN IF NOT EXISTS send_follow_up_to_submitter boolean NOT NULL DEFAULT false;
      ALTER TABLE lp_form_notifications ADD COLUMN IF NOT EXISTS follow_up_template_id       integer REFERENCES sales_email_templates(id) ON DELETE SET NULL;
    `);
    });
    logger.info("Migrations applied successfully");

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

    // Idempotent first-boot seed for the block_catalog table. Safe to run on
    // every boot — uses ON CONFLICT DO NOTHING so admin edits are never
    // clobbered. Adds rows only when missing.
    await runStep("block_catalog seed", async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS block_catalog (
          block_type    text NOT NULL,
          industry      text NOT NULL,
          label         text NOT NULL,
          category      text NOT NULL,
          default_props jsonb NOT NULL DEFAULT '{}'::jsonb,
          is_enabled    boolean NOT NULL DEFAULT true,
          sort_order    integer NOT NULL DEFAULT 0,
          updated_by    integer,
          created_at    timestamptz NOT NULL DEFAULT now(),
          updated_at    timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (block_type, industry)
        );
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS block_catalog_industry_idx ON block_catalog(industry);`);
      // Backfill `updated_by` on databases whose block_catalog was created
      // before that column existed in the CREATE TABLE above. CREATE TABLE
      // IF NOT EXISTS is a no-op for an existing table, so without this
      // ALTER the superadmin GET /admin/block-catalog (which selects
      // updated_by) would 500 with `column "updated_by" does not exist`.
      await db.execute(sql`ALTER TABLE block_catalog ADD COLUMN IF NOT EXISTS updated_by integer;`);
      // Marker table so we only attempt the heavyweight seed once, even though
      // the inserts themselves are idempotent — keeps boot time low.
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS _schema_migration_markers (key text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      `);
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
      const SEED_MARKER = "global_templates_seed_v21";
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

    // ─── Migration 0019: tenant_id on sales_hotlinks + sales_inbound_emails ──
    // Idempotent. Backfills from related rows, then enforces NOT NULL on
    // sales_hotlinks (sales_inbound_emails stays nullable so webhook
    // deliveries that fail tenant resolution still insert).
    await runStep("migration 0019: tenant_id on sales_hotlinks + sales_inbound_emails", async () => {
    await db.execute(sql`
      ALTER TABLE "sales_hotlinks"
        ADD COLUMN IF NOT EXISTS "tenant_id" integer;
    `);
    await db.execute(sql`
      UPDATE "sales_hotlinks" h
         SET "tenant_id" = p."tenant_id"
        FROM "lp_pages" p
       WHERE h."page_id" = p."id"
         AND h."tenant_id" IS NULL;
    `);
    await db.execute(sql`
      UPDATE "sales_hotlinks" h
         SET "tenant_id" = c."tenant_id"
        FROM "sales_contacts" c
       WHERE h."contact_id" = c."id"
         AND h."tenant_id" IS NULL;
    `);
    await db.execute(sql`
      UPDATE "sales_hotlinks" SET "tenant_id" = 1 WHERE "tenant_id" IS NULL;
    `);
    await db.execute(sql`
      ALTER TABLE "sales_hotlinks" ALTER COLUMN "tenant_id" SET NOT NULL;
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sales_hotlinks_tenant_id_idx"
        ON "sales_hotlinks" ("tenant_id");
    `);
    await db.execute(sql`
      ALTER TABLE "sales_inbound_emails"
        ADD COLUMN IF NOT EXISTS "tenant_id" integer;
    `);
    await db.execute(sql`
      UPDATE "sales_inbound_emails" e
         SET "tenant_id" = c."tenant_id"
        FROM "sales_contacts" c
       WHERE e."contact_id" = c."id"
         AND e."tenant_id" IS NULL;
    `);
    // Marker-gated one-time backfill of legacy unmatched rows to tenant 1.
    // Without this gate, every cold start would silently reassign newly
    // arrived webhook rows (intentionally inserted with NULL when tenant
    // resolution fails) to tenant 1 — exposing unrouted mail to Dandy.
    {
      const { rows: marker } = await pool.query(
        `SELECT 1 FROM _schema_migration_markers WHERE key = 'inbound_tenant_backfill_v1'`,
      );
      if (marker.length === 0) {
        await db.execute(sql`
          UPDATE "sales_inbound_emails" SET "tenant_id" = 1 WHERE "tenant_id" IS NULL;
        `);
        await db.execute(sql`
          INSERT INTO _schema_migration_markers (key) VALUES ('inbound_tenant_backfill_v1')
            ON CONFLICT DO NOTHING
        `);
      }
    }
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "sales_inbound_emails_tenant_id_idx"
        ON "sales_inbound_emails" ("tenant_id");
    `);
    });

    // ─── Migration 0020: seed Dandy (tenant 1) salesConsole config ──────────
    // Idempotent via the `salesConsole` key existence check, so re-runs
    // won't clobber edits Dandy makes through the new Brand Settings UI.
    await runStep("migration 0020: dandy salesConsole config seed", async () => {
    await db.execute(sql`
      DO $$
      DECLARE
        existing_config jsonb;
        has_sales_console boolean;
      BEGIN
        SELECT config INTO existing_config
          FROM lp_brand_settings WHERE tenant_id = 1 LIMIT 1;

        IF existing_config IS NULL THEN
          -- No brand_settings row yet — insert with empty config so the
          -- jsonb_set below can populate salesConsole on the same pass.
          INSERT INTO lp_brand_settings (tenant_id, config)
          VALUES (1, '{}'::jsonb);
          existing_config := '{}'::jsonb;
        END IF;

        has_sales_console := existing_config ? 'salesConsole';

        IF NOT has_sales_console THEN
          UPDATE lp_brand_settings
             SET config = jsonb_set(
                   config,
                   '{salesConsole}',
                   jsonb_build_object(
                     'senderName',       'Dandy',
                     'senderLocalPart',  'partnerships',
                     'sendingDomain',    'ent.meetdandy.com',
                     'replyTo',          'sales@meetdandy.com',
                     'notificationsLocalPart', 'notifications',
                     'emailSignature',   '',
                     'emailFooter',      '',
                     'salesIntroLine',   'You write short, human cold emails for Dandy — a vertically integrated dental lab and clinical performance platform for DSOs.',
                     'briefBlurb',       '(a dental lab and clinical performance platform for DSOs)',
                     'useBuiltInExemplars', true,
                     'valuePropPairs', jsonb_build_array(
                       jsonb_build_object('role','CFO / Finance','theme','Remakes are silently destroying margin',
                         'pain','remakes cost ~$780 each and most DSOs can''t even track them across locations',
                         'proof','Apex Dental Partners cut remakes by 29% after switching to Dandy'),
                       jsonb_build_object('role','CFO / Finance','theme','Scanner CAPEX is an unnecessary barrier',
                         'pain','$40–75K per operatory in scanner hardware is hard to justify when margins are tight',
                         'proof','Dandy deploys scanners free — zero CAPEX'),
                       jsonb_build_object('role','COO / Operations','theme','Too many lab vendors means no control',
                         'pain','when every location picks its own lab, you get inconsistent quality, no leverage on pricing, and no visibility',
                         'proof','DCA consolidated 400+ lab relationships through a strategic partnership with Dandy'),
                       jsonb_build_object('role','COO / Operations','theme','Standardization shouldn''t mean forcing doctors to switch',
                         'pain','ops teams need consistency across locations, but mandating a single workflow alienates doctors',
                         'proof','Dandy''s preferred program standardizes the lab without requiring doctors to change their process'),
                       jsonb_build_object('role','CDO / Clinical','theme','Remakes are a clinical quality problem hiding in plain sight',
                         'pain','most DSOs don''t have location-level remake data, so quality issues go undetected',
                         'proof','DCA practices hit ~1% remake rate with Dandy''s standardized workflow'),
                       jsonb_build_object('role','CDO / Clinical','theme','Catching fit issues before they ship',
                         'pain','bad margins and fit problems only surface after the patient is in the chair — costly for the practice and the patient',
                         'proof','Dandy''s AI margin detection flags fit issues before the crown ships'),
                       jsonb_build_object('role','CEO / President','theme','Same-store growth is the next lever',
                         'pain','acquisitions slow down eventually and same-store performance becomes the primary growth engine',
                         'proof','Apex Dental Partners saw a 12.5% revenue increase with Dandy'),
                       jsonb_build_object('role','CEO / President','theme','Scale without capital risk',
                         'pain','growth requires scanners at every operatory, but $40–75K per site adds up fast',
                         'proof','Dandy deploys free scanners — no capital risk to start'),
                       jsonb_build_object('role','Growth / M&A','theme','Post-acquisition integration shouldn''t break the lab',
                         'pain','every acquisition brings a new lab vendor, new workflows, and new quality standards to normalize',
                         'proof','Dandy scales from 10 to 200+ locations on one platform'),
                       jsonb_build_object('role','IT / Technology / Systems','theme','One fewer vendor to procure and manage',
                         'pain','IT has to spec, procure, and support scanner hardware at every location — it doesn''t scale',
                         'proof','DCA deployed 100 free scanners through Dandy — no hardware procurement for IT')
                     )
                   ),
                   true
                 )
           WHERE tenant_id = 1;
        END IF;
      END $$;
    `);
    });

    // ─── Migration 0022: rephrase one Dandy proof-point legal disallows ─────
    // "DCA consolidated 400+ lab relationships down to one with Dandy"  →
    // "DCA consolidated 400+ lab relationships through a strategic
    //  partnership with Dandy". Marker-gated so this only runs once and
    //  doesn't clobber later admin edits.
    await runStep("migration 0022: DCA proof-point rephrase", async () => {
    try {
      const dcaProofMarker = await db.execute<{ exists: number }>(
        sql`SELECT 1 AS exists FROM _schema_migration_markers WHERE key = 'dca_consolidation_proof_rephrase_v1'`
      );
      if (dcaProofMarker.rows.length === 0) {
        await db.execute(sql`
          DO $$
          DECLARE
            pairs jsonb;
            updated jsonb;
          BEGIN
            SELECT config->'salesConsole'->'valuePropPairs'
              INTO pairs
              FROM lp_brand_settings
             WHERE tenant_id = 1;

            IF pairs IS NULL OR jsonb_typeof(pairs) <> 'array' THEN
              RETURN;
            END IF;

            SELECT jsonb_agg(
                     CASE
                       WHEN p->>'proof' = 'DCA consolidated 400+ lab relationships down to one with Dandy'
                         THEN jsonb_set(p, '{proof}', to_jsonb('DCA consolidated 400+ lab relationships through a strategic partnership with Dandy'::text))
                       ELSE p
                     END
                   )
              INTO updated
              FROM jsonb_array_elements(pairs) p;

            IF updated IS DISTINCT FROM pairs THEN
              UPDATE lp_brand_settings
                 SET config = jsonb_set(config, '{salesConsole,valuePropPairs}', updated, true)
               WHERE tenant_id = 1;
            END IF;
          END $$;
        `);
        await db.execute(
          sql`INSERT INTO _schema_migration_markers (key) VALUES ('dca_consolidation_proof_rephrase_v1') ON CONFLICT DO NOTHING`
        );
        logger.info("DCA consolidation proof-point rephrase applied");
      }
    } catch (rephraseErr) {
      logger.error({ err: rephraseErr }, "DCA proof rephrase failed (non-fatal)");
    }
    });
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

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Bind the port FIRST so deployment health probes (Replit autoscale waits
// ~60s for the artifact port to open) succeed even on cold starts where the
// idempotent migration/backfill batch in runMigrations() can take longer
// than that window. The /api router is gated by lib/readiness.isReady()
// (see app.ts) so we won't serve real traffic against a half-migrated
// schema — clients get a retryable 503 with `Retry-After: 2` until
// setReady() flips below.
const httpServer = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening (warming up — migrations in progress)");
});

runMigrations()
  .then(() => {
    setReady();
    logger.info("Migrations complete — API ready");

    // Periodic cleanup of expired workspace URL redirects (task #136).
    // Runs once at boot and then on a fixed interval. Failures are logged
    // but never crash the server.
    void cleanupExpiredSlugRedirects();
    setInterval(() => {
      void cleanupExpiredSlugRedirects();
    }, SLUG_REDIRECT_CLEANUP_INTERVAL_MS).unref();

    // Task #152 — daily scan for slug redirects about to expire so admins
    // get a heads-up email before their old URL stops working.
    void notifyExpiringSlugRedirects();
    setInterval(() => {
      void notifyExpiringSlugRedirects();
    }, SLUG_REDIRECT_NOTIFY_INTERVAL_MS).unref();

    // Task #190 — emit a periodic Sentry "heartbeat" event in production so
    // the project always has a known signal. The matching Sentry alert
    // (see lib/SENTRY_PROD_ALERT_VERIFICATION.md) fires when these
    // heartbeats stop arriving, catching DSN/network/quota outages that
    // would otherwise be invisible. No-op in non-production.
    startSentryHeartbeat();
  })
  .catch((err) => {
    // Concise: the underlying error has already been logged with its SQL
    // fragment by runMigrationsBody's catch. Avoid re-dumping the full
    // drizzle stack here so Playwright's webServer log stays scannable.
    logger.error(`Failed to start server: migrations failed: ${(err as Error).message ?? String(err)}`);
    httpServer.close(() => process.exit(1));
    // Hard fallback in case close() hangs on open sockets.
    setTimeout(() => process.exit(1), 5_000).unref();
  });
