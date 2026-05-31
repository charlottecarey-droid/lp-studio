-- Task #589 — Email workflow composer (Phase 3).
--
-- Adds a composable workflow layer ABOVE the existing single-template dispatcher
-- (artifacts/api-server/src/lib/notificationDispatcher.ts). Nothing in the
-- render/template pipeline changes: each workflow STEP still calls
-- dispatchNotification with a template key, so single-fire emails stay
-- byte-identical. Three new tables:
--
--   email_workflow_triggers     — the trigger registry. Replaces the implicit
--     "callsite picks a template key" model with named, UI-extensible triggers.
--     Code-fired event triggers (welcome, trial_day_7, …) are seeded is_system;
--     superadmins can add scheduled/audience triggers from the UI.
--   email_workflows             — a trigger bound to an ordered list of steps
--     (definition.steps jsonb). Steps support delays, per-step channel override,
--     conditions (plan / read / not_read) and branching. A single-fire email is
--     just a one-step workflow.
--   email_workflow_enrollments  — one row per (workflow, recipient, event
--     instance). The step engine advances each enrollment; next_run_at doubles
--     as the due-time AND the lease (a claimed row is bumped into the future so a
--     second instance won't re-grab it). dedupe_key makes enrollment idempotent;
--     each step's send derives its dispatcher dedupe from it, so step sends reuse
--     the existing UNIQUE(dedupe_key, channel) idempotency on notification_sends.
--
-- Platform scope only in v1 (scope/tenant_id columns are present for forward
-- compatibility). Going-forward-only: no data migration, existing sends keep
-- working through their code-default hard fallback until/unless a matching
-- enabled workflow exists.

-- ─── 1. Trigger registry ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_workflow_triggers (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  trigger_type text NOT NULL DEFAULT 'event'
                 CHECK (trigger_type IN ('event', 'scheduled', 'audience')),
  -- For event triggers: the code event name a callsite fires
  -- (enqueueWorkflowTrigger). Null for scheduled/audience triggers, which the
  -- sweep evaluates instead.
  event_key    text,
  -- Schedule spec / audience filter, interpreted per trigger_type. Empty for events.
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_system    boolean NOT NULL DEFAULT false,
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

-- Fast lookup from a fired event name to its trigger(s).
CREATE INDEX IF NOT EXISTS email_workflow_triggers_event_idx
  ON email_workflow_triggers (event_key) WHERE event_key IS NOT NULL;

-- ─── 2. Workflows ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_workflows (
  id           serial PRIMARY KEY,
  key          text NOT NULL,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  trigger_key  text NOT NULL,
  scope        text NOT NULL DEFAULT 'platform'
                 CHECK (scope IN ('platform', 'tenant')),
  tenant_id    integer REFERENCES tenants(id) ON DELETE CASCADE,
  enabled      boolean NOT NULL DEFAULT true,
  -- { "steps": Step[] }. Step shape is owned by workflowTypes.ts.
  definition   jsonb NOT NULL DEFAULT '{"steps":[]}'::jsonb,
  -- is_system: code-seeded (the row for a built-in single-fire email); cannot be
  -- deleted from the UI, but its steps stay editable so operators can chain
  -- follow-ups.
  is_system    boolean NOT NULL DEFAULT false,
  -- locked: definition is immutable AND the engine does not drive it — the
  -- callsite sends directly through its code hard fallback (auth-critical
  -- transactional emails). Present in the composer read-only for visibility.
  locked       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text,
  CHECK ((scope = 'platform' AND tenant_id IS NULL)
      OR (scope = 'tenant'   AND tenant_id IS NOT NULL))
);

-- One platform workflow per key; one tenant workflow per (tenant_id, key).
CREATE UNIQUE INDEX IF NOT EXISTS email_workflows_platform_key_uniq
  ON email_workflows (key) WHERE scope = 'platform';
CREATE UNIQUE INDEX IF NOT EXISTS email_workflows_tenant_key_uniq
  ON email_workflows (tenant_id, key) WHERE scope = 'tenant';
-- Hot path for enqueueWorkflowTrigger: enabled workflows for a trigger.
CREATE INDEX IF NOT EXISTS email_workflows_trigger_idx
  ON email_workflows (trigger_key) WHERE enabled = true;

-- ─── 3. Enrollments ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_workflow_enrollments (
  id              serial PRIMARY KEY,
  workflow_id     integer NOT NULL REFERENCES email_workflows(id) ON DELETE CASCADE,
  tenant_id       integer REFERENCES tenants(id) ON DELETE CASCADE,
  app_user_id     integer REFERENCES app_users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_name  text,
  context         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Null = not started (process the first step next). Otherwise the id of the
  -- step to execute on the next tick.
  current_step_id text,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  -- Due time AND lease: a claimed enrollment is bumped into the future so a
  -- concurrent instance won't re-grab it before processing finishes.
  next_run_at     timestamptz NOT NULL DEFAULT now(),
  -- Idempotency: one enrollment per (workflow, event instance, recipient).
  dedupe_key      text NOT NULL,
  -- Loop guard: number of steps executed; capped in the engine.
  step_count      integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_workflow_enrollments_dedupe_uniq
  ON email_workflow_enrollments (workflow_id, dedupe_key);
-- Sweep hot path: active enrollments that are due.
CREATE INDEX IF NOT EXISTS email_workflow_enrollments_due_idx
  ON email_workflow_enrollments (next_run_at) WHERE status = 'active';

-- ─── 4. Seed the built-in event triggers + one-step system workflows ─────────
-- Copy/channels for each step's template live in code
-- (notificationTemplates.ts); these rows only declare the trigger→workflow
-- wiring. ON CONFLICT DO NOTHING keeps re-runs and operator edits safe.
--
-- locked=true marks auth-critical transactional sends (magic link, password
-- reset, email verification): represented for visibility but the callsite sends
-- directly through its code hard fallback, never the async engine.
INSERT INTO email_workflow_triggers (key, name, description, trigger_type, event_key, is_system, enabled)
VALUES
  ('welcome',              'New workspace welcome',  'Fires when a new workspace finishes onboarding.', 'event', 'welcome',              true, true),
  ('workspace_invite',     'Workspace invite',       'Fires when a teammate is invited to a workspace.', 'event', 'workspace_invite',     true, true),
  ('trial_day_7',          'Trial — day 7',          'Fires 7 days into the Growth trial.',             'event', 'trial_day_7',          true, true),
  ('trial_day_11',         'Trial — day 11',         'Fires 11 days into the Growth trial.',            'event', 'trial_day_11',         true, true),
  ('trial_day_13',         'Trial — day 13',         'Fires on the last day of the Growth trial.',      'event', 'trial_day_13',         true, true),
  ('magic_link',           'Sign-in link',           'Fires when a passwordless sign-in link is requested.', 'event', 'magic_link',      true, true),
  ('password_reset',       'Password reset',         'Fires when a password reset is requested.',       'event', 'password_reset',       true, true),
  ('email_verification',   'Email verification',     'Fires when an email address needs confirming.',   'event', 'email_verification',   true, true),
  ('payment_failed',       'Payment failed',         'Fires on a failed subscription payment.',         'event', 'payment_failed',       true, true),
  ('slug_redirect_expiry', 'Old URL expiring',       'Fires when a renamed workspace URL is about to expire.', 'event', 'slug_redirect_expiry', true, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO email_workflows (key, name, description, trigger_key, scope, enabled, definition, is_system, locked)
VALUES
  -- welcome routes the EMAIL through the engine; the in-app inbox drop stays a
  -- direct dispatch at the callsite, so this step is email-only (avoids a
  -- duplicate inbox item).
  ('welcome',              'Welcome',               'Welcome email to a new workspace.',                   'welcome',              'platform', true, '{"steps":[{"id":"s1","templateKey":"welcome","channels":["email"],"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, false),
  -- workspace_invite sends via a bespoke render+Resend path with its own hard
  -- fallback; locked so the engine never drives it (re-routing would change the
  -- rendered bytes). Present for composer visibility only.
  ('workspace_invite',     'Workspace invite',      'Workspace-invite email (sent directly by code).',     'workspace_invite',     'platform', true, '{"steps":[{"id":"s1","templateKey":"workspace_invite","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true),
  ('trial_day_7',          'Trial — day 7',         'Halfway trial nudge.',                                'trial_day_7',          'platform', true, '{"steps":[{"id":"s1","templateKey":"trial_day_7","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, false),
  ('trial_day_11',         'Trial — day 11',        'Three-days-left trial nudge.',                        'trial_day_11',         'platform', true, '{"steps":[{"id":"s1","templateKey":"trial_day_11","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, false),
  ('trial_day_13',         'Trial — day 13',        'Last-day trial nudge.',                               'trial_day_13',         'platform', true, '{"steps":[{"id":"s1","templateKey":"trial_day_13","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, false),
  ('magic_link',           'Sign-in link',          'Passwordless sign-in link (sent directly by code).',  'magic_link',           'platform', true, '{"steps":[{"id":"s1","templateKey":"magic_link","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true),
  ('password_reset',       'Password reset',        'Password reset link (sent directly by code).',        'password_reset',       'platform', true, '{"steps":[{"id":"s1","templateKey":"password_reset","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true),
  ('email_verification',   'Email verification',    'Email confirmation link (sent directly by code).',    'email_verification',   'platform', true, '{"steps":[{"id":"s1","templateKey":"email_verification","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true),
  ('payment_failed',       'Payment failed',        'Dunning email (sent directly by code).',              'payment_failed',       'platform', true, '{"steps":[{"id":"s1","templateKey":"payment_failed","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true),
  ('slug_redirect_expiry', 'Old URL expiring',      'Old-URL expiry warning (sent directly by code).',     'slug_redirect_expiry', 'platform', true, '{"steps":[{"id":"s1","templateKey":"slug_redirect_expiry","channels":null,"delayMs":0,"condition":null,"branch":null,"next":null}]}'::jsonb, true, true)
ON CONFLICT DO NOTHING;
