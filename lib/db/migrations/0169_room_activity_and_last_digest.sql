-- Partner Hub: a short record of what the account team did to a hub (who
-- published it, sent a reminder, changed its settings), and the last weekly
-- digest that went out, so a rep can see what the customer was sent.
CREATE TABLE IF NOT EXISTS "lp_room_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "page_id" integer NOT NULL,
  "actor" text NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lp_room_activity_page_created_idx" ON "lp_room_activity" ("page_id", "created_at");
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "last_digest_subject" text;
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "last_digest_html" text;
