-- Partner Hub, for the account team: how a hub tells them about activity
-- (Slack, an email to the account owner, or both), a hub retired from the
-- list, and when the customer was last sent a reminder.
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "notify_via" text DEFAULT 'slack' NOT NULL;
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "last_reminder_at" timestamp with time zone;
