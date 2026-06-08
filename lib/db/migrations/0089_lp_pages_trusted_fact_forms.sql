-- Strict Facts (quotes) — persistent per-page trusted quote fact-forms.
-- A quote generated from the per-request reference URL (urlSourcedFacts) is
-- trusted at generation time, but the later /fact-flags/sync re-detect has no
-- URL context. We persist the trusted normalized quote forms here so every
-- subsequent sync re-applies the trust and never flags those quotes.
-- Array of normalizedFormFor("quote", …) strings; [] when none.
ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS trusted_fact_forms jsonb NOT NULL DEFAULT '[]'::jsonb;
