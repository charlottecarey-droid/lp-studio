---
name: LP generate-page block selection directive
description: Why the "AI picks the same hero/trust-bar/PAS every time" fix is brand-MATCHING across ALL roles, not randomization
---

# LP generate-page block selection

Complaint: the AI page generator (`/lp/generate-page`) "picks the same hero, and
the same trust-bar and PAS, every time." Root cause is prompt anchoring — the
AVAILABLE BLOCK TYPES menu lists the plainest block of each kind FIRST, so even
at temp 0.9 the model keeps choosing those defaults. Block Catalog `ai_enabled`
only makes other variants *eligible*; it does not change which one the model
prefers.

**Fix = deliberate brand-fit selection, NOT random rotation, applied to EVERY
block role.** The user explicitly rejected randomizing block choice and asked for
the logic to cover all blocks (hero, social proof, trust-bar, PAS/content, CTAs,
features, etc.). The directive (`buildBlockSelectionDirective` in
`generate-page.ts`) harvests the blocks advertised for THIS path
(`extractPromptBlockTypes` + `resolveBlockTags` + per-industry `dbTagsByType` —
same pipeline as the role-tag guide, so it stays catalog-synced), groups them by
role, and for every role with >1 option lists the variants and tells the model to
pick the one whose style best matches the brand (BRAND CONTEXT), the reference
URL/screenshot, and the prompt — never defaulting to the first/same block, never
random.

**Why / key decisions:**
- **List each block under EVERY role it fills, not a single "primary" role.**
  `sanitizeRoleTags` reorders per-industry override tags by the global vocabulary
  order, so "first resolved tag" is NOT authoritative for overridden blocks — a
  dual-role block (e.g. `trust-bar` = social-proof + stats) could be misbucketed.
  Listing it under both roles is order-independent and a more complete options
  list. **How to apply:** if you ever bucket blocks by role elsewhere, do NOT
  rely on `tags[0]` for overridden blocks.
- **Skip the `layout` role.** Pure structural primitives (section/columns/grid/
  stack/spacer) are scaffolding, not a brand choice; layout-combo blocks still
  surface under their content/feature/etc role.
- **Role/category ORDER is superadmin-controlled, not hardcoded.** The directive
  orders its per-role lines by the block_catalog `sort_order` column (the same
  field that sorts the builder library, `ORDER BY sort_order ASC`): a role sorts
  by the LOWEST sort_order among the blocks that fill it. generate-page loads
  `dbSortByType` from the same per-industry catalog query and passes it in.
  Blocks with no override use the column default (0), so when nothing is
  customized every role ties and falls back to a natural hero-first flow
  (`SELECTION_ROLE_FALLBACK_ORDER`). **Why:** the user asked superadmin to own
  the order rather than baking it in code. **Gotcha:** a dual-role block drags
  EVERY role it fills (e.g. `stat-backed-final-cta` is cta+stats, so lowering its
  sort_order moves BOTH cta and stats), since each role takes the min over its
  members.
- Deterministic; returns "" when no role has a real choice.
- It is prompt guidance only. `enforceRequiredRoles` can still inject a plain
  fallback block when a required role is missing — expected, not randomness.
- Contrast with the **microsite** generator, which solves the same "same hero"
  problem via a post-processing pass (see `dandy-microsite-hero-variability.md`),
  not a prompt directive. The sales microsite path was left out of scope here.
