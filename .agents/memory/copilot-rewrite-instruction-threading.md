---
name: Copilot rewrite_copy instruction threading
description: The Builder Copilot's rewrite_copy "instruction" must reach /lp/copy-generate refresh, or an explicit user refinement is silently dropped and regenerates the same copy.
---

The Builder Copilot ("Ask AI" panel) only PROPOSES a `rewrite_copy` action carrying
`{blockId, field, instruction}`. The actual new copy is generated later, on Apply,
through a SEPARATE path: BuilderEditor's `rewrite_copy` case → `refreshBlockCopy`
(lib/copy-api.ts) → `POST /lp/copy-generate` with `action:"refresh"`.

**Rule:** the copilot's `instruction` must be threaded through ALL THREE of those
layers, or it is silently dropped and the refresh just regenerates generic on-brand
copy — repeating the exact wording the user asked to change.

**Why:** a Dandy hero ("Rest easy with our sleep apnea care") read patient-facing.
Dandy sells to DENTISTS, so the user told the copilot "this sounds like it's for
patients not dentists". The copilot proposed the right instruction, but Apply called
`refreshBlockCopy(type,[field],{...})` with no instruction, and the refresh action
had no instruction handling — so it produced the same patient-facing headline again.

**How to apply:** if you touch the copilot apply path or the copy-generate refresh
action, keep `instruction` flowing: optional param on `refreshBlockCopy` → request
body → refresh handler reads/sanitizes (`trim`, cap length) and injects it as the
highest-priority directive in BOTH system and user prompts. The directive must
explicitly permit audience/angle reframing (who the copy speaks to) while preserving
the factual topic + concrete specifics, and must NOT override strict-facts stat
guards (post-gen `isApprovedStat` still enforces those). The no-instruction inspector
refresh path must stay byte-compatible (instruction optional everywhere).
