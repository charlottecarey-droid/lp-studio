-- June 2026 — shared conversation engine (LP Studio chatbot spec). ONE
-- mode-tagged transcript substrate for every conversational surface; v1 only
-- writes mode = 'builder_copilot' rows. New bots (lead-capture, support) add a
-- mode value, never a new table — so transcripts/analytics/linkage stay
-- uniform.
--
-- conversations          — one thread; tenant-scoped, mode-tagged, optionally
--                          attached to a builder page.
-- conversation_messages  — append-only turns. assistant turns may carry a
--                          jsonb `actions` array (the structured edits the bot
--                          PROPOSED — never auto-applied).
CREATE TABLE IF NOT EXISTS conversations (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mode        text NOT NULL,
  page_id     integer REFERENCES lp_pages(id) ON DELETE CASCADE,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_tenant_idx ON conversations (tenant_id);
CREATE INDEX IF NOT EXISTS conversations_tenant_mode_idx ON conversations (tenant_id, mode);
CREATE INDEX IF NOT EXISTS conversations_page_idx ON conversations (page_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id               serial PRIMARY KEY,
  conversation_id  integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL,
  content          text NOT NULL DEFAULT '',
  actions          jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx ON conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx ON conversation_messages (conversation_id, created_at);
