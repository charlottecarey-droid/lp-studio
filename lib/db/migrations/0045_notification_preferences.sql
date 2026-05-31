-- Task #587 — per-recipient email preference (opt-out) store.
--
-- A row's PRESENCE means the recipient has OPTED OUT of that (template, channel)
-- pair. Absence = subscribed (the default). The dispatcher only ever consults or
-- writes this table for `category = 'lifecycle'` templates; system/transactional
-- emails (auth, billing) always send and are never recorded here.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id           serial PRIMARY KEY,
  tenant_id    integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id  integer NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  channel      text NOT NULL, -- 'email' | 'in_app'
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- At most one opt-out row per (recipient, template, channel).
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_unique_idx
  ON notification_preferences (tenant_id, app_user_id, template_key, channel);

-- Hot path: load a recipient's opt-outs when dispatching / rendering the page.
CREATE INDEX IF NOT EXISTS notification_preferences_lookup_idx
  ON notification_preferences (tenant_id, app_user_id);
