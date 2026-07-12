-- Generation annotations stash (builder UX #6, July 2026). The generators
-- compute advisory image-fit flags and critique annotations every run, but
-- they were only shown once in the Watch-It-Build receipt and then dropped.
-- Persisting them on the page lets the builder's pre-publish check surface
-- them ("2 images flagged for fit review") with go-to-block links.
--
-- NULLABLE, no default: NULL = page wasn't AI-generated (or predates this
-- column). Shape:
--   { imageFitFlags: ImageFitFlag[], critiqueAnnotations: CritiqueAnnotation[] }
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE lp_pages ADD COLUMN IF NOT EXISTS generation_annotations jsonb;
