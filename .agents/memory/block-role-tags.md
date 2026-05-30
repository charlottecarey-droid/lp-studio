---
name: Block role tags (semantic vocabulary)
description: Where the block role-tag vocabulary lives, how it resolves, and the AI-generator coupling that can silently break it.
---

# Block role tags

Semantic role tags (hero, header, footer, stats, social-proof, cta, features,
comparison, pricing, faq, form, content, media, layout) describe what
structural role each LP block fills. They are **advisory metadata only** — no
render impact.

## Single source of truth
The controlled vocabulary AND the per-block code defaults live in exactly one
place: `lib/lp-template-engine/src/block-tags.ts` (`BLOCK_ROLE_TAGS`,
`DEFAULT_BLOCK_TAGS`, `resolveBlockTags`, `sanitizeRoleTags`). Every consumer
(block-registry post-pass, superadmin UI, api-server routes, AI generator)
imports from `@workspace/lp-template-engine`. Never re-declare the vocab
anywhere else.

**Why:** the requirement is ONE shared vocabulary; drift between copies would
desync the AI prompt from the editable catalog.

## Resolution order
DB override wins over code default, but only when non-empty/valid:
`resolveBlockTags(type, dbTags)` → `sanitizeRoleTags(dbTags)` if it yields ≥1
valid tag, else `getDefaultBlockTags(type)`. An empty/null/garbage override
never blanks a block's role. Per-industry overrides are stored in
`block_catalog.tags text[]` (migration 0037), edited in superadmin Block
Catalog.

## AI-generator coupling (fragile — watch this)
The page generator builds the role-tag prompt section by parsing the **chosen
system prompt string** for block bullets of the form `- "type":`. It tags only
those advertised blocks.

**Why it matters:** if a system prompt ever lists its allowed blocks in a
different format (no `- "type":` bullet), the extractor returns nothing and the
entire role-tag guide silently disappears from the prompt with no error (the
build is best-effort and swallows failures). If generated pages stop reliably
including hero/footer/cta, check this parsing still matches the prompt's block
list first.

## Gotcha when auditing coverage
`DEFAULT_BLOCK_TAGS` keys that are valid JS identifiers are written unquoted
(`hero: ["hero"]`), the rest quoted (`"full-bleed-hero": [...]`). A
`"key":` regex audit will false-positive ~12 "missing" types — all 129 are in
fact covered.
