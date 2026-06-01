---
name: Partner one-pager is PDF-only
description: The Partner Practices sales one-pager has no web/block render path; it is jsPDF only.
---
The Partner Practices template (editor key `partner`; rep generator keys `new-partner`/`partner2`) renders ONLY as a jsPDF document via `generateNewPartnerOnePager` (wrapper in `artifacts/lp-studio/src/pages/sales/sales-one-pager.tsx`, shared impl in `lib/one-pager-types/src/generators.ts`). The header title is drawn there.

**Why:** It is tempting (and a task once assumed this) that the partner one-pager flows through the web `one-pager-hero` block + `BlockOnePagerHero` + landing-page-viewer. It does NOT. The "Get Shareable Link" / web one-pager flow (`POST /api/sales/web-one-pager`, `artifacts/api-server/src/routes/sales/web-one-pager.ts`) is gated to the **pilot** template only, and that route always emits the pilot block layout regardless of the `template` field.

**How to apply:** To change what reps actually see/send for the partner one-pager (header weight, fonts, copy, layout), edit the jsPDF generator. The partner editor preview is also jsPDF (`doc.output("blob")`). Editor controls persist via `headerCfg`/`bodyCfg`/etc. in the `dandy_partner_template_layout` layout default, which the generator reads back through `opts.layoutOverrides`.
