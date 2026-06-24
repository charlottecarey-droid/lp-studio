---
name: Microsite segment optional → core path
description: Sales microsite generator treats the audience segment as optional; how the core fallback avoids leaking another audience's directive.
---

Sales microsite generation (`generate-microsite.ts`) accepts NO segment: an empty
selection resolves a synthetic `{ id: "core", name: "Core" }` segment (every
`BrandAudienceSegment` field is optional) → `buildSegmentSection` emits `""` → the
page reads as the brand's own core messaging. An UNKNOWN (non-empty, unmatched)
`segmentId` STILL returns 400 — fail closed, so non-Dandy tenants never silently
inherit another audience's copy.

**Why:** `buildSystemPrompt` has a *separate* fallback —
`matchedSegment = findMatchingSegment(brand.segments, accountSegment)` — that
promotes the ACCOUNT's own segment when the picked segment carries no usable data.
With a synthetic-core segment that fallback would re-inject the account's segment
directive (e.g. DSO) onto a page the rep deliberately kept core. So removing the
missing-segment 400 alone is NOT enough to "assume core".

**How to apply:** When no segment is explicitly picked, pass `accountSegment = null`
into `buildSystemPrompt` (the route computes `pickedSegment ? account.segment : null`).
Keep the `account.segment` fallback ONLY when a real segment was picked — that's the
DSO-failure fix and must stay. Client mirrors this: `segmentId` initializes to `null`
= "Core (general audience)" (the default), and there is no generate-time gate on
`segmentId` (button + `handleGenerate`).
