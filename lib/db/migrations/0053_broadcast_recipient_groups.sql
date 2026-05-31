-- Task #629 — admin-defined CUSTOM recipient groups for broadcast alerts.
--
-- The broadcast alert system ships three built-in, code-owned groups
-- (all_admins, all_members, page_author). This table lets a workspace admin
-- define their OWN named groups (e.g. "Billing contacts", "Design reviewers")
-- once and reuse them across any alert. A custom group is referenced from a
-- broadcast_alert_recipients.groups array by the token `custom:<id>`, resolves
-- to its members' CURRENT emails + extra emails at send time, and applies to
-- EVERY alert type. Deleting a group strips its token from every alert config
-- (done in the api-server DELETE route) and resolution ignores stale tokens.
CREATE TABLE IF NOT EXISTS broadcast_recipient_groups (
  id              serial PRIMARY KEY,
  tenant_id       integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label           text NOT NULL,
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb, -- app_users.id[]
  extra_emails    jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[]
  created_by      integer,
  updated_by      integer,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive unique label per tenant so the quick-pick list is unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_recipient_groups_tenant_label_idx
  ON broadcast_recipient_groups (tenant_id, lower(label));
