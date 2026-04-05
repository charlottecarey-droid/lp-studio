-- Add UTM parameter columns to sessions and page visits for attribution tracking

ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE lp_sessions ADD COLUMN IF NOT EXISTS utm_content text;

ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE lp_page_visits ADD COLUMN IF NOT EXISTS utm_content text;

-- Index for querying by source/campaign
CREATE INDEX IF NOT EXISTS lp_sessions_utm_source_idx ON lp_sessions (utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS lp_page_visits_utm_source_idx ON lp_page_visits (utm_source) WHERE utm_source IS NOT NULL;

-- UTM tracking columns on leads (for SFDC attribution)
ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE lp_leads ADD COLUMN IF NOT EXISTS utm_content text;
