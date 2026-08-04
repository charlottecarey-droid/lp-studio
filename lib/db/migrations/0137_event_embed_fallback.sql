-- Event-level embed widget setup (Aug 2026) — completes 0135/0136.
--
-- The customer-site snippet has three knobs; 0136 stored the param name,
-- this stores the other two so the whole install is configured in one
-- place (the event's Embed dialog) and the copied snippet can't drift:
--
--   embed_hide_selector — CSS selector of the site's OWN agenda widget
--     (the RainFocus container on procore.com/groundbreak). Emitted as
--     data-hide: hidden while a tokenized agenda renders, restored when a
--     token is dead, so stale links degrade to the site's normal agenda.
--
--   embed_default_agenda_id — which agenda's token bakes in as
--     data-default (what tokenless visitors see). NULL = no default: the
--     widget renders nothing and the site's own agenda stays — the
--     RainFocus-coexistence mode. SET NULL on agenda delete so a deleted
--     default silently degrades to that same mode instead of a dangling id.

ALTER TABLE "sales_events" ADD COLUMN IF NOT EXISTS "embed_hide_selector" text;
ALTER TABLE "sales_events" ADD COLUMN IF NOT EXISTS "embed_default_agenda_id" integer;

DO $$ BEGIN
  ALTER TABLE "sales_events"
    ADD CONSTRAINT "sales_events_embed_default_agenda_id_fkey"
    FOREIGN KEY ("embed_default_agenda_id") REFERENCES "sales_event_agendas"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
