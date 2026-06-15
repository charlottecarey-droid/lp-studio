---
name: AI copy brand-voice system-prompt anchor
description: When full-page AI copy reads generic/identical across tenants, anchor brand voice in the SYSTEM prompt — don't churn the user-prompt brand context
---

**Rule:** rich brand voice in the USER prompt alone is not enough to stop full-page AI copy from reading generic and identical across tenants. The large structural SYSTEM prompt (block catalog + density doctrine + neutral SaaS example copy) is weighed heaviest, so the model anchors on its generic examples. The brand must ALSO be named at the TOP of the system prompt.

**Why:** Charlotte reported generic, same-for-every-tenant copy despite rich saved voice data and a comprehensive user-prompt brand context. There was no single-line regression — the system prompt simply had no brand identity, so example-style anchoring won.

**How to apply:**
- Strengthen PRIORITY/placement, stay ADDITIVE. Do NOT churn or over-tighten the user-prompt brand context, and do NOT widen the 2-pass critique (both are documented regression sources → "bare blocks"/thin copy).
- A short brand-voice anchor prepended once, before recipe injection, covers all generation paths uniformly. Frame the prompt's example copy as structure-only and demand visibly different copy per brand. Fail neutral (empty) for blank tenants.
- Brand fields can come from brand-import (semi-trusted scraped text) → normalize (strip control chars/newlines, cap length + item count) before interpolating into a prompt.
- Use "takes priority over the generic examples", NOT "OVERRIDES" — the OVERRIDES warning is about segment-vs-brand-core, a different axis.

**Diagnostic:** the code_execution sandbox has NO DB env. To read prod Neon read-only, run a node script via `node --env-file-if-exists=.env <script.mjs>` from repo root (gitignored `.env` is wired to prod); import pg by its full `.pnpm` path. Never print the connection string.
