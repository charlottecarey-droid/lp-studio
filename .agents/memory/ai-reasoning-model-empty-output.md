---
name: AI reasoning model empty output
description: gpt-5-* reasoning models under a tight token budget return EMPTY content; project standard is gpt-4o for copy/SEO chat-completion endpoints
---

Rule: LP Studio chat-completion AI endpoints (copy-generate, generate-page,
seo-meta-generate, etc.) use a **non-reasoning** model — the project standard is
`gpt-4o`. Do NOT switch these to a reasoning model (gpt-5 / gpt-5-mini /
gpt-5-nano / o-series) while keeping a small `max_completion_tokens`.

**Why:** Reasoning models spend the token budget on internal reasoning before
emitting any output. `seo-meta-generate` ran `gpt-5-mini` with
`max_completion_tokens: 256`; reasoning consumed the whole budget, the chat
`message.content` came back empty, the `JSON.parse` fell back to `"{}"`, and the
endpoint returned empty `metaTitle`/`metaDescription`. The builder "Auto-fill
all" button (AutoMetaButton in BuilderEditor.tsx) swallows errors silently, so
it just populated nothing — reported by the user as "SEO auto-populate not
working." No server error was logged because nothing threw.

**How to apply:** Default new/edited AI chat endpoints to `gpt-4o` to match every
other endpoint. If a reasoning model is genuinely required, give it a much larger
`max_completion_tokens` (thousands, to cover reasoning + output) AND verify
`message.content` is non-empty before trusting it. Watch for any frontend caller
with a silent `catch` that hides the empty/failed response.

**Bulk-swap incident (the bigger blast radius):** a commit titled "Upgrade LLM
model from gpt-4o-mini to gpt-5-mini" swapped ~14 cheap-extractor call sites
(brand-import extractors: colors/typography/buttons/photography/structure/
content/voice; imageAutoTag; storage image-classification; extract-guests;
proof-points-import) to `gpt-5-mini` in one shot. Most had tiny budgets (storage
20, several 200, photography 500) and silently returned empty — degrading brand
import and image auto-tagging the same way SEO broke. Resolution: reverted all of
them back to `gpt-4o-mini`. **Standard for these cheap structured-JSON/vision
extractor tasks is `gpt-4o-mini`** (non-reasoning), `gpt-4o` for copy/SEO. Do NOT
"upgrade" extractors to a gpt-5 reasoning model — it's not a drop-in; it needs a
much larger budget and adds latency/cost for marginal benefit on extraction.
(Pre-existing `gpt-5` full-model uses in dso/index.ts, sales/person-brief.ts,
sales/draft-email.ts each have a gemini-2.5-flash fallback and were not part of
the swap — leave them.)
