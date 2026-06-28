---
name: BlockEventPage hero dark-scrim tone
description: Why the self-contained event-page hero resolves its own dark-surface text inks instead of using the flat theme palette.
---
The event-style template library renders via `BlockEventPage.tsx`, which uses its
own `EventPageTheme` (NOT BrandConfig, no brand prop). Its hero ALWAYS paints
over a cover photo (fallback `/event-assets/hero-provo.jpg`).

**Rule:** the hero text area must be treated as a DARK surface regardless of the
theme palette. `resolveTheme` computes a `heroScrimBase` (theme `bg` when already
dark, else `#0b0b0f`), lays the overlay gradient from THAT (not `m.bg`), and
resolves hero inks via `pickContrastingColor(themeColor, heroScrimBase, [lightFallbacks], 4.5)`
into `heroHeading`/`heroEyebrow`/`heroTagline`; the CTA label contrasts the fixed
warm-gold fill `#b59a6e` (not `C.bg`). The hero JSX must use these `hero*` fields,
NOT `C.heading`/`C.primary`/`C.muted`/`C.bg` — reverting any of them repaints dark
ink on a dark photo (invisible) for light/imported themes.

**Why:** a light/imported theme = light bg + dark heading/accent; the old code
washed the photo with the light theme-bg and painted dark text → invisible hero
copy. Using the theme bg as scrim base when dark keeps the default dark "Inside
Dandy" hero byte-identical (its colors already clear AA on `#0c0f12`), so no
regression. Non-hero sections still use the flat theme palette on solid bgs.

**Guard:** `BlockEventPage.contrast.test.ts` SSR-renders the hero with unique
ASCII markers (eventName also appears in the sticky nav, so pin the headline
lookup to `<h1>`) and asserts each hero ink clears WCAG AA against the recomputed
scrim base, for both a light theme and the default dark theme.
