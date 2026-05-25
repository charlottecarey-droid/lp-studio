-- Task #379 — per-page asset-health record persisted by the scheduled
-- canary (assetHealthCheck.ts). Powers the SuperAdmin asset-health
-- dashboard so an operator can see "X% of published pages reference
-- missing assets" without re-running the probe.
--
-- Both columns are nullable: pages that haven't been checked yet show
-- as "never checked" in the UI. The JSONB shape is:
--   { checked: number,        -- count of unique /assets/* refs in HTML
--     brokenAssets: string[], -- subset that returned 404 from R2
--     host: string,           -- host the lookup used
--     hadHtml: boolean }      -- whether R2 HTML existed at all
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS asset_health_checked_at timestamptz;
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS asset_health_result jsonb;
