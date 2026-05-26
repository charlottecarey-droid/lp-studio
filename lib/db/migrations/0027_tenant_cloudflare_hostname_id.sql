-- Task #412 — Custom domain self-serve.
-- Stores the Cloudflare Custom Hostname id so the tenant-admin "remove
-- domain" flow can delete the matching Cloudflare resource without
-- having to query Cloudflare to look it up by hostname first.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cloudflare_hostname_id text;
