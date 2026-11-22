-- Saved Partner Hub notes: pinned notes a rep saves from a hub's Overview to
-- add to any hub later. Words and links only; one name per workspace.
CREATE TABLE IF NOT EXISTS "lp_room_saved_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "name" text NOT NULL,
  "note" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lp_room_saved_notes_tenant_name_uniq" ON "lp_room_saved_notes" USING btree ("tenant_id", lower("name"));
