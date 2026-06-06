-- lp_media intrinsic pixel dimensions (Task #1065).
--
-- The AI page generator must refuse undersized images as full-bleed /
-- parallax hero backgrounds (tiny images pixelate when stretched edge-to-
-- edge). To make that decision deterministically it needs each asset's real
-- pixel size. These nullable columns are populated on upload and brand-import
-- (via sharp) and probed on demand for legacy rows at generation time.
--
-- Nullable + IF NOT EXISTS keeps the migration idempotent and back-compatible:
-- legacy rows and non-raster assets (e.g. SVG logos) simply carry NULL.
ALTER TABLE "lp_media" ADD COLUMN IF NOT EXISTS "width" integer;
ALTER TABLE "lp_media" ADD COLUMN IF NOT EXISTS "height" integer;
