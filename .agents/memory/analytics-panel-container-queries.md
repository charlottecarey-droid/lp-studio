---
name: Analytics panels need container queries, not viewport breakpoints
description: Why inner grids in page-detail's lg:grid-cols-2 analytics section must use @container query variants
---

The page-detail analytics section (artifacts/lp-studio/src/pages/page-detail.tsx)
renders its panels (Conversion Score, Page Speed, Traffic Sources, A/B Tests,
Programmatic Variables, Ad Map) inside a `grid grid-cols-1 lg:grid-cols-2` parent.

**Rule:** Any multi-column grid INSIDE one of these panels must use Tailwind v4
container-query variants (`@container` on a wrapper + `@sm:`/`@2xl:`/`@3xl:`
column counts), NOT viewport breakpoints (`md:`/`lg:`).

**Why:** At ≥1024px viewport the parent becomes 2-col, so each panel is only
~half the screen. A viewport `md:grid-cols-4` then crams 4 padded cards into that
half-width, so labels wrap and values collide ("Impressions0", "Clicks/session151.7").
Viewport breakpoints can't see that the available width shrank — only container
queries respond to the panel's own width.

**How to apply:** Tailwind v4 is in use (`@import "tailwindcss"`), so container
queries are built in — no plugin needed. Put `@container` on the panel root and
size columns off it. Useful thresholds for a half-width (~480px) vs full-width
(~960px) panel: `@sm`=384px, `@2xl`=672px, `@3xl`=768px. The Conversion Score
metrics row uses `grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-4` (2-up at half
width, 4-up only when the panel is full width).
