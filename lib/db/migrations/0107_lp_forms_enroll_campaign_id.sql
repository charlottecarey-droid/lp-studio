-- Task #1393: Webinar Hub (and any form) registration → Sales Campaign
-- enrollment. Add an optional `enroll_campaign_id` to both the per-form config
-- (lp_forms) and the per-page form-notifications config (lp_form_notifications).
-- When set, a submitter is auto-enrolled (best-effort) as a queued recipient of
-- the referenced Sales Campaign. ON DELETE SET NULL so deleting a campaign just
-- clears the enrollment. Idempotent — safe to re-run.

ALTER TABLE "lp_forms"
  ADD COLUMN IF NOT EXISTS "enroll_campaign_id" integer;

ALTER TABLE "lp_form_notifications"
  ADD COLUMN IF NOT EXISTS "enroll_campaign_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lp_forms_enroll_campaign_id_fk'
  ) THEN
    ALTER TABLE "lp_forms"
      ADD CONSTRAINT "lp_forms_enroll_campaign_id_fk"
      FOREIGN KEY ("enroll_campaign_id")
      REFERENCES "sales_email_campaigns"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lp_form_notifications_enroll_campaign_id_fk'
  ) THEN
    ALTER TABLE "lp_form_notifications"
      ADD CONSTRAINT "lp_form_notifications_enroll_campaign_id_fk"
      FOREIGN KEY ("enroll_campaign_id")
      REFERENCES "sales_email_campaigns"("id") ON DELETE SET NULL;
  END IF;
END $$;
