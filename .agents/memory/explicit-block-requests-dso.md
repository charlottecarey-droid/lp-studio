---
name: Explicit block requests on DSO pages
description: Why "vary the mix" prompt guidance silently drops user-requested DSO blocks, and the two-layer fix pattern.
---

# Explicit block requests must override "vary the mix"

When a DSO system prompt's block-selection rule tells the model to "vary the mix, never a fixed template", the model will deprioritize and silently DROP specialized topical blocks the user explicitly asked for (e.g. Dandy Insights → `dso-insights-dashboard`/`dso-insights-video`, AI Scan Review → `dso-ai-feature`) — even though those blocks are still advertised in the prompt, renderable, and `ai_enabled`. The symptom is "it used to use that block whenever I asked and now never does, no matter what." This is model deprioritization, NOT vocab/catalog stripping.

**Why:** any variety/anti-repetition directive competes with honoring explicit requests; without an explicit override clause the model treats variety as the higher priority.

**How to apply (two layers — prompt alone is unreliable):**
1. Prompt: every block-selection rule needs an "EXPLICIT REQUESTS OVERRIDE VARIETY" clause, plus a shared "REQUESTED SECTIONS ARE MANDATORY" directive right after the USER REQUEST is pushed (covers all generation paths). For Dandy, the rule21 product-disambiguation note must also be MANDATORY-when-requested.
2. Deterministic safety net: a pure exported helper that re-scans the prompt and injects the requested block if missing, wired AFTER the normalize `.map` and BEFORE the image-fill pass (so injected image-bearing blocks get filled). Keyword detection must be CONSERVATIVE — require explicit product-intent phrasing ("dandy insights", "insights dashboard", "ai scan review"), never a bare "insights"/"ai"/"benchmark" substring, or it injects unrequested blocks. Gate to the path where the blocks are advertised (Dandy enterprise DSO: `isDandyTenant && useDso`; the practices prompt does NOT advertise insights/ai-feature). Insert before the trailing CTA run so hero stays first / CTA last; leave `imageUrl:""`.
