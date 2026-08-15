-- Hotlink attribution for page visits (known visitors in the Pages view).
--
-- A sales hotlink (?hl=<token>) resolves server-side BEFORE the browser
-- session exists, so the page_view signal it emits carries no session_id and
-- the visitor's dwell lands on an anonymous lp_page_visits row. This column
-- closes that gap: the dwell beacon (hooks/use-dwell-tracker.ts →
-- POST /lp/track/dwell) now forwards the raw hl token, the server re-resolves
-- it and — only when the hotlink's page_id matches the beacon's — stamps the
-- hotlink id here. The visits feed then joins hotlink→contact→account to show
-- the visitor's name/company/email next to their time-on-page.
-- NULL = organic visit, or a hotlink visit that predates attribution.
ALTER TABLE lp_page_visits
  ADD COLUMN IF NOT EXISTS hotlink_id integer REFERENCES sales_hotlinks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lp_page_visits_hotlink_id_idx
  ON lp_page_visits (hotlink_id);
