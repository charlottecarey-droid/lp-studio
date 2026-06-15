---
name: Marketing hero prompt → app builder handoff contract
description: How the public homepage hero prompt reaches the app's AI create flow, and why swapping the hero component silently breaks it.
---

The public marketing homepage ("/") hero has a prompt textarea + "Generate
page" button. Submitting must navigate to the APP with the brief in the URL:
`https://app.lpstudio.ai/pages?new=ai&prompt=<encodeURIComponent(brief)>`
(empty brief → `/pages?new=ai`). Navigation is a hard `window.location.href`
(the app is a separate host, not in-SPA routing).

**The full chain (verbatim keys):**
- Writer: the hero component (`AssembleScene.tsx` `submitHero`, and now
  `PromptCard.tsx` `submitHero`) builds the `?new=ai&prompt=…` URL.
- Auth bridge: `components/AuthGate.tsx` captures
  `window.location.pathname + window.location.search` as the OAuth `next`, so a
  logged-OUT visitor lands back on the same `/pages?new=ai&prompt=…` after
  sign-up — the prompt survives account creation.
- Reader: `pages/pages-gallery.tsx` reads `prompt` + `new=ai` from the URL and
  passes them into `CreatePageModal` (`initialAiPrompt`), which seeds its textarea.

**Why this breaks silently:** the hero component gets visually re-skinned
periodically (AssembleScene → PromptCard "v3 editorial hero"). A new card can
look complete while its form `onSubmit` is a no-op and its CTA is a static
`<a href="https://app.lpstudio.ai">` with NO query params — a dead end. Every
other link in the chain is untouched, so nothing errors; the prompt just never
arrives.

**How to apply:** whenever the homepage hero/prompt component is swapped or
rebuilt, re-port `submitHero` (the `?new=ai&prompt=…` navigation) into the new
component. The CTA must execute that navigation (submit button or onClick), not
be a bare link to the app root. Keep the param names `new=ai` and `prompt`
exactly — the reader matches them literally.
