-- Seed Dandy (tenant 1) with a mandatory customer phrasing rule so the AI cold-
-- email + generate-email generators stop paraphrasing the approved DCA proof
-- point into language the brand does not allow.
--
-- Background: the stored proof point already reads "DCA consolidated 400+ lab
-- relationships through a strategic partnership with Dandy" (seed 0020 +
-- migration 0022). But the model freely paraphrases the proof at generation
-- time and kept reintroducing the banned "consolidated ... down to one with
-- Dandy" framing. `customerNameRules` is now injected verbatim into both email
-- prompts, so this row gives tenant 1 the rule that forbids that paraphrase.
--
-- Idempotent + append-only: we never clobber any naming rules the user may have
-- already written; we skip entirely once our rule is present.
DO $$
DECLARE
  existing text;
  rule text := 'When referencing DCA (Dental Care Alliance): NEVER write that DCA consolidated practices, locations, or labs "down to one" or "down to a single lab" — that framing is not allowed. Always describe it as consolidating their lab relationships "through a strategic partnership with Dandy" (e.g. "DCA consolidated 400+ lab relationships through a strategic partnership with Dandy"). This applies even when shortening or paraphrasing the proof point.';
  config_row jsonb;
BEGIN
  SELECT config INTO config_row FROM lp_brand_settings WHERE tenant_id = 1;
  IF config_row IS NULL OR config_row -> 'salesConsole' IS NULL THEN
    RETURN;
  END IF;

  existing := COALESCE(config_row #>> '{salesConsole,customerNameRules}', '');

  -- Already seeded — distinctive signature phrase from our rule.
  IF position('NEVER write that DCA consolidated' IN existing) > 0 THEN
    RETURN;
  END IF;

  UPDATE lp_brand_settings
     SET config = jsonb_set(
       config,
       '{salesConsole,customerNameRules}',
       to_jsonb(
         CASE WHEN length(trim(existing)) > 0
              THEN existing || E'\n\n' || rule
              ELSE rule
         END
       ),
       true
     )
   WHERE tenant_id = 1;
END $$;
