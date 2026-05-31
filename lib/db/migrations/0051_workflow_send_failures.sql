-- Task #625 — Workflow recipient-failure safety-net.
--
-- When an email-workflow STEP tries to send to a recipient and the idempotency
-- claim/send fails transiently (a DB blip or provider error) BEFORE any
-- delivery, the dispatcher today releases the claim and logs — the recipient is
-- silently skipped with no durable trace. This ledger records those drops so a
-- superadmin can see them and trigger a safe manual retry.
--
-- Retry idempotency: a row stores the dispatcher `dedupe_base` for the step, so
-- a retry re-derives the SAME per-recipient `dedupe_key`. The existing
-- UNIQUE(dedupe_key, channel) on notification_sends is what guarantees a
-- recipient who actually DID receive the email never gets a second copy — a
-- retry whose claim hits that conflict resolves as an idempotent no-op.
--
-- Capturing a failure is best-effort and must never throw out of the sweep, so
-- nothing here is on the critical send path.

CREATE TABLE IF NOT EXISTS workflow_send_failures (
  id              serial PRIMARY KEY,
  workflow_id     integer NOT NULL REFERENCES email_workflows(id) ON DELETE CASCADE,
  -- The enrollment whose step failed. SET NULL if the enrollment is later
  -- cleaned up — the ledger row (and its retry payload) stays usable.
  enrollment_id   integer REFERENCES email_workflow_enrollments(id) ON DELETE SET NULL,
  step_id         text NOT NULL,
  tenant_id       integer REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id     integer REFERENCES app_users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_name  text,
  channel         text NOT NULL DEFAULT 'email'
                    CHECK (channel IN ('email', 'in_app')),
  template_key    text NOT NULL,
  -- Dispatcher dedupeBase for the step. Retry passes this back so the rebuilt
  -- per-recipient dedupe_key matches the original send exactly.
  dedupe_base     text NOT NULL,
  -- The full per-recipient idempotency key (dedupe_base + recipient key).
  dedupe_key      text NOT NULL,
  -- Render context needed to reconstruct the send on retry.
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,
  error           text,
  attempt_count   integer NOT NULL DEFAULT 1,
  -- Null until a retry (or a later out-of-band delivery) clears the failure.
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One ledger row per failed (recipient send, channel). Repeated failures of the
-- same send UPSERT (bump attempt_count) instead of piling up duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS workflow_send_failures_dedupe_uniq
  ON workflow_send_failures (dedupe_key, channel);

-- Superadmin list hot path: unresolved failures, newest first.
CREATE INDEX IF NOT EXISTS workflow_send_failures_unresolved_idx
  ON workflow_send_failures (created_at DESC) WHERE resolved_at IS NULL;
