---
name: Shared Dialog clipping + overflow twMerge
description: Why the shared shadcn DialogContent clips content off the left edge, and how per-modal overflow overrides actually merge.
---

The shared `components/ui/dialog.tsx` `DialogContent` is `fixed left-[50%] translate-x-[-50%]` (centered) with a `grid` body. The default single grid track is `auto`, which sizes to its widest child's **min-content**. A child with a large intrinsic width — most commonly a `<select>` sized to its longest `<option>` (e.g. a long audience-segment name), or long `font-mono` URL text — expands the whole dialog **past `max-w-lg`**. Because the box is centered, that overflow spills equally off both sides, **clipping the left edge** of the title/labels (the classic "e New Page" / "Vho is this page for?" symptom).

**Fix (already in dialog.tsx):** make the column shrinkable with `grid-cols-[minmax(0,1fr)]` so wide children clip/scroll *inside* instead of growing the dialog; plus `w-[calc(100%-2rem)]` for a small-screen gutter and `max-h-[calc(100dvh-2rem)] overflow-y-auto` so tall modals scroll.

**Why:** prefer fixing modal sizing at the shared base, not per-modal — most clipping/overflow bugs are the same root cause.

**twMerge gotcha (verified):** with `cn`=`twMerge`, a per-modal `overflow-hidden` **drops** the base `overflow-y-auto` (they resolve to the same group → later wins), so `overflow-hidden` flex modals (QuickCampaignWizard, AdCopyDialog, command palette) keep exactly their own overflow — no double scrollbars. Flex modals that set no overflow keep the base `overflow-y-auto` as a dormant safety net (their `flex-1 min-h-0` child absorbs scroll). `max-w-*`/`max-h-*`/`w-[..]`/`flex`(over `grid`) all override the base as expected.
