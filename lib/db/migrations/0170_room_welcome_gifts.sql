-- Partner Hub welcome gifts: every person on the customer's side is offered
-- their own welcome gift unless the team turns gifts off for the hub, or for
-- one person (some DSOs don't accept gifts). On by default: the step was
-- already offered on every hub.
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "gifts_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "gift_off_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;
