---
name: Templates list endpoints must project, not ship full blocks
description: LP template LIST endpoints must not select the full blocks JSONB; project columns and derive count/types in SQL. Notes the still-open pages.ts sibling.
---

# Template LIST endpoints: project columns, never ship full `blocks`

A template LIST endpoint that only needs block **count / types / full-page /
microsite-compatibility** must NOT `db.select()` the whole row — the `blocks`
JSONB is often multi-MB (HTML, image URLs, copy) and gets shipped per template
across owned + ALL globals, so a gallery load is MB→KB once projected.

Derive in SQL instead of pulling blocks:
- count: `CASE WHEN jsonb_typeof(blocks)='array' THEN jsonb_array_length(blocks) ELSE 0 END`
- types (position-preserved): `jsonb_agg(elem->>'type' ORDER BY ord)` over
  `jsonb_array_elements(blocks) WITH ORDINALITY AS arr(elem, ord)`, wrapped in
  `COALESCE(..., '[]'::jsonb)` and the same array-type guard.

**Why type-only projection is behavior-preserving:** the derivations
(`isFullPageTemplate`, `getMicrositeTemplateCompatibility` in
`lib/lp-template-engine/src/block-tags.ts`) read ONLY `block.type` —
`isFullPageTemplate` looks at `blocks[0].type` (hence the ordinality/order-by,
so element 0 stays element 0), compatibility just checks for any string `type`.
Rebuild `blocksForType = rawTypes.map(type => ({ type }))` (length-preserving,
null→undefined) and pass that to the helpers.

**How to apply:** applies to the LIST routes in
`artifacts/api-server/src/routes/lp/templates.ts` (`/enriched`, `/manage` owned
+ globals). Leave single-row reads alone (`:id/preview`, PATCH/refresh lookups) —
they legitimately need full blocks and aren't a list-perf problem.

**Still open (follow-up, needs consumer audit before projecting):**
`GET /lp/templates` in `routes/lp/pages.ts` is ALSO a list endpoint that does a
bare `.select()` and `res.json(result)` — it ships full `blocks` for owned + all
globals to the client (feeds create-microsite dropdown / template pickers).
Can't be blindly projected: some consumers may read `blocks` from that response.
