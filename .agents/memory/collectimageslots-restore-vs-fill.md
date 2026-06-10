---
name: collectImageSlots dual role (fill vs template restore)
description: collectImageSlots feeds BOTH the auto-fill pipeline AND template image restore; a "manual-only" image field must be excluded from fill but kept in the includeEmpty=true restore enumeration.
---

# collectImageSlots dual role (fill vs template restore)

`collectImageSlots(block, logoUrls, includeEmpty=false)` in generate-page.ts
serves TWO different consumers:
- **Fill / dedupe / harvest / replace-clear** callsites pass the default
  `includeEmpty=false` and only want POPULATED slots.
- **Template image restore** (`restoreTemplateImages`) is the ONLY caller that
  passes `includeEmpty=true`. It enumerates the same slots (incl. empty ones)
  on the orig and merged blocks and aligns them BY INDEX, then copies orig→merged
  so a template author's imagery survives "create page from template" when
  `replaceImagery=false`.

**Landmine:** to make an image field "manual-only / never auto-filled" it is NOT
enough — and is WRONG — to delete its `pushScalar` from `collectImageSlots`
entirely. That also drops it from the `includeEmpty=true` restore enumeration,
so a template author's deliberately-set value is no longer restored, and (if the
AI is prompted to blank it) gets silently wiped on regeneration.

**Correct pattern (used for dso-insights-dashboard `dashboardImage`):** exclude
it from fill by gating the push on `includeEmpty`:
```ts
if (includeEmpty) {
  pushScalar("dashboardImage", "lp-feature", blockContext);
}
```
Result: fill/dedupe/harvest/replace (includeEmpty=false) never touch it (so no
icon/off-subject photo lands in the dashboard frame), but the restore path
(includeEmpty=true) keeps it so template imagery survives `replaceImagery=false`.
Sanitize (`cleanUrl`) still strips hallucinated/icon URLs regardless.

**Why:** found during the "icon image in dso-insights-dashboard" fix — the first
attempt removed the slot wholesale and broke template restore (architect-flagged
regression). Restore copies ALL orig slots to merged unconditionally when
replaceImagery=false, so any image field excluded from the includeEmpty=true list
is left at whatever the model emitted.
