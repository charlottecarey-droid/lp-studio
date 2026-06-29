---
name: LP generate-page authored-outline authority
description: When the LP AI generator treats an authored page outline as authoritative (places exact blocks) vs a soft prompt hint, and how tenant per-block default styling reaches generated blocks.
---

# LP generate-page: authored outline is AUTHORITATIVE (parity with microsite)

The LP landing-page generator (`artifacts/api-server/src/routes/lp/generate-page.ts`)
used to treat an authored page outline as a SOFT prompt hint only (a "PREFERRED
BLOCK LIST"), with no post-generation reconcile — so tenant-chosen copy-only
section blocks added to the outline frequently never appeared, and never carried
the tenant's saved styling. It now mirrors the microsite generator: when an
authored outline exists, the resolved outline is PLACED exactly (in order) after
parse, reusing the model's matching block per type and synthesizing omitted slots
from tenant defaults; off-outline blocks are dropped.

## The rule
- A single shared resolver (`resolveGenerationOutlineBlocks`) feeds BOTH the
  prompt's PREFERRED BLOCK LIST and the post-gen reconcile, so the hint and the
  enforcement can never drift. Anything that changes outline resolution must go
  through it.
- `reconcileLandingPageBlocksToOutline` runs at the EARLIEST authoritative point
  (right after the post-retry array guard, before canonicalize/CTA-wiring/
  `enforceAiModes`) so the rest of the pipeline operates on the final ordered set.
- `outlineActive` (resolved outline non-empty) gates OFF the competing block
  passes — `enforceRequiredRoles` and `enforceRequestedDandyDsoBlocks` — because
  the author's chosen structure is final and those passes would re-add omitted
  blocks. **But it deliberately KEEPS the idempotent chrome guards** (nav /
  final-CTA / footer): `resolvePageOutline` does not emit chrome and a public LP
  page must always carry it. (This is a deliberate deviation from a "gate both
  body and chrome" suggestion.)

## Tenant saved styling reaches generated blocks via the loader, not the renderer
- `loadBlockGovernanceContext` overlays tenant `lp_block_defaults.props` ON TOP OF
  the superadmin `block_catalog.default_props` (tenant precedence, per block_type,
  fail-open, runs regardless of industry). That single `defaultPropsByType` map is
  what BOTH `enforceAiModes` (copy-mode image restore / locked reset) AND the
  outline synthesis read — so a tenant's saved per-block styling is reproduced in
  both places. Forget the overlay and copy/locked blocks silently fall back to the
  catalog default styling.

## Scope decisions (intentional, not gaps)
- **props only, NOT `block_settings`.** `lp_block_defaults` also has a
  `block_settings` column (wrapper-level: section bg/padding), but the entire
  governance system (`enforceAiModes`) only ever touches `props`. Synthesis
  matches that. Section blocks' real styling (colors/layout/theme) lives in
  `props`. Applying block_settings would be a new capability beyond governance.
- **Legacy `micrositeBlockList` / `defaultMicrositeBlockList` is NEVER authoritative
  on the LP reconcile path** (corrected June 2026 after a real regression). The
  earlier assumption — "the only seeded legacy lists belong to Dandy which is DSO,
  so activation is safe" — was WRONG: Dandy has BOTH a DSO path AND a plain non-DSO
  LP path, and its brand `defaultMicrositeBlockList` (a 7-block MICROSITE list, with
  NO `defaultPageOutline`) made `outlineActive=true` on the non-DSO LP, so the
  reconcile dropped every AI block not in the microsite list → pages built a few
  blocks then HARD-REVERTED to a generic microsite "backup" layout.
  - Fix: `resolveGenerationOutlineBlocks` takes `honorLegacyBlockList?: boolean`.
    The AUTHORITATIVE call site (the one feeding `outlineActive` / the reconcile)
    passes `honorLegacyBlockList: false`, and `brandOutline` is built with
    `legacyBlockList: null`. So on the LP reconcile path ONLY an explicitly authored
    `pageOutline` (segment or brand) is authoritative; a legacy block list can never
    flip `outlineActive`.
  - The legacy list is NOT dead on LPs: `buildSegmentSection` calls the resolver at
    the DEFAULT (`honorLegacyBlockList` omitted = true), so a segment's
    `micrositeBlockList` still appears as a SOFT prompt "PREFERRED BLOCK LIST" hint.
  - DSO paths unchanged: `dsoFreeChoice` still nulls the legacy list regardless of
    the new flag.
  - Brand `defaultMicrositeBlockList` is now MICROSITE-only; a tenant wanting
    authoritative LP structure must set `defaultPageOutline`.

**Why (this scope decision):** a legacy microsite block list must never collapse a
landing page into the microsite lineup; LP authority requires an explicit page
outline. **How to apply:** any "non-DSO LP reverts to a generic/backup layout"
report → check that the authoritative resolver call still passes
`honorLegacyBlockList: false` and that no new call site reintroduces brand
`defaultMicrositeBlockList` into LP `brandOutline`.

**Why:** the request was "AI doesn't use the outline blocks at all even though
they're in the outline." Root cause was outline = soft hint + catalog-only
defaults. **How to apply:** any future "generated page ignored my outline / lost
my saved block styling" bug starts here; check `outlineActive`, the loader overlay
order, and that new outline-shaping passes are gated on `!outlineActive`.
