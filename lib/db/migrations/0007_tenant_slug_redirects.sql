-- Tenant slug redirects (task #133)
--
-- Why
-- ───
-- Admins can rename their workspace slug from Settings → General. The new
-- slug becomes the canonical login host (e.g. acme.lpstudio.ai), but old
-- bookmarks pointing at the previous slug must keep working for a while
-- so users aren't stranded mid-flow. Each rename inserts a row here that
-- maps the old slug back to the tenant; the host resolver and the
-- /api/auth/domain-context endpoint use it to issue a redirect to the new
-- canonical host.
--
-- Rows expire after 90 days by default; the application cleans them up
-- lazily and treats expired rows as missing.
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
