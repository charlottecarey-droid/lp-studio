---
name: Microsite page-outline hard override
description: When a segment/brand page outline drives a microsite, which post-generation passes must be gated off so the outline's block/category order is authoritative.
---

# Microsite page-outline hard override

In `artifacts/api-server/src/routes/sales/generate-microsite.ts`, when a segment
or brand "page outline" is active (`outlineActive` — block source is
`segment-outline`/`brand-outline` AND the outline filtered to >=1 allowed block),
the outline's resolved block order + types are AUTHORITATIVE. The model only
supplies copy.

**The rule:** every post-normalization pass that can ADD, REMOVE, or REORDER
blocks must be gated OFF when `outlineActive`. The block set is produced once by
`reconcileBlocksToOutline` (buckets AI blocks by canonical type, walks the outline
in order, consumes first-unused AI block per type keeping props/id, synthesizes a
neutral default for omitted slots, drops off-outline extras). After that, leave the
list alone. Currently gated off under `outlineActive`: `enforceRequiredRoles`,
freeform chrome injection (`ensureMicrositeNavbar`/`upgradeMicrositeHero`), and
`pruneEmptyContentBlocks`. The prompt side mirrors this: `buildSystemPrompt`'s
DSO/pool/freeform branches are guarded by `!hasOutlineFixedList` so an outline
configured on a DSO/pool segment still emits the fixed ordered list. Passes that
only mutate styling (e.g. `enforceSectionBgRhythm`, background-style/legibility
passes) are EXEMPT — they never add/remove/reorder blocks.

**Why:** the prune in particular is the silent trap. On an outline page,
`reconcileBlocksToOutline` has already dropped everything off-outline (incl.
case-study blocks excluded for lack of approved studies — those are filtered out
of `authoritativeOutlineBlockList` BEFORE both prompt and reconcile). So every
surviving block IS a configured slot; `pruneEmptyContentBlocks` can then ONLY
delete an authored slot (e.g. a thin/synthesized testimonial/stats/products-grid),
which breaks the outline's hard ordering. It can never remove a stray empty
section, because there are none left to remove.

**How to apply:** before adding ANY new pass after `normalizeBlock` in the
microsite route, ask "can this change the block set or its order?" If yes, gate it
on `!outlineActive`. Scope is MICROSITES ONLY (architect-confirmed) — `lp/generate-page`
is a separate generator and is NOT part of this override.

**Known unreached edge (intentionally not handled):** if an outline is configured
but EVERY block is excluded (an outline of only case-study/noai blocks, no
structural hero/footer), `authoritativeOutlineBlockList` is empty → `outlineActive`
false → legacy freeform fallback, but the DSO safety clamp (gated on
`useDsoFreeform`) won't run while `buildSystemPrompt` may emit a DSO freeform
prompt. This is pre-existing (not introduced by the override work) and practically
unreachable (hero/footer are never excluded), so the delicate freeform-clamp path
was left untouched to avoid regressions.
