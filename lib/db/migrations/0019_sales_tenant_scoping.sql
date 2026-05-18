-- Add tenant_id scoping to sales_hotlinks and sales_inbound_emails.
-- Both tables previously lacked tenant scoping at the DB level, creating
-- cross-tenant leak risk. Backfill from related rows, then add NOT NULL +
-- index (kept nullable on inbound for legacy / unmatched rows).

-- ─── sales_hotlinks ─────────────────────────────────────────────────────
ALTER TABLE "sales_hotlinks"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer;

-- Backfill from lp_pages (every hotlink references a page).
UPDATE "sales_hotlinks" h
   SET "tenant_id" = p."tenant_id"
  FROM "lp_pages" p
 WHERE h."page_id" = p."id"
   AND h."tenant_id" IS NULL;

-- Defensive: fall back to the contact's tenant_id if a page row is missing.
UPDATE "sales_hotlinks" h
   SET "tenant_id" = c."tenant_id"
  FROM "sales_contacts" c
 WHERE h."contact_id" = c."id"
   AND h."tenant_id" IS NULL;

-- Any rows still null (orphaned) go to tenant 1 = Dandy so the NOT NULL
-- constraint applies cleanly; in practice this should be zero rows.
UPDATE "sales_hotlinks"
   SET "tenant_id" = 1
 WHERE "tenant_id" IS NULL;

ALTER TABLE "sales_hotlinks"
  ALTER COLUMN "tenant_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "sales_hotlinks_tenant_id_idx"
  ON "sales_hotlinks" ("tenant_id");

-- ─── sales_inbound_emails ───────────────────────────────────────────────
ALTER TABLE "sales_inbound_emails"
  ADD COLUMN IF NOT EXISTS "tenant_id" integer;

-- Backfill from the matched contact (where available).
UPDATE "sales_inbound_emails" e
   SET "tenant_id" = c."tenant_id"
  FROM "sales_contacts" c
 WHERE e."contact_id" = c."id"
   AND e."tenant_id" IS NULL;

-- For unmatched legacy inbound rows, default to Dandy (tenant 1) so
-- they remain visible to the team that owns them today. We keep the
-- column nullable so future webhook deliveries that fail tenant
-- resolution don't blow up the insert.
UPDATE "sales_inbound_emails"
   SET "tenant_id" = 1
 WHERE "tenant_id" IS NULL;

CREATE INDEX IF NOT EXISTS "sales_inbound_emails_tenant_id_idx"
  ON "sales_inbound_emails" ("tenant_id");
