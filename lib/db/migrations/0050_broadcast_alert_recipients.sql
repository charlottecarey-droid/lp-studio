-- Task #614 — per-tenant override of who receives each "broadcast" alert email.
--
-- The PRESENCE of a row = the alert type is CONFIGURED for that tenant; its
-- recipients are the resolved `member_user_ids` (current emails) plus
-- `extra_emails`. Absence of a row = keep the legacy default audience (all
-- members for collaboration alerts, all admins for account/billing alerts).
-- Account/billing alert types FAIL OPEN to all admins when a configured row
-- resolves to zero valid recipients (enforced in the api-server resolver).
CREATE TABLE IF NOT EXISTS broadcast_alert_recipients (
  id              serial PRIMARY KEY,
  tenant_id       integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type      text NOT NULL,
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- app_users.id[]
  extra_emails    jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  updated_by      integer,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One config row per (tenant, alert type).
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_alert_recipients_unique_idx
  ON broadcast_alert_recipients (tenant_id, alert_type);
