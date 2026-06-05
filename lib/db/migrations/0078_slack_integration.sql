-- Slack Notifier — first-class, outbound-only Slack integration (Task #962).
--
-- Mirrors the dedicated SFDC / Marketo integrations: a dedicated table rather
-- than bolting onto the generic lp_integrations provider row. Carries a
-- tenant_id NOT NULL FK (ON DELETE CASCADE) + index from the start — there is
-- no cross-tenant fallback. Slack connects via OAuth v2; the bot token and the
-- optional incoming-webhook url are encrypted at rest (v1: envelope).
--
-- Idempotent throughout (CREATE TABLE / CREATE INDEX IF NOT EXISTS) so it is
-- safe to re-run via the migrate.ts self-heal step.

CREATE TABLE IF NOT EXISTS slack_connections (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  team_id text NOT NULL,
  team_name text,
  access_token text NOT NULL,
  bot_user_id text,
  incoming_webhook_url text,
  default_channel_id text,
  default_channel_name text,
  event_toggles jsonb NOT NULL DEFAULT '{"form_submit":true,"hot_visit":true,"ai_briefing":true}',
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slack_connections_tenant_id ON slack_connections (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_slack_connections_tenant_team ON slack_connections (tenant_id, team_id);
