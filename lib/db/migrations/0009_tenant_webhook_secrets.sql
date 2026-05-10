-- Tenant-scoped webhook secrets (task #147)
--
-- Why
-- ───
-- The public inbound webhook endpoints (/webhooks/rb2b, /webhooks/apollo,
-- /webhooks/letterdrop) used to hardcode tenant_id=1 (Dandy) for every
-- inserted signal. As soon as a second tenant configured their own
-- RB2B / Apollo / Letterdrop tracker, their identified visitors would
-- silently land in Dandy's data.
--
-- We now embed a per-tenant secret in the webhook URL itself
-- (e.g. /webhooks/rb2b/<secret>). The handler looks up the tenant by
-- (integration, secret) and rejects unknown secrets with 404 — no body,
-- so an attacker can't probe which integrations a tenant has wired up.
--
-- Secrets are generated with crypto.randomBytes(24).toString("base64url"),
-- giving ~192 bits of entropy. The unique index on `secret` guarantees no
-- two tenants ever share the same URL.
CREATE TABLE IF NOT EXISTS tenant_webhook_secrets (
  id            serial PRIMARY KEY,
  tenant_id     integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration   text NOT NULL,
  secret        text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One secret per (tenant, integration). Rotation = DELETE + INSERT.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_webhook_secrets_tenant_integration_idx
  ON tenant_webhook_secrets (tenant_id, integration);

-- Fast secret lookup on the webhook hot path.
CREATE INDEX IF NOT EXISTS tenant_webhook_secrets_secret_idx
  ON tenant_webhook_secrets (secret);
