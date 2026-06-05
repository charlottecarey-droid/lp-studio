---
name: Dandy Insights vs AI Scan Review (DSO generation)
description: Two distinct Dandy products with dedicated blocks; the generic LP generator must keep them separate and gate Insights on the Dandy tenant.
---

"Dandy Insights" (network analytics dashboard) and "AI Scan Review" (scan-QA
feature) are TWO DISTINCT Dandy products, each with its own block(s):
Insights → `dso-insights-dashboard` / `dso-insights-video`; AI Scan Review →
`dso-ai-feature`. The model habitually collapses them, relabeling an
AI-Scan-Review block as "Dandy Insights".

**Rule:** In the generic generator (marketing "Create New Page" + account-less
microsite path), anything Dandy-specific — the Insights blocks, the anti-relabel
prompt rule, and the eyebrow-reset guard — must be conditional on the Dandy tenant.
Resolve the tenant via `isProtectedEnterpriseSlug(slug)` from `@workspace/plan-config`,
NOT a literal `slug === "dandy"`.

**Why:** Non-Dandy tenants must never see Dandy markers — the dso-branding
neutrality test asserts no `\bDandy\b` leaks for non-Dandy, so any Dandy content
appended unconditionally breaks that contract and mislabels products.

**How to apply:** A new Dandy-only DSO block needs (1) prompt advertisement gated on
the Dandy tenant, (2) inclusion in the force-dark set if it hard-renders white copy,
and (3) no name leak into the non-Dandy branch. A prompt rule alone is not enough for
relabeling — back it with a deterministic post-process guard.

**Related dark-background rule:** ALL `dso-*` blocks hard-render white text, so the
airy-minimal "force everything white" pass must skip every `dso-*` block (this was
the white-on-white hero bug, not just dso-problem). Image-overlay heroes
(`full-bleed-hero` / `parallax-image-hero`) need a minimum overlay opacity clamp so
light text stays legible over the photo.
