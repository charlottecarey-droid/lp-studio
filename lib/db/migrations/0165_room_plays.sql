-- Partner Hub recommended plays: what the team did with each one, and
-- whether the account allows direct outreach to its practices.
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "no_direct_outreach" boolean DEFAULT false NOT NULL;
ALTER TABLE "lp_room_settings" ADD COLUMN IF NOT EXISTS "plays_state" jsonb;
