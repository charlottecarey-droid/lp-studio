-- Gift exchange thank-you notes: the receiver of a transfer can send the giver
-- a one-line thanks, shown on the giver's loot card.
ALTER TABLE "lp_gift_transfers" ADD COLUMN IF NOT EXISTS "thanks" text;
ALTER TABLE "lp_gift_transfers" ADD COLUMN IF NOT EXISTS "thanked_at" timestamp with time zone;
