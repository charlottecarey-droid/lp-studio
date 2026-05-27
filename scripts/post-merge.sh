#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply DB indexes idempotently (IF NOT EXISTS prevents any prompt or error on re-run).
# drizzle-kit push is intentionally not used here because it hangs on interactive prompts
# when the DB has tables not tracked in the schema. Schema-structural changes (new tables,
# columns) must be applied via psql or drizzle-kit push run manually.
#
# Standard (non-CONCURRENT) indexes can be batched in a single -c call.
# CONCURRENT indexes must be separate psql invocations (can't run inside a transaction block).

psql "$NEON_DATABASE_URL" -c "
  CREATE INDEX IF NOT EXISTS lp_pages_account_slug_idx ON lp_pages (account_id, slug);
  CREATE INDEX IF NOT EXISTS lp_page_visits_page_id_idx ON lp_page_visits (page_id);
"

# lp_pages_tenant_slug_idx requires the tenant_id column which may not yet exist
# in all environments (it is added by a separate schema migration). Skip gracefully
# when the column is absent so the post-merge script stays idempotent everywhere.
psql "$NEON_DATABASE_URL" -c "
DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lp_pages' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS lp_pages_tenant_slug_idx ON lp_pages (tenant_id, slug)';
  END IF;
END \$\$;
"

# CONCURRENT index creation — one psql call per index (cannot run in a transaction block)

# lp_sessions: composite index for A/B test session lookup (session_id + test_id)
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_sessions_session_test ON lp_sessions (session_id, test_id);"

# lp_events: indexed on test_id (the column used in all analytics WHERE clauses).
# NOTE: The task plan referenced "page_id" but lp_events has no page_id column —
# only test_id, variant_id, session_id. test_id is the correct FK for analytics queries.
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_events_test_id ON lp_events (test_id);"

# lp_heatmap_events: indexed on page_id (queried by page_id in heatmap analytics)
# Table may not exist in all environments — skip gracefully if absent.
# Note: CREATE INDEX CONCURRENTLY cannot run inside a DO block / transaction
# (Postgres wraps DO bodies in an implicit txn and rejects the concurrent
# build). So the table-existence check is done at the shell level instead,
# and the index is created via a separate top-level psql command.
if [ "$(psql "$NEON_DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_name = 'lp_heatmap_events'")" = "1" ]; then
  psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_heatmap_events_page_id ON lp_heatmap_events (page_id);"
fi

# lp_page_presence: indexed on page_id (queried by page_id for live presence tracking)
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_page_presence_page_id ON lp_page_presence (page_id);"

# Task #191 — post-deploy smoke test: hit every active tenant host on
# /api/auth/domain-context and fail (set -e propagates) if any returns 403/5xx.
# This is the deploy-time guard for host-level outages (DNS / custom-domain
# registration / edge worker route changes) that build-time checks can't see.
# Set SMOKE_SKIP_TENANT_HOSTS=1 to skip (e.g. when deploying to an environment
# where the live hosts aren't yet pointed at this build).
# Task #356 — Dandy brand font seed. Platform default for `--app-font-display`
# is a neutral Inter/system stack so non-Dandy tenants (wash, max, etc.) fall
# back to system-ui when their brand record sets no display font. Dandy
# specifically must keep Bagoss Standard, so we patch the Dandy brand record
# to set displayFont/bodyFont explicitly. Idempotent: only fills missing keys,
# never overwrites a tenant-set value.
psql "$NEON_DATABASE_URL" -c "
  UPDATE lp_brand_settings
  SET config = jsonb_set(
                 jsonb_set(
                   config,
                   '{displayFont}',
                   to_jsonb(COALESCE(NULLIF(config->>'displayFont',''), 'Bagoss Standard')),
                   true
                 ),
                 '{bodyFont}',
                 to_jsonb(COALESCE(NULLIF(config->>'bodyFont',''), 'Inter')),
                 true
               ),
      updated_at = now()
  WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('dandy','dandy-smb'))
    AND (
      COALESCE(NULLIF(config->>'displayFont',''), '') = ''
      OR COALESCE(NULLIF(config->>'bodyFont',''), '')    = ''
    );
"

if [ "${SMOKE_SKIP_TENANT_HOSTS:-0}" != "1" ]; then
  pnpm --filter @workspace/scripts run smoke-tenant-hosts
fi
