---
name: Hero secondary-CTA url-mode routes to primary URL
description: Cross-hero platform quirk — a url-mode secondary CTA on a published hero navigates to the PRIMARY cta URL, not its own.
---

Every split/hero block that renders primary + secondary CTAs via the shared
`CtaButton` gets a single `onCtaClick` from `BlockRenderer`'s render case, wired as
`onCtaClick ? () => onCtaClick(resolveCtaUrl(block.props)) : undefined`.
`resolveCtaUrl(block.props)` always resolves the **primary** cta fields. Both the
primary and the secondary `CtaButton` (in plain `url` action mode) fire that same
host `onClick`, so on published pages a **url-mode secondary CTA navigates to the
primary's URL**, not its own `ctaSecondaryUrl`.

**Why:** it's shared by `editorial-split-hero`, `ai-scan-hero`, and every hero using
this pattern. Modal actions (chili-piper/form-modal/video-modal) are unaffected —
`CtaButton` suppresses the host onClick and handles those internally; only plain
`url` mode leaks to the primary.

**How to apply:** don't treat this as a per-block bug when adding a new hero — it's
pre-existing parity behavior. A real fix is platform-wide: pass a secondary-aware
click handler (resolve `ctaSecondaryUrl` for the secondary button) from BlockRenderer
to each hero, or have CtaButton self-navigate in url mode instead of delegating.
