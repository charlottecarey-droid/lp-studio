---
name: Marketing global heading-color trap
description: Marketing site forces all h1–h6 to var(--ink) (dark indigo); a heading on a dark/custom background goes invisible unless it sets its own explicit color.
---

# Marketing global heading-color trap

The marketing stylesheet sets a global element rule `h1, h2, … h6 { color: var(--ink) }`
(--ink ≈ #25214D, a dark indigo). A heading that sets font/size/margin inline but
*omits* `color` silently picks up that dark ink — even when it lives inside a `<div>`
that set a light `color`, because a global element rule beats inherited color.

**Why:** A hardcoded-background marketing component (the BuilderEmbed page-builder
demo's dark-navy "Speakers" section, bg #11181f) rendered its `<h2>` dark-on-dark and
invisible — the h2 had every style but `color`, so the global rule painted it.

**How to apply:** Any heading placed on a dark or custom (non-cream) background inside
a marketing component MUST set an explicit `color` in its own inline style. Do not rely
on the parent div's `color` to cascade to headings. Match the section's existing light
text (e.g. #f3f0ec). This is a different mechanism from the brand-var contrast cluster
(global CSS element rule, not brand-var resolution).
