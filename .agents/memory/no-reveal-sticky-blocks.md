---
name: NO_REVEAL must cover internally-sticky blocks
description: Why blocks with internal position:sticky (or 100vh*N scroll containers) must be in BlockRenderer's NO_REVEAL set, or published pages break while the builder looks fine.
---

Any block whose internals rely on `position: sticky` (a pinned panel/image) or a
tall `height: items*100vh` scroll container MUST be added to the `NO_REVEAL` set
in `artifacts/lp-studio/src/blocks/BlockRenderer.tsx`.

**Why:** On published/linked pages the scroll-reveal wrapper is a framer-motion
`motion.div` that applies a CSS `transform`. A transformed ancestor becomes the
containing block for its descendants, which **breaks `position: sticky`** inside
the child. Symptoms on published pages only: the sticky panel is stranded, and
for tall scroll containers the block collapses into a large whitespace gap that
pushes following blocks (including the page's footer block) far down — which gets
mis-reported as a "duplicate/second footer under the whitespace." The builder is
unaffected because it renders blocks WITHOUT the reveal motion.div wrapper, so
the bug is invisible while authoring.

**How to apply:** When adding or auditing a block, grep its component for
`sticky` / `h-screen` / `100vh`. If present, ensure its exact block-type string
is in NO_REVEAL and add it to `BlockRenderer.no-reveal.test.ts`. Known members of
this class: `dandy-switchback` (tall 100vh*N), `dandy-vertical-tabs`,
`roi-calculator`, `dso-practice-nav`. Note `dandy-vertical-tabs` uses an
`items-start` grid so its breakage mis-positions the image rather than making a
huge gap; the huge-gap symptom is the switchback 100vh*N pattern.

The LP viewer's hardcoded `<footer>` (legacy DTR/variant return path) is NOT a
second footer source for published builder/linked pages — that path renders no
page blocks, so it never co-renders with a `footer` block. Don't chase a footer
code fix for the "duplicate footer" report; it's the whitespace artifact.
