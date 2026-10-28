-- Content Hub engagement, phase 3 (Oct 2026): richer signals on the same table.
--   value  — numeric payload: video watch milestone (25/50/75/100), seconds the
--            in-page viewer stayed open, number of search matches.
--   detail — text payload: the search term, the section jumped to, the audience
--            link followed.
ALTER TABLE lp_asset_events ADD COLUMN IF NOT EXISTS value integer;
ALTER TABLE lp_asset_events ADD COLUMN IF NOT EXISTS detail text;
