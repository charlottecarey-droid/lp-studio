---
name: Partner one-pager render paths (PDF + web)
description: The Partner Practices sales one-pager renders as jsPDF AND, now, as a shareable web one-pager.
---
The Partner Practices template (editor key `partner`; rep generator keys `new-partner`/`partner2`) renders as a jsPDF document via `generateNewPartnerOnePager` (wrapper in `artifacts/lp-studio/src/pages/sales/sales-one-pager.tsx`, shared impl in `lib/one-pager-types/src/generators.ts`).

It ALSO now supports a shareable web one-pager. `POST /api/sales/web-one-pager` (`artifacts/api-server/src/routes/sales/web-one-pager.ts`) branches on the `template` field: `new-partner`/`partner2` emit a partner block layout (`one-pager-hero` + `benefits-grid` + `dso-stat-showcase` + `bottom-cta`); everything else falls through to the 90-Day Pilot layout. The "Get Shareable Link" button is enabled for pilot + both partner templates (gated via `supportsWebLink`), and the client POST sends `template`.

**Why:** Originally the web route was pilot-only and always emitted pilot blocks regardless of `template`, so partner was PDF-only. That changed — the route now reads the tenant's saved partner layout and builds partner web blocks.

**How to apply:**
- The web partner hero carries the saved `headerCfg.boldHeading` toggle onto the `one-pager-hero` block (`boldHeading` prop; only an explicit `false` flips to normal weight). Partner copy (`partnerHeadline`/`partnerIntro`/`partnerFeatures`/`partnerStats`) is read from the `dandy_partner_template_layout` layout default and overlaid on brand-aware defaults; the `{dso}` placeholder in the intro is replaced with the prospect name.
- Defaults are brand-neutral (interpolate `brandCtx.brandName`, never literal "Dandy"). Partner stats `{value,desc}` map to stat-showcase `{value,label}` (no short label exists, so the sentence lands in `label`).
- To change the PDF, still edit the jsPDF generator. To change the web layout, edit the `isPartner` branch in `web-one-pager.ts`. Keep the client `supportsWebLink` list in sync with the route's accepted templates.
- Tests: `webOnePager.partner.integration.test.ts` pins the partner block layout, brand-neutrality, `{dso}` fill, saved-layout overlay, and `boldHeading=false`.
