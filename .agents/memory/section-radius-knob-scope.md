---
name: Section radius knob scope
description: Which blocks actually use sectionRadiusClass + SectionBlockPanel (the cardRadius knob), so the shared fallback can be retargeted safely.
---

The `cardRadius` corner-radius knob — `sectionRadiusClass()` in
`artifacts/lp-studio/src/blocks/shared/section-kit.tsx` and the "Corner radius"
control in `SectionBlockPanel.tsx` — is used **only** by the 9 graduated
pillar/feature section blocks (`value-pillars-*` and `feature-*`). It is NOT
used by the other "section blocks" (case-study / quote / testimonial /
features / benefits / how-it-works), even though those share other parts of
the section-kit toolkit (AccentGlow, alignment, polish gating).

**Why:** I initially assumed (from the cluster of section-block memory notes)
that case-study/quote/features shared the radius helper, so I first tried to
make only the 9 per-block registry defaults square. That misses the dominant
path: blocks with an omitted `cardRadius` (AI-generated pages, synthesized
outlines, older saved rows) fall through to the helper's fallback. Verified
with `rg "sectionRadiusClass"` (only the 9 blocks + the definition) and
`rg "SectionBlockPanel"` (PropertyPanel routes only the 9 block types to it).

**How to apply:** To change the default corner radius for these 9 blocks
everywhere (including omitted-prop cases), change the `sectionRadiusClass`
fallback (`RADIUS_CLASS[r ?? "<default>"]`) and the panel display fallback
(`props.cardRadius ?? "<default>"`). This is safe — it cannot affect the
other section blocks because they don't call these. Per-block registry
defaults alone only cover manually inserted blocks.
