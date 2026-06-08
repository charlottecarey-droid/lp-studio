---
name: AI block-catalog filtering is line-level
description: Why the superadmin "Available to AI generation" (block_catalog.ai_enabled) filter must strip prompt block entries line-by-line, and that DSO paths need filtering at the callsite.
---

The superadmin "Available to AI generation" toggle (`block_catalog.ai_enabled`) is honored by removing disabled block entries from the assembled AI system prompt in `generate-page.ts`.

**Rule:** filter the prompt LINE-BY-LINE (each block entry is a line matching `/^- "([a-z0-9-]+)":/`, drop it plus its continuation lines up to the next block line or blank line), via `stripAiDisabledBlockLines`. Fail-open on an empty disabled set.

**Why:** several block entries are packed into ONE blank-line paragraph — notably the showcase hero cluster (magazine / cinematic-video / aurora-gradient / editorial-split / parallax-layers / spotlight-glow heroes). The earlier paragraph-level filter only inspected each paragraph's FIRST line, so disabling a non-first cluster member did nothing and disabling the first over-dropped its siblings.

**How to apply:**
- The GENERAL builder injects every block then line-strips before returning.
- The DSO + DSO-Practices builders return hardcoded block lists and do NOT self-filter; the `/lp/generate-page` callsite wraps the whole prompt ternary in `stripAiDisabledBlockLines` so every path is filtered (re-stripping the general prompt is idempotent). If you add a new prompt-builder branch, it is covered automatically by that callsite wrap — don't reintroduce per-branch filtering.
- Continuation-line dropping assumes block bullets are followed by indented/EXAMPLE lines and separated by blank lines. If a future template appends unrelated prose directly after a block bullet with no blank line, that prose would be dropped when the block is disabled — keep a blank line between a block entry and any following non-block prose.
