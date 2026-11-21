-- Partner Hub practices: what each practice orders and how recently, read
-- from the synced report.
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "products" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "last_order_day" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "tenth_order_day" text;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "orders_all_time" integer;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "orders_last_month" integer;
ALTER TABLE "lp_room_practices" ADD COLUMN IF NOT EXISTS "orders_this_month" integer;
