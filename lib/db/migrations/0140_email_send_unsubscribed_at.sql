-- Per-campaign unsubscribe attribution.
--
-- Until now an unsubscribe wrote exactly one thing: sales_contacts.status =
-- 'unsubscribed'. No timestamp, no campaign, no event row — so "how many
-- people did that send cost us?" had no answer anywhere in the product, and
-- the Campaigns > Performance tab had nothing to show.
--
-- The unsubscribe link now carries the campaign id inside its signed token, so
-- the opt-out can be stamped on the exact send that provoked it. NULL means
-- this recipient has not unsubscribed from this send.
--
-- Deliberately NOT backfilled: sales_contacts has no unsubscribe timestamp, so
-- every historical opt-out is undatable and unattributable. Guessing "the last
-- campaign that emailed them" would put invented churn against real campaigns.
-- Pre-deploy unsubscribes surface instead as the lifetime total the
-- Performance tab reports separately.
ALTER TABLE sales_email_sends
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- Performance aggregates group by campaign and filter on this being non-null.
CREATE INDEX IF NOT EXISTS sales_email_sends_campaign_unsubscribed_idx
  ON sales_email_sends (campaign_id)
  WHERE unsubscribed_at IS NOT NULL;
