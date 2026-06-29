---
name: Builder canvas needs container queries, not viewport breakpoints
description: Why section-block responsive grids look cramped/distorted in the LP Studio page builder and how to fix it
---

Section/feature blocks whose responsive grids use Tailwind **viewport** breakpoints
(`sm:grid-cols-2 lg:grid-cols-3`) look cramped/distorted in the LP Studio builder.

**Why:** the builder page canvas (`data-lp-page` / `data-lp-builder`, a `max-w-5xl`
div in BuilderEditor) renders the REAL block DOM at the narrow canvas width, but
viewport media queries key off the (wide) browser window — so the grid forces the
desktop column count (e.g. 3) into a sliver. Blocks with an absolutely-positioned
floating caption (BlockFeaturePhotoCards: caption `left-4 right-10`) are hit worst —
the leftover text width collapses to a few characters per line. This is NOT image
distortion (`object-cover` is correct); it is a layout-width mismatch.

**How to apply:** wrap the grid in an `@container` div and use container-query
column variants so columns track the ACTUAL rendered width. Tailwind v4 has
container queries in core (no plugin). Faithful map of the old viewport breakpoints:
`@xl:grid-cols-2` (≥576px) and `@4xl:grid-cols-3` (≥896px); the `@container` wrapper
sits inside `max-w-7xl px-6`, so at full desktop it is ~1232px → stays 3 columns on
the published page; tablet → 2; mobile → 1. (`@4xl` flips to 3 cols ~128px earlier
than the old `lg:` 1024px viewport bp — acceptable, and better in the builder.)

Sibling section blocks (BlockFeatureCardGrid, BlockValuePillars*, etc.) still use
viewport breakpoints — same latent issue; convert only when a user reports it.
