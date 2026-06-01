---
name: generate-page nav/footer auto-injection
description: AI-page nav/CTA/footer is force-injected server-side after generation, so prompt-only "don't add X" rules don't take effect without a matching post-processing guard.
---

The LP AI page generator (api-server `routes/lp/generate-page.ts`) does NOT trust
the model to produce a complete page: after parsing the AI's blocks it runs a
"guarantee nav, final CTA, and footer" post-processing pass that unconditionally
prepends a nav-header (or dso-practice-nav), inserts a bottom-cta/dso-final-cta,
and appends a footer when each is missing.

**Why it matters:** any instruction telling the model NOT to emit some chrome
(e.g. "full-page templates already have a built-in nav and footer, don't add a
separate one") is silently undone by this pass. Editing only the system prompt
(Rule 14 / block schemas) is necessary but NOT sufficient — the server will
re-add the duplicate chrome regardless of what the model did.

**How to apply:** when changing what chrome a generated page should/shouldn't
have, edit BOTH the system prompt AND the post-processing guards. Self-contained
full-page blocks that render their own nav AND footer (content-series,
blog-series, storefront) are gated via `isSingleFullPageBlock(blocks)` — a single
such block skips all three injections. event-page / business-case render their
own nav but NO footer, so they are deliberately excluded (they still need a
footer). nav-strip/self-nav hero handling lives in the same pass (SELF_NAV_TYPES:
hero, full-bleed-hero, dso-heartland-hero).
