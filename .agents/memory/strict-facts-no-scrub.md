---
name: Strict Facts keeps stats (no scrub)
description: Why generate-page.ts scans for unapproved stats but no longer rewrites them
---

Strict Facts Mode no longer scrubs AI-generated stats. The model's original
values stay on the page; unapproved ones are only *surfaced* for review in the
existing builder modal (`removedQuotesOpen`/`strictMismatches`), where editors
can push the real numbers into the approved pool.

**Why:** the inline placeholder ("X") swap was disruptive — it broke published
pages with visible gaps. The agreed UX is review-not-remove: same modal, but the
page keeps the AI's values.

**How to apply:**
- Both strict callsites in `generate-page.ts` run `scanForUnapprovedStats`
  (computes/returns `strictMismatches`) + per-block `enforceApprovedCaseStudies`
  + `stripAiInlineColors`. There is NO `sanitizeBlocksStrict` anymore — do not
  re-add a stat-rewrite step.
- `scanForUnapprovedStats` is intentionally read-only telemetry; if you see it
  and wonder "why scan but not act?", that's the design.
- Case-study hard-enforcement (`enforceApprovedCaseStudies`,
  `enforceDsoSuccessStoriesApproved`) is a SEPARATE, still-active guarantee —
  unrelated to the stat-scrub removal. Keep it.
- Frontend var names still say "scrubbed/removed" (`showScrubbedSummary`,
  `unapprovedScrubbedCount`, `removedQuotesOpen`) — only user-facing copy was
  updated to the review framing.
