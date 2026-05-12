-- Task #253 — normalize legacy productLines[].claims entries from raw strings
-- into the new `{ text, approvedForAi }` object shape so Strict Facts Mode can
-- evaluate per-row approval state without falling back to runtime helpers
-- forever. Runtime helpers stay in place for safety, but this migration moves
-- existing rows over so the data on disk matches the new contract.
--
-- Approach: for every brand config row, walk productLines (if any) and rewrite
-- claims so each entry is `{text, approvedForAi: true}`. String entries are
-- treated as approved (matches helper semantics). Existing object entries are
-- preserved. Configs without productLines are untouched.

UPDATE lp_brand_settings
SET config = jsonb_set(
  config,
  '{productLines}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN pl ? 'claims' AND jsonb_typeof(pl->'claims') = 'array'
          THEN jsonb_set(
            pl,
            '{claims}',
            COALESCE((
              SELECT jsonb_agg(
                CASE
                  WHEN jsonb_typeof(c) = 'string'
                    THEN jsonb_build_object('text', c, 'approvedForAi', true)
                  WHEN jsonb_typeof(c) = 'object'
                    THEN c || jsonb_build_object(
                      'approvedForAi',
                      COALESCE(c->'approvedForAi', 'true'::jsonb)
                    )
                  ELSE jsonb_build_object('text', c::text, 'approvedForAi', true)
                END
              )
              FROM jsonb_array_elements(pl->'claims') AS c
            ), '[]'::jsonb)
          )
        ELSE pl
      END
    )
    FROM jsonb_array_elements(config->'productLines') AS pl
  ), '[]'::jsonb)
)
WHERE config ? 'productLines'
  AND jsonb_typeof(config->'productLines') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(config->'productLines') AS pl,
         jsonb_array_elements(COALESCE(pl->'claims', '[]'::jsonb)) AS c
    WHERE jsonb_typeof(c) = 'string'
  );
