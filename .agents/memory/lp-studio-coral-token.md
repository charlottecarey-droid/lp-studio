---
name: LP Studio coral token (app vs marketing)
description: Which CSS var to use when asked to make app UI "LP Studio coral".
---

When asked to style app (dashboard/builder/settings) UI in "LP Studio coral":

- App coral = `--accent-warm` (HSL `11 75% 60%`, defined in
  `artifacts/lp-studio/src/index.css`), with `--accent-warm-strong`
  (`11 78% 38%`) = darker coral reserved for SMALL TEXT so it clears WCAG AA on
  the cream/white canvas. `--accent-warm-foreground` is white.
- Use via Tailwind arbitrary values exactly like existing app code does:
  `bg-[hsl(var(--accent-warm))]`, `text-[hsl(var(--accent-warm-strong))]`, and
  for tints `bg-[hsl(var(--accent-warm)/0.10)]` (slash-alpha stays INSIDE the
  brackets so Tailwind doesn't read it as an opacity modifier).
- The coral is a "spark" — used sparingly for live/positive/attention moments,
  not a flood.

**Marketing site is different:** `artifacts/lp-studio/src/marketing/marketing.css`
defines `--coral: #E26B4F` / `--coral-soft`. Don't use the marketing token in the
app and vice-versa.
