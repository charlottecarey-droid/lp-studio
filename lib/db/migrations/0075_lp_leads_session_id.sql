-- De-anonymize the page-detail visits table (Task #910).
--
-- The visits table merges anonymous lp_page_visits rows (contact name/company/
-- email hardcoded NULL) with personalized hotlink visits (which resolve an
-- identity). When an "anonymous" visitor later submits a lead form, their
-- tracking session id is available at submit time but was never persisted on
-- the lead, so there was no way to link the lead's name back to that visitor's
-- earlier/later anonymous page visits.
--
-- Persist the session id on each lead so the visits query can LEFT JOIN
-- lp_page_visits to lp_leads on (page_id, session_id) and surface the real
-- name. NULL for legacy leads (session id was never stored) and for
-- submissions that arrived without a session id — only new submissions can be
-- linked going forward.
--
-- A (page_id, session_id) index supports the per-page session lookup the visits
-- endpoint performs. Idempotent (ADD COLUMN / CREATE INDEX IF NOT EXISTS) so it
-- is safe to re-run.

ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS lp_leads_page_id_session_id_idx
  ON lp_leads (page_id, session_id);
