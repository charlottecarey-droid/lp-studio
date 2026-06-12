---
name: Brand-import font matching (Typekit slugs + script-accent fonts)
description: Why AI brand-import font detection collapses to system Arial / picks a cursive heading, and the two-layer fix.
---

# Brand-import font matching

When AI brand-import "stops matching fonts" (every tenant looks the same / generic),
suspect TWO compounding failures in `artifacts/api-server/src/lib/brand-import`:

1. **Role assignment crowns a decorative accent font.** `assignRoles`
   (extractors/typography.ts) picks the heading as the candidate with heaviest
   loaded weight (>=600). Brand sites load a Google script/handwriting font
   (Caveat, Pacifico, Dancing Script…) at weights 500/600/700 for a tiny accent,
   while the *real* brand font arrives weightless from Typekit/@font-face — so the
   accent wins the H1. Fix: `SCRIPT_FONT_RE`/`isScriptFontFamily` excludes script
   faces from heading/body (like the existing mono exclusion), with a degenerate
   fallback so a script-only site still surfaces something.

2. **Adobe/Typekit primary fonts have no loadable Google fallback.** Typekit
   families arrive as hyphen slugs ("adelle-sans", "proxima-nova"). `matchFont`
   (font-catalog.ts) `normalizeFamily` only lowercases/trims — it never collapsed
   hyphens — so slugs missed both the direct Google lookup AND the space-keyed
   `HANDWRITTEN_FALLBACKS`, fell through to `custom-manual` with
   `googleFontUrl: null`, and rendered as system Arial. Fix: a de-hyphenated
   lookup probe across direct/typo/handwritten stages + ~20 common Adobe→Google
   substitutes in `HANDWRITTEN_FALLBACKS`.

**Why it renders:** the substitute can be any Google family (not just lp-studio's
curated ~25 picker fonts) because the orchestrator stores `displayFontUrl` and
lp-studio `BrandFontLoader` injects that URL verbatim. So matchFont only needs to
emit a non-null `googleFontUrl` for the font to actually load.

**How to apply:** any future "imported font is wrong/generic" report — check
(a) is the real font a Typekit slug missing from HANDWRITTEN_FALLBACKS, and
(b) is a script/decorative font outranking it in assignRoles. Repro by scraping the
site's typekit css (`use.typekit.net/<id>.css`) for the real `font-family`.
Reference case: televerde.com (adelle-sans real font, Caveat accent).
Tests: brand-import/font-matching.test.ts.
