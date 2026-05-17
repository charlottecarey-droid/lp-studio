-- Drop NOT NULL on sales_email_campaigns.template_id.
--
-- The Drizzle schema (`lib/db/src/schema/salesEmails.ts`) declares
-- `templateId: integer("template_id").references(... { onDelete: "set null" })`
-- WITHOUT `.notNull()`, so a draft campaign can be created without a template
-- (template is now chosen later, inside the campaign editor). Production was
-- still rejecting these inserts with
--   "null value in column \"template_id\" violates not-null constraint"
-- because the original CREATE TABLE in migration 0008 emitted the column as
-- NOT NULL and no later migration relaxed it.
ALTER TABLE "sales_email_campaigns"
  ALTER COLUMN "template_id" DROP NOT NULL;
