---
name: Insights-dashboard theme must follow section surface
description: Why the dso-insights-dashboard block washed out, and the rule for any block that themes its inner content separately from its section background.
---

The `dso-insights-dashboard` block washed out (near-white text + glass cards on a
light/muted section, or the reverse) because its INNER dashboard theme was driven
by a standalone `dashboardVariant` prop (`getTheme(dashboardVariant)`), decoupled
from `backgroundStyle` (the outer `<section>` surface). The microsite
layout-variability pass randomizes `dashboardVariant` independently of
`backgroundStyle`, so a "dark" dashboard routinely landed on a light section.
Tell-tale: the header (eyebrow/headline/subheadline) rendered correctly because it
already derived its color from the resolved section surface (`isDark`), while only
the dashboard mockup followed the rogue variant.

**Rule:** when a block paints both an outer section surface AND inner content with
their own theme, derive BOTH from one source of truth — the resolved section
background — never from two independent props that can disagree. Here the fix was
to compute `isDark` from `resolvedBackgroundStyle` and use
`getTheme(isDark ? "dark" : "light")`; `dashboardVariant` now only seeds the
section bg in the empty-`backgroundStyle` fallback.

**Why:** a render-layer coupling fixes every already-saved page with no republish
and no data migration, and it's robust to whatever the AI/variability generator
writes into the (now-mostly-redundant) variant prop.

**How to apply:** grep the block for every consumer of the standalone variant
(there was a second one — a date-dropdown bg) and switch them all to the
surface-derived `isDark`. Backend prompt schemas + the editor's variant control
still exist but only matter when no `backgroundStyle` is set; cleaning those up is
a separate, optional follow-up.
