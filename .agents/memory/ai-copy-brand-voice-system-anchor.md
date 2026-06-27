---
name: AI copy brand-voice system-prompt anchor
description: When full-page AI copy reads generic/identical across tenants, anchor brand voice in the SYSTEM prompt — don't churn the user-prompt brand context
---

**Rule:** rich brand voice in the USER prompt alone is not enough to stop full-page AI copy from reading generic and identical across tenants. The large structural SYSTEM prompt (block catalog + density doctrine + neutral SaaS example copy) is weighed heaviest, so the model anchors on its generic examples. The brand must ALSO be named at the TOP of the system prompt.

**Why:** The superadmin reported generic, same-for-every-tenant copy despite rich saved voice data and a comprehensive user-prompt brand context. There was no single-line regression — the system prompt simply had no brand identity, so example-style anchoring won.

**How to apply:**
- Strengthen PRIORITY/placement, stay ADDITIVE. Do NOT churn or over-tighten the user-prompt brand context, and do NOT widen the 2-pass critique (both are documented regression sources → "bare blocks"/thin copy).
- A short brand-voice anchor prepended once, before recipe injection, covers all generation paths uniformly. Frame the prompt's example copy as structure-only and demand visibly different copy per brand. Fail neutral (empty) for blank tenants.
- Brand fields can come from brand-import (semi-trusted scraped text) → normalize (strip control chars/newlines, cap length + item count) before interpolating into a prompt.
- Use "takes priority over the generic examples", NOT "OVERRIDES" — the OVERRIDES warning is about segment-vs-brand-core, a different axis.
- copyExamples (the brand's REAL marketing lines) are the strongest voice lever — promote them INTO the anchor too (a "WRITE IN THIS VOICE" line), not only tone/voice cues. Stay additive + capped/sanitized, and the anchor's empty-guard must also check examples.length (a brand with only examples should still produce an anchor).

**Diagnostic:** the code_execution sandbox has NO DB env. To read prod Neon read-only, run a node script via `node --env-file-if-exists=.env <script.mjs>` from repo root (gitignored `.env` is wired to prod); import pg by its full `.pnpm` path. Never print the connection string.
