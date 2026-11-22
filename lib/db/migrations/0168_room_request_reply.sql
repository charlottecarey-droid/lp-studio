-- Partner Hub: the account team can answer a customer's request. The reply
-- shows on the request in the customer's hub.
ALTER TABLE "lp_room_requests" ADD COLUMN IF NOT EXISTS "team_reply" text;
ALTER TABLE "lp_room_requests" ADD COLUMN IF NOT EXISTS "team_reply_by" text;
ALTER TABLE "lp_room_requests" ADD COLUMN IF NOT EXISTS "team_reply_at" timestamp with time zone;
