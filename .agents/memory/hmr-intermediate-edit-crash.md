---
name: HMR intermediate-edit crash looks like a missing feature
description: Sequential edits to a hot-reloaded lp-studio block can ship a broken intermediate module; user sees the block blanked by BlockErrorBoundary and reports the feature "missing".
---

Vite HMR applies each file save immediately. When a block redesign is done as
several sequential edits (e.g. swap an icon import first, rewrite the body
after), the intermediate module can reference a removed identifier and crash.
Blocks render inside BlockErrorBoundary, so the crash silently blanks the
section — the user reports "you didn't add X" rather than an error.

**Why:** dso-faq redesign — user checked the preview between the import edit
and the body edit; console showed `[BlockErrorBoundary] "dso-faq" block failed
to render: {}` at HMR timestamps that predate the final edit. Final code was
fine; nothing needed fixing beyond a reload.

**How to apply:** when a user reports a just-edited block feature missing or a
block gone blank, FIRST compare browser-console error timestamps against the
`[vite] hot updated` lines before hunting a code bug — if the last error
predates the last hot update of that file, it's the transient state; restart
the web workflow / hard-refresh and re-verify. A fast SSR smoke test
(renderToStaticMarkup + stub browser-only leaves, per
BlockFullBleedHero.contrast.test.ts) proves the final module renders.
