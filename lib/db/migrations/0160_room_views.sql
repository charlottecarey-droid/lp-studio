-- Partner Hub performance: who opened which section of a hub and for how
-- long, and a per-hub switch for a Slack note when a customer visits.
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "visit_alert" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "lp_room_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "page_id" integer NOT NULL,
  "view_id" text NOT NULL,
  "session_id" text NOT NULL,
  "module" text NOT NULL,
  "seconds" integer DEFAULT 0 NOT NULL,
  "viewer_email" text,
  "viewer_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "lp_room_views_view_uniq" ON "lp_room_views" ("page_id", "view_id");
CREATE INDEX IF NOT EXISTS "lp_room_views_page_idx" ON "lp_room_views" ("page_id", "created_at");
