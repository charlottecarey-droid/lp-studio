---
name: dso-heartland-hero companyName = target-company co-brand slot
description: Why the heartland hero's companyName is blank on landing pages but filled on account microsites, and where to enforce it.
---

The `dso-heartland-hero` block's `companyName` prop is the TARGET/prospect company
name — it highlights in the headline accent color and renders in the nav as
"logo × company". It is NOT the selling tenant's brand name.

**Rule:**
- Landing pages (generate-page.ts) have NO account → `companyName` must always be `""`.
- Account microsites (generate-microsite.ts) always have an account → fill it
  deterministically from `deriveCompanyName(account)` (`displayName ?? name`,
  `businessCaseVars.ts`), never the seller brand.

**Why:** the old behavior leaked the seller's brand name (e.g. "Dandy") into the
hero's co-brand slot on generic landing pages, where there is no prospect to name.

**How to apply / enforcement points:**
- generate-page.ts: a post-parse blanking branch forces `companyName=""` for this
  block, AND a FINAL guard re-blanks it immediately after the last `enforceAiModes`
  call (before the polish snapshot). The final guard is the decisive invariant:
  `enforceAiModes` resets a `locked` block's props to the catalog default, whose
  `companyName` is the non-empty token `"{company}"`, so blanking only earlier is
  not airtight.
- generate-microsite.ts: deterministic post-process sets every heartland hero
  `companyName = deriveCompanyName(account)` as the last mutation (covers both
  freeform + template).
- `/lp/copy-generate` is NOT a fill path for this field: `copy-fields.ts`
  COPY_FIELDS for this block excludes `companyName`, and its PropertyPanel field
  is a plain `<Input>` (token inserters only, no AI-suggest/sparkle).
- Builder label for the field reads "(in your accent color)", not brand-specific.
