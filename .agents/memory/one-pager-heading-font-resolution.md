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

**Why:** brands with no resolvable heading font must keep built-in helvetica on
Pilot/Comparison/New Partner/ROI section headings. The Agreement Summary is the lone
exception that calls `ensureBagoss` unconditionally (always bundled Bagoss everywhere).

**MAIN HEADER TITLE exception (Dandy only):** the four generators now force bundled
Bagoss on the MAIN HEADER title ONLY (not section headings) when `opts.brand.isDandy`.
Dandy ships no embeddable font, so it can't arrive via `fonts.heading`; the header uses a
separate resolver computed AFTER `hasBrandHeading`:
`headerTitleHasBrand = hasBrandHeading || (opts?.brand?.isDandy === true && ensureBagoss(doc))`,
then `headerTitleFont`/`headerTitleStyle` swapped into ONLY the main header `setFont`.
- Ordering matters: `hasBrandHeading` is read before this `ensureBagoss`, so section
  headings stay helvetica for Dandy (only the header title flips).
- LEAK GUARD: never call `ensureBagoss` for non-Dandy — short-circuit on `isDandy===true`.
  A non-Dandy tenant without `fonts.heading` keeps helvetica; Bagoss is Dandy's font and
  must never render on another tenant's header.
- `BrandContext.isDandy` is excluded from `DEFAULT_BRAND_CONTEXT`/`resolveBrand` via
  `Omit<..., "fonts" | "isDandy">`. lp-studio's `sales-one-pager.tsx` keeps Dandy's
  `brandContext === undefined` (no font-fetch/scrub) but threads `{ isDandy: true }` into
  `effectiveBrandContext` (both override + no-override branches).

**How to apply:** non-header true headings (section headings) switch to `headingFont`;
body copy, stat values, table cells, and small uppercase labels stay helvetica. The
font-embed test (`onePagerFontEmbed.test.ts`) relies on ROI embedding no `FontFile2` when
no brand/fonts supplied — keep that invariant (bundled Bagoss gated strictly on isDandy).
