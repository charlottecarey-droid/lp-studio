---
name: linkedPage payload field parity
description: Variant/AB-test viewer renders use a hand-built linkedPage payload that must mirror page-level fields the main builder path exposes, or viewer silently diverges.
---

The landing-page viewer has TWO render paths: the main path (BuilderPageResponse from the page-config endpoint) and the variant/linked-page path (`assignedVariant.linkedPage`). The latter is hand-assembled server-side in `artifacts/api-server/src/routes/lp/tracking.ts` by `enrichVariantWithPage` (builderPageId) and `enrichVariantWithBlockOverrides` (AB-test testedBlockId) — each builds a literal `linkedPage: { id, title, slug, blocks, ... }` object, NOT a full row spread.

**Rule:** any new page-level field the main path relies on (e.g. `ctaDefault` for the Page-CTA-drives-primary-button feature) must be added to BOTH hand-built linkedPage objects, or variant/AB-test renders silently drop it (the field is just `undefined`).

**Why:** the generated client `LinkedPage` type (orval, from the API spec) also lacks these fields, so the viewer casts `linkedPage` inline to augment the type. The cast compiles even when the server never sends the data — so the only signal of a gap is a runtime divergence (variant render differs from builder preview), never a typecheck error.

**How to apply:** when adding a page-level field consumed by landing-page-viewer.tsx, grep `linkedPage: {` in tracking.ts and patch every occurrence; the inline cast in the viewer is the established pattern for the missing generated type (no need to regenerate the spec for a render-only field).
