-- Holiday gifting exchange: reps post gifts up for grabs or ask for gifts on
-- the Sales Console gifting page; each Claim / Give moves one gift and is
-- logged as a transfer (also appended to the gifting sheet's Transfers tab).
CREATE TABLE IF NOT EXISTS "lp_gift_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "kind" text NOT NULL,
  "rep_email" text NOT NULL,
  "rep_name" text DEFAULT '' NOT NULL,
  "tier" text NOT NULL,
  "qty" integer NOT NULL,
  "remaining" integer NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lp_gift_posts_tenant_status_idx" ON "lp_gift_posts" USING btree ("tenant_id", "status");
CREATE TABLE IF NOT EXISTS "lp_gift_transfers" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "post_id" integer,
  "from_email" text NOT NULL,
  "to_email" text NOT NULL,
  "tier" text NOT NULL,
  "qty" integer DEFAULT 1 NOT NULL,
  "note" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lp_gift_transfers_tenant_idx" ON "lp_gift_transfers" USING btree ("tenant_id");
