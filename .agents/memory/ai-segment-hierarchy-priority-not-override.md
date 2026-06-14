---
name: AI segment-hierarchy = priority, not absolute override
description: Why the segment-vs-brand-core messaging directive must say "leads/takes priority" and never "OVERRIDES / NON-NEGOTIABLE / do not use core lines"
---

The AI copy generators frame segment vs brand-core messaging with a "MESSAGING
HIERARCHY" directive. It must read **"the segment LEADS and takes priority, but
still draw on the brand's core authority/proof/pillars for supporting copy"** —
NOT an absolute **"segment OVERRIDES core / NON-NEGOTIABLE / do NOT use core
lines."**

**Why:** an absolute-override phrasing starves the model of brand depth (segment
context is much thinner than full brand context) → thin, repetitive landing-page
and microsite copy. A June 2026 batch shipped the absolute wording and caused a
visible copy-quality regression.

**How to apply:** the directive lives in FOUR mirrored spots — keep them in sync:
- `generate-microsite.ts`: `buildSegmentSection` block + `buildSystemPrompt`
  CONTEXT PRIORITY item 1.
- `generate-page.ts`: `buildSegmentSection` mirror + `buildBrandContext`
  CONTEXT PRIORITY item 1.

The anti-leak controls are SEPARATE and must stay intact — do not soften these to
fix copy: per-segment `avoidPhrases` DO-NOT-USE lines, persona precedence, the
"don't center on off-segment core lines" clause, and the segment-conflict
"prefer segment data" rule. Tests `generate-microsite.segmentHierarchy.test.ts`
and `generate-page.copy-context.test.ts` assert the hierarchy wording — they
check `LEADS` / `leads and takes priority`, not `OVERRIDES`.
