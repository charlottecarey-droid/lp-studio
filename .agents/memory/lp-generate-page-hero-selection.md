---
name: LP generate-page hero/proof selection directive
description: Why the "AI picks the same hero every time" fix on the page generator is brand-MATCHING, not randomization
---

# LP generate-page hero/proof selection

Complaint: the AI page generator (`/lp/generate-page`) "picks the same hero (and
trust-bar) every time." Root cause is prompt anchoring — the AVAILABLE BLOCK
TYPES menu lists the plain `hero`/`trust-bar` defaults FIRST, so even at temp 0.9
the model keeps choosing them. Block Catalog `ai_enabled` only makes other
variants *eligible*; it does not change which one the model prefers.

**Fix = deliberate brand-fit selection, NOT random rotation.** The user
explicitly rejected randomizing the hero. The directive
(`buildHeroProofSelectionDirective` in `generate-page.ts`) enumerates the
hero-tagged and proof-tagged blocks advertised for THIS path (same
`extractPromptBlockTypes` + `resolveBlockTags` + per-industry `dbTagsByType`
harvest the role-tag guide uses, so it stays catalog-synced) in deterministic
prompt order, and instructs the model to pick the block whose style best matches
the brand personality (BRAND CONTEXT), the reference URL/screenshot, and the
topic — and to NOT reflexively default to the plain block. No shuffle, no rng.

**Why:** same brand + same reference should steer to the same on-brand block;
randomness would churn and is the opposite of what the user wants.

**How to apply / invariants:**
- Keep it path-scoped (derive candidates from the active system prompt only) so
  DSO paths only suggest DSO heroes.
- Only emit a line when there's a real choice (`>1` hero / `>1` proof);
  otherwise return `""`.
- It is prompt guidance only. `enforceRequiredRoles` can still inject a plain
  `hero`/`trust-bar` as a deterministic fallback when a required role is missing
   — that's expected, not a bug, and not randomness.
- Contrast with the **microsite** generator, which solves the same "same hero"
  problem via a post-processing pass (see `dandy-microsite-hero-variability.md`),
  not a prompt directive. The sales microsite path was left out of scope here.
