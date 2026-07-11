-- Support tickets (July 2026): the support chat bot's escalate_to_support
-- action now files a ticket server-side (previously it only rendered a
-- mailto: button — nothing was captured). Superadmin triages these in the
-- new Support tab of the superadmin console.
--
--   conversation_id — the support_guide conversation the escalation came
--                     from (SET NULL on delete so tickets outlive pruned
--                     transcripts).
--   user_email/name — the escalating account user, denormalized at file
--                     time so the ticket stays actionable if the user row
--                     churns.
--   current_path    — the in-app route the user was on when they escalated.
--   status          — 'open' | 'resolved'.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS support_tickets (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id integer REFERENCES conversations(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  summary text NOT NULL,
  current_path text,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx
  ON support_tickets (tenant_id);
