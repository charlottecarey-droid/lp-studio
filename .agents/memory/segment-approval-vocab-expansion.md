---
name: Segment-approval block vocab expansion
description: How superadmin "approved_segments" tags expand (never clamp) AI block vocab in both generators
---

Superadmin Block Catalog rows carry `approved_segments text[]`. Tagging a block for a
segment EXPANDS that segment's AI-generation block vocabulary — it is a UNION on top of
the curated DSO/freeform vocab, never a strict clamp/allow-list restriction.

**Why:** The feature was explicitly approved as additive ("approved blocks expand a
segment's allowed vocab"), so the generators must never narrow the base vocab when a
segment has zero approved blocks.

**How to apply:**
- The expansion query filters fail-closed in BOTH generators:
  `industry match AND ai_enabled=true AND is_enabled=true AND segmentId = ANY(approved_segments)`,
  then canonicalizes types (lib/ai-prompts/block-aliases). DB error → empty set (no expansion).
- `=ANY($scalar)` with a parameterized scalar is safe; do NOT expand a JS array into it
  (that's the IN-tuple form). See drizzle-any-array-not-in.md.
- Microsite (generate-microsite.ts): union approved types into the prompt guide
  (appendApprovedBlockGuideLines → buildFreeformBlockGuide / buildDsoFreeformBlockGuide)
  AND into the post-generation allow-set in BOTH validation branches, or the hard filter
  strips the just-advertised extra.
- generate-page.ts: prompt-level only — it has NO strict post-generation DSO type clamp,
  so injecting the extra into the prompt is sufficient for it to survive to output. DSO /
  DSO-practices paths lift the extra block's canonical description out of
  buildGeneralSystemPrompt via extractGeneralBlockBullets and advertise it under an
  "ADDITIONAL APPROVED BLOCKS" section, and the trailing "use only DSO block types"
  directive is softened ONLY when injection occurs (else prompt self-contradicts).
- The GENERAL generate-page path is intentionally left unchanged: it already advertises
  every ai_enabled block, so there is nothing to expand.
- Client must send the segment id in the generate-page payload (SegmentContext.id) or the
  expansion can't resolve which segment to match.
