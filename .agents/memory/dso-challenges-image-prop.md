---
name: dso-challenges image slot is `backgroundImage` (not backgroundImageUrl)
description: The one dso block whose image fill uses a different prop name; easy to wire wrong.
---

# dso-challenges image slot prop name

`BlockDsoChallenges` (type `dso-challenges`) is a text+icon card grid. Its ONLY
image slot is a full-section **`backgroundImage`** (rendered behind a dark
overlay) — NOT `backgroundImageUrl` like every other dso-* block, and it has no
per-card images by design.

It was historically absent from `fillEmptyImages`/`collectImageSlots` in
generate-page.ts, so the AI image-fill pass never assigned it → the block
"never got images". Fix added a `blockType === "dso-challenges"` case that sets
`props.backgroundImage = pick(blockContext, images, usedUrls, "lp-feature")`.

**Why this trips people:** the generic dso fill at
`blockType.startsWith("dso-") && "imageUrl" in props` does nothing here because
dso-challenges has no `imageUrl`. Any new fill code for this block MUST target
`backgroundImage` specifically. `pick()` returns "" when no suitable library
image exists, leaving the plain background — so this never forces a bad photo.
