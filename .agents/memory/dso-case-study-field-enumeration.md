---
name: dso-case-study field enumeration sync
description: Every place that enumerates dso-case-study prose fields must be kept in lockstep when the block gains a new field.
---

# dso-case-study new-field sync points

The `dso-case-study` block is **template-only** (not a freely AI-pickable block —
absent from generate-page.ts AVAILABLE BLOCKS and generate-microsite.ts
BLOCK_PROP_SCHEMAS). Its content arrives via templates, then the AI copy-rewrite
pass + the post-processing guards shape it. When the block gains a new
prose/structured field (e.g. the repeatable `sections[]`), update EVERY surface
or the field silently misbehaves:

1. Renderer `BlockDsoCaseStudy.tsx` — render it.
2. Builder `PropertyPanel.tsx` `case "dso-case-study"` — editor controls.
3. `fillDsoCaseStudyNeutralDefaults` (generate-page.ts) — normalize/neutral-fill
   the field so a malformed AI value can't leak. Keep additive: legacy blocks
   that omit the field must stay byte-identical (the existing defaults test
   asserts `toEqual(props)`).
4. `enforceApprovedCaseStudies` strict mode (generate-page.ts, both the
   approved-source branch AND the no-approved branch) — blank unapproved
   long-form prose / quotes while keeping structural headings. This guard is
   shared with the microsite path via `enforceDsoSuccessStoriesApproved`.

**Already generic (no per-field edit needed):**
- `scanForUnapprovedStats` recurses arrays/objects → catches new stat fields.
- The HTML color copy-rewrite `walk` recurses arrays → covers new string fields.

**Why:** these two enumeration functions hand-list challenge/solution/whyItMatters
and previously omitted `sections[]`, so unapproved invented prose in extra
sections would have shipped in strict (Strict Facts) mode.

**How to apply:** when adding any dso-case-study field, grep `dso-case-study` in
artifacts/api-server/src/routes/lp/generate-page.ts and hit both functions above,
plus the renderer + PropertyPanel in lp-studio.
