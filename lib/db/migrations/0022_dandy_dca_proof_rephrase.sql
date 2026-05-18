-- Rephrase a single Dandy (tenant 1) value-prop proof point that legal/brand
-- does not allow us to say. Replaces the offending phrasing with the
-- approved version in any row that still has the old text, leaving any
-- other tenant or admin edits untouched.
--
-- Old: "DCA consolidated 400+ lab relationships down to one with Dandy"
-- New: "DCA consolidated 400+ lab relationships through a strategic partnership with Dandy"

DO $$
DECLARE
  pairs jsonb;
  updated jsonb;
BEGIN
  SELECT config->'salesConsole'->'valuePropPairs'
    INTO pairs
    FROM lp_brand_settings
   WHERE tenant_id = 1;

  IF pairs IS NULL OR jsonb_typeof(pairs) <> 'array' THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(
           CASE
             WHEN p->>'proof' = 'DCA consolidated 400+ lab relationships down to one with Dandy'
               THEN jsonb_set(p, '{proof}', to_jsonb('DCA consolidated 400+ lab relationships through a strategic partnership with Dandy'::text))
             ELSE p
           END
         )
    INTO updated
    FROM jsonb_array_elements(pairs) p;

  IF updated IS DISTINCT FROM pairs THEN
    UPDATE lp_brand_settings
       SET config = jsonb_set(config, '{salesConsole,valuePropPairs}', updated, true)
     WHERE tenant_id = 1;
  END IF;
END $$;
