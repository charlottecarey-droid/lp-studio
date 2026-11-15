-- Asset engagement by person: a partner room knows who its visitor is (a
-- personal link or a confirmed work email), so its asset events can say who
-- viewed what. Null everywhere else (anonymous hub visitors).
ALTER TABLE lp_asset_events ADD COLUMN IF NOT EXISTS viewer_email text;
ALTER TABLE lp_asset_events ADD COLUMN IF NOT EXISTS viewer_name text;
