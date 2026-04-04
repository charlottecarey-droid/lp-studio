#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Apply DB indexes idempotently (IF NOT EXISTS prevents any prompt or error on re-run).
# drizzle-kit push is intentionally not used here because it hangs on interactive prompts
# when the DB has tables not tracked in the schema. Schema-structural changes (new tables,
# columns) must be applied via psql or drizzle-kit push run manually.
psql "$NEON_DATABASE_URL" -c "
  CREATE INDEX IF NOT EXISTS lp_pages_tenant_slug_idx ON lp_pages (tenant_id, slug);
  CREATE INDEX IF NOT EXISTS lp_page_visits_page_id_idx ON lp_page_visits (page_id);
"
