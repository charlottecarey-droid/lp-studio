---
name: Recipe freestyle override for off-topic requests
description: Why off-topic AI page/microsite requests need an explicit freestyle clause, and the mandatory-bullet trap that silently defeats it.
---

# Recipe freestyle override for off-topic requests

Page/microsite "recipes" are SALES/MARKETING archetypes that are ROTATED per
generation (deterministic hash over page inputs), never matched to the actual
request. So an off-topic ask ("about us", careers, contact, FAQ, policy) — or a
reference URL/screenshot that isn't a sales page — gets dragged into an
irrelevant proof/conversion layout.

The fix is prompt-only: a shared `RECIPE_FREESTYLE_OVERRIDE_CLAUSE` telling the
model to judge fit and DISCARD the recipe/flow + freestyle sections+content for
off-topic requests. It is injected in three spots that must stay in sync:
`buildRecipeDirective` (landing pages), `injectRecipeIntoBlockSelection` (DSO
system-prompt path), and the microsite neutral-freeform footer.

**Why a softer override kept failing — the mandatory-bullet trap.**
A generic "explicit user requests override the recipe" line already existed and
did NOT stop the drift, because the same freeform prompt ALSO carried an
absolute bullet ("include at least one proof/metrics section … and a closing
CTA"). An unconditional MANDATORY instruction silently beats a conditional
"freestyle when off-topic" clause via prompt anchoring. The proof/CTA bullet had
to be made conditional ("for a sales/marketing page … does NOT apply when the
freestyle rule takes over").

**Why:** prompt anchoring — a hard "always include X" rule out-weighs a softer
"ignore the recipe when off-topic" rule sitting nearby, so the model keeps the
sales structure.

**How to apply:** if you re-tighten any "must include proof/features/CTA" rule,
or weaken/move the freestyle clause, you will silently regress off-topic pages.
Keep the clause and the CONDITIONAL bullet consistent across every freeform
prompt fragment. Scope is neutral-freeform only — segment-pool / DSO / template /
outline paths intentionally never see the clause (locked by tests).
