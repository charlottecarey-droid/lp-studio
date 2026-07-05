---
name: Phrase-highlight hero <highlight> tag leak
description: Why heroes with a separate highlight-word/phrase prop leak literal <highlight> markup, and the layer to fix it.
---

Heroes that gradient/mark ONE word or phrase inside the headline do it via a
SEPARATE prop (launch-spotlight-hero `highlightWord`, dso-heartland-hero /
challenger-insight `highlightPhrase`) whose prompt contract is "a word/phrase
copied VERBATIM from the headline". The headline itself is supposed to stay
plain text; the renderer finds the prop's substring and styles it.

The model does not reliably obey: it also injects `<highlight>WORD</highlight>`
markup INTO the headline text (and often sets the prop too). The substring-find
renderer then styles WORD but renders the literal `<highlight>`/`</highlight>`
tags in the surrounding text — visible raw markup on the published hero.

**Rule:** strip the tags at RESOLVE time in the renderer (where the headline is
read into a local), not deep inside the marking helper — so BOTH the published
render AND the inline editor's InlineText use the cleaned text. When the prop is
unset, adopt the wrapped phrase as the highlight target. Use `??` (not `||`) for
the prop so an author-cleared `""` still means "no highlight".

**Why:** resolve-time fix covers already-generated/legacy pages on next render
(no regeneration needed) and keeps the editor clean; a prompt-only "don't add
tags" rule is unreliable (same lesson as generate-page's post-processing guards).

**How to apply:** launch-spotlight-hero is fixed. dso-heartland-hero and
challenger-insight (`highlightPhrase`) share the same contract and are likely
susceptible — apply the same resolve-time strip if the leak is reported there.
Stored data keeps the tags until re-saved; that's fine because the strip is at
display time. A server-side sanitize in generate-page copy-clean would also keep
STORED headlines clean, but is optional given the renderer covers display.
