---
name: LP block builder-vs-published render divergence
description: Why inline-color-picker HTML and CSS-var color overrides render correctly in the builder but break on the published page
---

LP blocks render the SAME field through DIFFERENT components depending on edit vs published mode (`onFieldChange ? <InlineText…> : <SomeAnimatedComponent…>`). The builder path (InlineText) and the published path do not share rendering behavior, so bugs are invisible until publish.

The inline color picker wraps selected text in `<span style="color:#XXX">…</span>` (sanitize-inline-html allows SPAN style color/font-size/font-weight). This HTML is stored verbatim in the field value (e.g. a stat value or bullet becomes HTML). Two recurring failure modes:

**1. Animated/plain published components dump the HTML as literal text.**
- Symptom: published page shows raw `<span style="color: #FFFFFF">96%</span>` as visible text ("renders as code"); builder looks fine.
- Cause: builder uses InlineText (renders HTML via dangerouslySetInnerHTML when `isLikelyHtml`); the published component (e.g. StatCounter) treats the whole string as plain text.
- Fix: the published component must be HTML-aware — detect with `isLikelyHtml`, strip tags for its own logic (StatCounter parses/animates the number), and re-apply the editor's chosen color (extract the innermost valid `color:` — invalid fragments like `#0` are skipped). `WordReveal` (headline/body scroll reveal) is now HTML-aware centrally: when `isLikelyHtml(text)` it renders the sanitized HTML statically (color/bold/links honored, `brightColor` as base) and SKIPS the per-word animation — fixing every WordReveal callsite at once (dso-ai-feature headline+body, bold-statement). Plain text still animates.
- **Why:** any field an editor can recolor must be HTML-aware on BOTH render paths, not just InlineText; fixing the shared animated renderer (WordReveal) once is better than patching each block.

**2. CSS-var color overrides don't reach framer per-word color animation.**
- The block wrapper sets `--blk-headline-color` from `blockSettings.headlineColor`; index.css applies it `!important` to `h1/h2/h3`. The builder headline (InlineText inside the h2) inherits it → correct color. The published headline (WordReveal) paints per-word `<motion.span>` whose color comes from `useTransform([start,end],[dimColor,brightColor])`.
- Symptom: headline shows the override color on first paint (inherited from the h2 CSS var) then FLIPS to `brightColor`/`fg` after framer hydrates ("lime in builder, dark green when published" / "light then dark").
- Cause: framer `useTransform` CANNOT interpolate a CSS variable, so brightColor must be a concrete color; it was `fg`, which resolves dark because `backgroundStyle` defaults to `"muted"` (light) even when the actual bg is overridden dark via `--blk-bg`.
- Fix: pass the concrete `block.blockSettings?.headlineColor` hex down from BlockRenderer to the block and use it as WordReveal `brightColor` (fall back to `fg` when absent). Do NOT pass `var(--blk-headline-color,…)` — framer can't interpolate it.
- **Why:** `fg` is computed from the `backgroundStyle` PROP, which can disagree with the real rendered background when `--blk-bg`/blockSettings override it; never assume `fg` matches what the user sees.

**How to apply:** when a block field supports the inline color picker (or any rich text) and has a non-InlineText published renderer, verify the published path on a real published page — typecheck/builder won't catch it. `settings`/`fg` derived from props may not reflect blockSettings CSS-var overrides.
