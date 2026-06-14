---
name: Critique-pass timeout fails open silently
description: Why banned/cliché phrases ship despite the corrective critique pass existing
---

The two-pass copy corrective in `artifacts/api-server/src/lib/ai-prompts/critique-pass.ts`
detects banned phrases (core clichés + each tenant's own `avoidPhrases`) and
rewrites the worst 1-2 blocks. It runs on BOTH generate-page paths (template +
freeform). When it does not remove detected phrases, the cause is almost always
that the rewrite call **timed out and failed open**, not a detection gap.

**Why:** the rewrite is a real gpt-4o JSON call that runs behind the shared
`generateOpenAISemaphore`, so its timeout budget must cover queue-wait + model
round-trip. The original `DEFAULT_TIMEOUT_MS` was 3000ms — far too short — so the
pass aborted nearly every time and shipped the phrases it was meant to strip
(e.g. a tenant's own "streamline"/"unlock"/"discover" leaking onto the page).
Raised to 12000ms.

**How to apply:** if banned/cliché copy ships despite being in the logs as
detected (`source:brand`/`source:core`), check the critique timeout vs. the
semaphore queue depth before touching the main creative prompt. The corrective
pass only rewrites ~2 blocks (`maxBlocks=2`, deliberately — raising it re-risks
the "bare blocks" reductive regression), so it is NOT a page-wide voice fix.
`buildVoiceContext` feeds the rewrite tone + keywords + `copyExamples` (gold
standard "write in this voice") + `messagingPillars`; callsites pass the full
`BrandConfig`. Do not churn the main `buildBrandContext` creative prompt — that
churn is what caused the original voice regression.
