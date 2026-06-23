---
name: Legacy default-on boolean config
description: How to roll out a new boolean BrandConfig field that needs to default ON for existing rows that lack the field.
---

When a new boolean flag on `lp_brand_settings.config` needs to default to
ON, do NOT gate behavior on a truthy check — existing tenants whose JSON
config predates the field will read as `undefined`, which is falsy, and
they'll silently behave as if it's OFF.

(NOTE: `aiStrictFactsMode` was the original example here, but it was
intentionally flipped to OPT-IN / default-OFF in June 2026 — now read as
`=== true`, NOT `!== false`. Do NOT "restore" it to default-ON. See
strict-facts-wording-scope.md.)

**Rule:** every read site — FE, AI prompt builders, and every route
that reads brand config (`generate-page.ts`, `custom-blocks-generate.ts`,
`ad-copy.ts`, etc.) — must use `brand.fieldName !== false`. The
`DEFAULT_BRAND` literal in `brand-config.ts` is only honored when the
config is freshly initialized; merged rows keep their stored shape.

**Why:** caught this in code review on the strict-facts rollout — the
claim-filter and the prompt-injected instruction were each gated
independently, and one site shipped with the wrong check, so legacy
tenants got the filter without the "do not invent" instruction.

**How to apply:** when adding `someFlag` with default ON,
`grep -rn 'brand.someFlag\b'` across both `artifacts/api-server` AND
`artifacts/lp-studio` and verify every gate is `!== false`, not just
truthy. The same applies to `=== true` checks on the FE side.
