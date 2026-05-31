---
name: jsPDF fill-color byte encoding
description: How jsPDF bakes colors into PDF content streams, for byte-level color assertions on one-pager generators
---
# jsPDF fill-color encoding in PDF bytes

When asserting baked-in colors of a generated one-pager PDF (the `@workspace/one-pager-types` generators), parse the raw latin1-decoded bytes for color operators:

- **Fill** colors (`setFillColor` → `rect`/`roundedRect`/`circle`) emit an `r g b rg` operator with each channel = `value/255` at **2-decimal** precision, trailing zeros stripped (e.g. `0` → `"0."`, `40/255` → `"0.16"`). Dandy green `[0,40,32]` → `"0. 0.16 0.13 rg"`; lime `[163,190,60]` → `"0.64 0.75 0.24 rg"`.
- **Text** colors (`setTextColor`) also use `rg` but at **3-decimal** precision — so you cannot tell fill from text by the operator alone, only by precision.
- Streams are **uncompressed by default**, so operators appear as plain text in the bytes.
- jsPDF emits grayscale `g` (not `rg`) when r==g==b, so pure white/black fills won't match an `rg` search.

**Why:** the palette unit test (`resolvePalette === DANDY_PALETTE`) only guards the resolver, not that generators actually draw with those colors or that they survive into bytes.

**How to apply:** in a render-level color guard, HARDCODE the known-good brand RGB literals (not derived from `DANDY_PALETTE`) so a change to the palette constant can't move expectation and bytes together and hide a regression. See `artifacts/lp-studio/src/lib/pdf-dandy-palette-render.test.ts`. Vitest swallows `console.log` here — write debug output to a file instead.
