---
name: AI segment directive = additive emphasis, never an override
description: Why the segment-vs-brand-core directive must frame the brand as the CONSTANT foundation and the segment as ADDITIVE emphasis — never "leads/takes priority" or "OVERRIDES/NON-NEGOTIABLE/do not use core lines"
---

The AI copy generators must frame segment vs brand-core messaging as a **constant
brand foundation + additive audience emphasis**: every page/microsite/segment
keeps the SAME brand voice, copy examples, proof, and products; the segment layer
only **adds emphasis on what is different** for that audience. It must NOT cast
the segment as taking over.

Two phrasings have both failed and must never come back:
1. **Absolute override** — "segment OVERRIDES core / NON-NEGOTIABLE / do NOT use
   core lines / which take precedence."
2. **Priority/leads** — "MESSAGING HIERARCHY: the segment LEADS and takes
   priority over the brand's core/default messaging," "prefer the segment data."
   This was the June 25 2026 "fix" and it did NOT work — "leads and takes
   priority" still reads to the model as an override.

**Why:** any priority/override framing starves the model of brand depth (segment
context is far thinner than full brand context) → thin, repetitive, off-brand
copy that stops sounding like the core brand. The goal is the opposite: a segment
page must still sound like the core brand, just with added emphasis.

**How to apply — the additive framing (mirrored, keep all in sync):**
- Labels: **"CONSTANT BRAND FOUNDATION"** and **"ADDITIVE AUDIENCE EMPHASIS"**.
- `buildSegmentSection` (both `generate-microsite.ts` and `generate-page.ts`):
  directive header is **"ADDITIVE AUDIENCE EMPHASIS — READ FIRST"** (em-dash,
  unique to this section). Use imperative verbs (emphasize / foreground), NOT
  precedence language. Drop "prefer the segment data."
- CONTEXT PRIORITY preamble (both `buildSystemPrompt` in generate-microsite +
  `buildBrandContext` in generate-page): ordered **1 brand foundation, 2 account
  research, 3 additive segment**; the segment line uses **"ADDITIVE AUDIENCE
  EMPHASIS:"** (colon form, NOT the em-dash header).
- Core/segment value-prop lines and doc-comments reworded to match.

**Anti-leak controls are SEPARATE — keep intact, do not soften to fix copy:**
per-segment `avoidPhrases` DO-NOT-USE lines and persona precedence are the real
leak guards (NOT the override wording). `generate-page.ts` line ~7957
(voice > reference) and persona "take precedence" lines (~2484 / ~7326) stay.

**Tests:** `generate-microsite.segmentHierarchy.test.ts` and
`generate-page.copy-context.test.ts` assert the additive wording AND negatives —
`not "MESSAGING HIERARCHY"`, `not /leads and takes priority/`, `not "not core
lines"`, `not "which take precedence"`. Empty/core-path tests assert
`not.toContain("ADDITIVE AUDIENCE EMPHASIS — READ FIRST")` (the em-dash header),
because the preamble always contains the colon form.
