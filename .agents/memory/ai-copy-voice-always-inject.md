---
name: AI copy endpoints — voice + brief must always inject
description: Brand voice and active campaign brief belong in every AI copy prompt; never gate them behind a colors/fonts toggle. Use the shared brand-and-brief builder.
---

Brand voice profile and the active campaign brief are the two highest-signal inputs for any "make this copy on-brand" call (block refresh, Sparkle field rewrite, custom-block generation, SEO meta). They must be injected into the system prompt on **every** call.

**Why:** A previous design gated brand context on a `useBrandVars` dialog toggle that was really meant for colors/fonts/approved-facts. When designers turned it off (which they often did, to keep neutral block visuals while testing copy), the AI silently lost the voice profile and produced generic catalog output. SEO meta had the same failure mode — it was loading only `brandName + productKeywords` and ignoring the per-page brief entirely, so every page got the same brand-level boilerplate description.

**How to apply:**
- Any new LP Studio AI copy endpoint must call `fetchBrand` + `buildBrandSystemPrompt` + `buildBriefContextPrompt` from `artifacts/api-server/src/lib/ai-prompts/brand-and-brief.ts`. Do not roll a local brand prompt — the shared builder reads BOTH the legacy flat voice fields (`toneOfVoice`, `toneKeywords`, `avoidPhrases`, `copyExamples`, `messagingPillars`, `productLines`) AND the structured `voiceProfile.profile.*` block (`tone[]`, `formality`, `sentenceLengthAvg`, `vocabularyRegister`, `signaturePhrases`, `forbiddenPhrases`, `summary`). A custom builder will inevitably drop one or the other.
- Gates like `useBrandVars` are fine for visual/factual concerns (colors, fonts, approved-facts pool) but must NEVER gate voice or brief.
- FE callsites must thread `getBriefContext()` from `@/lib/brief-context` so the active brief reaches the endpoint. Forgetting this on a new dialog reintroduces the same bug invisibly (endpoint accepts `briefContext` optionally, so missing thread = silent generic output).
- For page-scoped endpoints (SEO meta, page summary), order is **page content → brief → brand voice**, not brand-first. Brand is the voice wrapper, not the topic.
- Wrap the OpenAI call in `withOpenAIConcurrency` (the brand-import semaphore, n=3) so concurrent Sparkle clicks don't stampede the proxy.
- Emit one `logCopyCall(...)` per request (success AND every error branch including JSON-parse failures). The `briefPresent` field is what makes "why is this output generic?" debuggable after the fact.

**Smell test for a new copy endpoint:** if the system prompt builder doesn't take a full `LpBrandSettingsRow` and a `BriefContext`, it's wrong. Refactor to the shared builder before shipping.
