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
  CREATE INDEX IF NOT EXISTS lp_pages_tenant_slug_idx ON lp_pages (tenant_id, slug);
  CREATE INDEX IF NOT EXISTS lp_page_visits_page_id_idx ON lp_page_visits (page_id);
"

# CONCURRENT index creation — one psql call per index (cannot run in a transaction block)
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_sessions_session_test ON lp_sessions (session_id, test_id);"
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_events_test_id ON lp_events (test_id);"
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_heatmap_events_page_id ON lp_heatmap_events (page_id);"
psql "$NEON_DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lp_page_presence_page_id ON lp_page_presence (page_id);"
