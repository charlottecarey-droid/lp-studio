---
name: Microsite recipe hero overridden by hardcoded literal hero
description: Why generated microsites ignored the recipe's specific hero and opened with the plain neutral `hero`, and the rule for keeping recipe heroes intact.
---

# Microsite recipe hero overridden by hardcoded literal `hero`

On the neutral-freeform microsite path (`generate-microsite.ts` `buildSystemPrompt`,
`useFreeform && !hasOutlineFixedList` branch), the selected page recipe's opening
hero (e.g. `full-bleed-hero`, `ai-scan-hero`) is presented to the model ONLY as a
soft "STARTING SUGGESTION to adapt." The recipe's `full-bleed-hero OR hero` slots
are already resolved deterministically by `resolveRecipeSkeletonSlots`, so the
recipe hero is concrete — but the model still opened every microsite with the plain
neutral `hero`.

**Root cause:** two prompt spots named the *literal* `hero` block type as THE
opener, as hard rules that outrank the soft recipe suggestion:
1. The freeform LAYOUT footer line: `Open with EXACTLY ONE "hero" block (first)`.
   Quoted `"hero"` = exact type string (same convention as `"dso-heartland-hero"`).
2. `FREEFORM_ROLE_HINTS["hero"]` in `microsite-block-vocab.ts` (rendered into the
   AVAILABLE BLOCKS guide): `hero — opens the page; exactly ONE, always first`.

**The rule:** the recipe hero is a suggestion, not enforced. So ANY prompt rule
that names the plain `hero` type as "the" / "always first" opener will win and the
recipe hero is silently dropped. Keep every structural opener rule hero-type-AGNOSTIC
("open with EXACTLY ONE hero-type block; when the flow names a specific hero use
THAT type; don't fall back to the plain hero"). Never let a hard rule name the
literal `hero` as the opener while the recipe is only a suggestion.

**Why:** independently documented in the `resolveRecipeSkeletonSlots` comment —
"Left to the model, alternatives collapse to one favorite via prompt saturation —
verified on microsites where every account drew the same hero." The deterministic
OR-resolution fixed slot rotation, but the leftover literal-`hero` prompt rules
re-introduced the same collapse.

**How to apply:** the structural "exactly one hero first / footer last" guarantee
is still enforced by the LAYOUT footer + downstream passes (`MICROSITE_HERO_BLOCK_TYPES`
covers `hero`/`full-bleed-hero`/`ai-scan-hero`, so anchor derivation,
`upgradeMicrositeHero`, and `enforceSectionBgRhythm` all handle recipe heroes).
Scope: neutral-freeform (recipe) path only — the segment-pool branch's identical
literal `"hero"` open rule is intentional (that path receives no recipe), and DSO
branches already name their recipe heroes (`dso-heartland-hero`/`dso-practice-hero`).

**Chosen behavior (user):** default to the recipe hero but keep flexibility — the
`RECIPE_FREESTYLE_OVERRIDE_CLAUSE` still lets non-sales pages (about-us/contact/FAQ)
ignore the flow and pick a simpler hero. This is a prompt-only nudge with no
deterministic post-parse coercion; if plain-hero drift persists, the durable
escalation is to coerce the first block to the resolved recipe hero post-parse,
gated off when the freestyle/non-sales override applies.
