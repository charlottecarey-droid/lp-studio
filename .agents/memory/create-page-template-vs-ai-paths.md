---
name: create-page Template vs AI Generate paths
description: Why "AI didn't customize my template copy" reports are usually clone-path confusion, not a generation bug.
---

The Create Page modal (`artifacts/lp-studio/src/pages/pages-gallery/create-page-modal.tsx`) has three tabs: **Template**, **AI Generate**, **Start with Brief**. Default tab is `Template`.

- **Template** tab = verbatim clone. It creates the page with the template's design AND wording exactly as-is (`handleCreate` → `onCreate`, carries `fromTemplateId`). NO AI rewrite happens. There is no generate-page call and therefore no strict/banned/critique telemetry.
- **AI Generate** tab = AI rewrite. Its "Starting Point" dropdown ("Use a template (AI fills copy only)") sets `aiTemplateId`; the server `generate-page` route preserves block structure and rewrites copy to the prompt.

**Why this matters:** user reports of "I started from template X and the AI didn't customize the copy — works on some templates, not others" are almost always path confusion (they used Template/clone for the one that "failed" and AI Generate for the ones that "worked"), NOT a generation/merge bug.

**How to verify it's NOT a generation bug:** the AI template path is sound and merges correctly. Confirmed by reproducing the generate-page rewrite against a live template (TRIOS 5 = `lp_pages` id 272): gpt-4o rewrote 32/73 top-level string fields, replacing all brand-specific copy. The deterministic merge starts from template props and overlays AI props only for keys already present, skipping technical fields (url/color/id/anchor/href/src).

**How to reproduce a generation against a live template without auth:** standalone node script in `artifacts/api-server`, run with `node --env-file-if-exists=../../.env`, query Neon directly via `pg` (NEON_DATABASE_URL), build system+user prompt, call OpenAI with `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`.
