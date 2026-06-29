---
name: Card-surface contrast on brand/dark sections
description: Why always-carded section blocks must resolve a concrete solid card surface instead of trusting useSectionTheme.cardBg
---

Section blocks rendered as "cards" must NOT rely on `useSectionTheme`'s `cardBg`
for guaranteed visibility. On a dark or brand-colored section (luminance < 0.4 →
`resolveSectionSurface` marks `isDark=true`), `cardBg` falls back to a translucent
`rgba(255,255,255,0.05)` "lift" that is effectively invisible — the card vanishes
and the section looks full-bleed/standalone.

For any block that must ALWAYS show a distinct card (e.g. BigFeatures big
horizontal cards), resolve a CONCRETE solid card surface locally:
`cardBgColor` override else `#FFFFFF`, then derive `cardInk` / `cardMuted` /
`cardAccent` against THAT surface via `pickContrastingColor` / `contrastTextColor`
(from `@/lib/brand-config`). Do not read `theme.cardInk`/`theme.cardBg` for these.

**Why:** an orange brand section washed the BigFeatures cards into invisibility;
the user saw full-bleed orange "standalone" sections with no visible cards.

**How to apply:** any new always-carded section block. Don't trust `theme.cardBg`
on dark/brand sections. Also note the per-card CTA (`SectionCtas`) still resolves
its button color against the SECTION surface, not the white card — usually fine
(dark/brand button on white is visible), but if a tenant brand makes the CTA
disappear on a white card, pass a card-surface-aware theme to that `SectionCtas`.

Related design rule for these 9 graduated blocks: the section header is ALWAYS
centered and the section-level bottom CTA is centered; the editable `align` prop
scopes ONLY to the copy inside each card/item (via
`alignItemsClass`/`alignTextClass`), never the section chrome.
