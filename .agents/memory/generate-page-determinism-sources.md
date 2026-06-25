---
name: generate-page perceived-randomness sources
description: The independent randomness knobs that make AI landing-page generation "feel random" run-to-run, plus the pickRecipe fallback to preserve when making recipe choice deterministic.
---

**Rule:** "Pages feel random / the same prompt gives a different page each run" in `generate-page.ts` is NOT one bug — it is the sum of independent randomness sources that must be addressed together:
1. sampling **temperature** on the chat-completion calls,
2. **Math.random** seeds feeding image-fill bucket rotation (`buildReferenceFillPool`),
3. the block-sequence **repeat guard** that regenerates the WHOLE page to force it to differ from recent ones,
4. **recipe selection** (`pickRecipe` mixes recency + Math.random).

Lowering temperature alone still leaves the page visibly shuffling.

**Why:** the determinism rollout had to neutralize all four. A deterministic seed = `lpHashSeed` over stable page inputs (tenantId, slug, segment name, prompt; recipe uses `promptPath::segment::intentTemplate`). Same page inputs → same output; different pages still differ.

**How to apply:**
- Reuse `lpHashSeed` for any "deterministic per page" seed; do NOT reintroduce `Math.random` in these paths.
- If you replace `pickRecipe` with a deterministic index, PRESERVE its all-excluded fallback: when every recipe is excluded, drop ONLY `excludeRecipeIds[0]` (not the whole exclusion list), then fall back to the full pool only if THAT is still empty. Skipping this lets "Shuffle layout" immediately reselect a recipe the caller just asked to avoid.
- The repeat guard is disabled behind a `boolean` flag (kept for easy re-enable), not deleted; its functions stay referenced so nothing goes unused.
- Model is intentionally pinned to `gpt-4o` (the proxy serves it reliably; gpt-5* return empty — see ai-reasoning-model-empty-output). A model swap needs a concrete proxy-served string, never a guess.
