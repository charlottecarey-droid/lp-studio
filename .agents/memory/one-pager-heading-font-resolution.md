---
name: One-pager heading-font resolution
description: How sales one-pager PDF generators decide whether headings render in the brand heading font vs the built-in helvetica.
---

All sales one-pager generators (`lib/one-pager-types/src/generators.ts`) resolve a brand
heading font the same way the Agreement Summary does:

- After `registerBrandFonts(doc, opts?.brand)`, detect a usable brand heading via
  `const hasBrandHeading = !!(doc.getFontList?.() ?? {})["Bagoss"]`.
- `registerBrandFonts` only registers/overrides the `"Bagoss"` face when
  `brand.fonts.heading` is supplied, so its presence in the font list is the signal.
- Headings use `headingFont = hasBrandHeading ? "Bagoss" : "helvetica"` and
  `headingStyle(builtin) => hasBrandHeading ? "normal" : builtin` (Bagoss only ships a
  "normal" face; preserve the original built-in weight in the fallback).

**Why:** brands with no resolvable heading font (e.g. Dandy) must keep the current
built-in fonts on Pilot/Comparison/New Partner/ROI. The Agreement Summary is the lone
exception that calls `ensureBagoss` unconditionally (so it always draws bundled Bagoss);
the other four generators must NOT call `ensureBagoss`, or Dandy would wrongly get Bagoss
headings.

**How to apply:** only true headings (main title/headline + section headings) switch to
`headingFont`; body copy, stat values, table cells, and small uppercase labels stay
helvetica. The font-embed test (`onePagerFontEmbed.test.ts`) relies on ROI embedding no
`FontFile2` when no fonts are supplied — keep that invariant (no unconditional Bagoss).
