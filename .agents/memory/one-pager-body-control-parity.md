---
name: One-pager body-control parity across generators
description: Why a sales one-pager editor body control can silently do nothing on one template — each generator reads bodyCfg independently.
---

# Sales one-pager: body controls must be read in EACH generator

The sales one-pager editor (`artifacts/lp-studio/src/pages/sales/sales-one-pager-editor.tsx`)
renders ONE shared body-config UI (sliders/toggles for Content Offset X, Section
Spacing, Show intro, font sizes, etc.) whose values are saved into `bodyCfg` and
passed through the per-template wrappers in `sales-one-pager.tsx` as
`layoutOverrides.bodyCfg` to the matching generator in
`lib/one-pager-types/src/generators.ts`.

But there are SEPARATE generator functions — `generatePilotOnePager`,
`generateComparisonOnePager`, `generateNewPartnerOnePager`,
`generateAgreementSummaryOnePager`, `generateROIOnePager` — and each reads `bCfg`
fields independently. A control only "works" on a template if THAT template's
generator actually reads the field. The editor showing the slider proves nothing.

**Why:** the partner generator read `headlineFontSize`/`introFontSize` (so those
worked) but never read `contentOffsetX`, `sectionSpacing`, or `showIntro`, so those
three sliders/checkbox silently did nothing on the partner template even though they
worked on the pilot template.

**How to apply:** when adding or debugging a body control, grep the field name across
ALL generators in `generators.ts`, not just one. For backward compatibility on
spacing-type fields with existing saved layouts, apply them as a delta from the
current default (e.g. `sectionExtra = (bCfg.sectionSpacing ?? 16) - 16`) so the
default value reproduces the pre-existing layout exactly. Offset-X fields shift the
left-aligned body block (headline, intro, card grid, headings, stat grid); leave
centered footer text alone.
