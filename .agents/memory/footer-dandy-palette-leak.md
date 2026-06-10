---
name: Footer Dandy palette leak
description: Why non-Dandy tenant footers sometimes render Dandy forest green, and the de-brand guard that fixes it.
---

AI-emitted footer blocks pass their `backgroundColor`/`accentColor` straight through to the renderer (`BlockFooter` uses `props.backgroundColor || var(--brand-primary)`). When the model emits Dandy palette literals — forest `#003A30` / lime `#C7E738` — a non-Dandy tenant footer renders Dandy green instead of falling back to the tenant brand var.

**Two leak paths, both must be guarded:**
- Sales microsite generator: its footer prompt spec literally instructed `backgroundColor: "#003A30"`. Fixed the spec to leave it empty AND strip leaked literals in the footer normalize/merge case.
- LP page generator: AI-emitted footer blocks. A shared `deBrandFooterColors(block)` (gated to footer type) strips Dandy literals via `isDandyPaletteLiteral`, run over all blocks before footer-injection.

**Why de-brand is tenant-agnostic (no `isDandy` branch):** stripping the literal to `""` makes the footer fall back to the brand CSS var, which for the real Dandy tenant resolves to those same colors — so no Dandy regression. The page generator's *injected* (non-AI) Dandy footer remains explicitly Dandy-branded on its own path.

**How to apply:** any new AI-generated block whose color props are passed through verbatim is a candidate for the same leak; never let a brand-specific palette literal live in a shared prompt spec. If recurrence appears with alternate encodings (`#003A30FF`, `rgb(0,58,48)`), normalize before comparison in `isDandyPaletteLiteral`.
