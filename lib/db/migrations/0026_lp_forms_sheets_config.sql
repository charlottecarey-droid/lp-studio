-- Per-form Google Sheets override. NULL = use the tenant's global
-- Google Sheets integration target (current behavior). When set with
-- { enabled: true, sheetId: "...", tabName?: "..." }, leads from this
-- specific form are appended to the override sheet/tab instead of the
-- tenant's default. Credentials (service account email + private key)
-- always come from the tenant's lp_integrations row — the override only
-- redirects the destination.
ALTER TABLE lp_forms ADD COLUMN IF NOT EXISTS sheets_config jsonb;
