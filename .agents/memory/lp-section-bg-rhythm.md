---
name: LP generate-page section-bg rhythm
description: How generated landing pages avoid the all-white section stack (mirror of the microsite fix).
---

# Landing-page section-background rhythm

The `generate-page` (landing-page) path used to render as a stack of identical-white
sections: in `"balanced"` design intensity `applyDesignIntensityBackgrounds` is a
no-op, and the model frequently omits/repeats `backgroundStyle`, so every section
fell back to the renderer's white default. Fixed by porting the proven microsite
approach (Task #1127) into `artifacts/api-server/src/routes/lp/generate-page.ts`.

**The fix is three coordinated pieces, applied ONLY at generation time** (the POST
handler), so microsites and already-published rows are never touched:

1. `seedLandingPageSectionBackgrounds(blocks)` — seeds `"white"` on every
   *supporting section* lacking a `backgroundStyle` (a section with none already
   renders white, so seeding white preserves appearance while making it visible to
   the rhythm pass). Runs BEFORE `applyDesignIntensityBackgrounds`.
2. `applyLandingPageSectionRhythm(blocks, seedKey)` — spreads a seeded two-tone
   alternating scheme (`LP_SUPPORTING_BG_SCHEMES`, two DISTINCT light neutrals)
   across the still-light supporting sections so adjacent ones always differ. Runs
   AFTER `applyDesignIntensityBackgrounds`. seedKey = `${tenantId}::${brandName}::${prompt}`.
3. The `airy-minimal` branch of `applyDesignIntensityBackgrounds` now alternates
   `white`/`light-gray` instead of forcing one identical white (shared with the
   microsite path, which only ever calls it with balanced/editorial-dense).

**What counts as a "supporting section"** — `isLpSupportingSectionBlock`: has a
`props` object AND is NOT a hero (`type.includes("hero")` — heroes manage their own
surface, seeding white would wrongly lighten a dark hero), NOT dark-required
(`DARK_REQUIRED_BLOCK_TYPES` or `dso-*`, which hard-render white copy → white-on-white
bug), NOT page chrome / layout / rich-text (`LP_NON_SECTION_BLOCK_TYPES`), and NOT a
self-contained full-page block (`SELF_CONTAINED_FULL_PAGE_TYPES`, which paint their
own internal surfaces).

**Why:** keeps the all-white regression from recurring on landing pages without
disturbing the dark/accent anchors the model or design-intensity pass sets, and
without altering the microsite path or published pages.

**How to apply / gotcha:** `SELF_CONTAINED_FULL_PAGE_TYPES` is declared LATER in the
module (≈line 3781) than these helpers (≈line 364), so it is referenced *lazily
inside* `isLpSupportingSectionBlock` (runs at request time) — never put it in the
top-level `LP_NON_SECTION_BLOCK_TYPES` Set initializer or you get a use-before-init
crash at module load. `lpHashSeed` is a local FNV-1a+fmix copy (NOT imported from
the microsite route — that route already imports from this one → circular). Tests:
`generate-page.design-intensity.test.ts`; the microsite guard
`generate-microsite.sectionBgRhythm.test.ts` must stay green (uses balanced/editorial-dense only).
