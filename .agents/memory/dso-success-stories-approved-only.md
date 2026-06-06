---
name: case-study blocks approved-only + real content
description: All case-study blocks (dso-success-stories, dso-case-study, case-studies) in both AI generators + builder must use the tenant's AI-approved Content Library case studies with their REAL quote/author/stat/image; empty library keeps built-in examples.
---

# Case-study blocks: approved-only, real content, relevance-ranked

The three case-study-bearing block types — `dso-success-stories`,
`dso-case-study`, and the generic `case-studies` — must source customer stories
exclusively from the tenant's **AI-approved** Content Library case studies
(`case_study` type, `approved_for_ai !== false`), populated with the REAL
quote, author, headline stat (value + label), and image. Never surface
hardcoded/illustrative or AI-invented companies, stats, quotes, or authors.

**Why:** Block registry defaults ship illustrative placeholder stories; loading
those onto a real tenant page — or letting the AI invent stories — puts
fabricated customer outcomes in front of prospects. Earlier the strict guard
overwrote case slots to placeholders ("X" stat, "Add a quote in brand settings"),
which shipped ugly placeholders even when the library was empty.

**How to apply:**
- `case_study` content JSON is free-form (no DB migration): editor + generators
  read `quote, author, stat, statLabel (legacy alias: label), locationCount,
  segment, image, logoUrl, categories, url`. `statLabel ?? label` — the "Save DSO
  Success Story to library" path writes `label`; the editor writes `statLabel`.
- AI generators (`generate-page.ts` + `generate-microsite.ts`): enforcement is
  shared + **always-on** (decoupled from strict mode). `fetchApprovedCaseStudies`
  returns the rich shape; `rankCaseStudies` orders by closest `locationCount` →
  matching `segment` (contains either way) → library sort order;
  `enforceApprovedCaseStudies(block, rankedPool, {strict})` populates per type;
  `enforceDsoSuccessStoriesApproved(blocks, tenantId, {strict, locationCount,
  segment})` is the always-on entry (name kept; now covers all 3 types). Call it
  after sanitize/normalize at every generation callsite.
- **Empty-library reversal:** when the approved pool is EMPTY, do NOT overwrite to
  placeholders — keep the block's built-in examples. `dso-success-stories` →
  set `props.cases = []` so the renderer's shipped `DEFAULT_CASES` fallback fires.
  `case-studies` → leave items untouched. `dso-case-study` → leave untouched in
  non-strict; in strict still blank long-form prose (no approved prose source) so
  the AI can't ship an invented story.
- **Strict stat pool:** approved case-study `stat` values MUST be fed into
  `buildApprovedStatSet(...)` (4th arg), or `sanitizeBlocksStrict`'s numeric walk
  rewrites the REAL populated stat to the "X" placeholder (it runs enforce THEN
  walks within the same loop).
- Builder "Load defaults" (PropertyPanel DSO panel): map real
  stat/label/quote/author/image from content (was previously blanking them); still
  loads empty set (never registry default) when library has rows but none approved.
- Registry defaults stay illustrative (not tenant names) — enforcement happens at
  callsites, not by editing the defaults.
