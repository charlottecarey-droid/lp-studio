---
name: Template replaceImagery relaxed-fill parity
description: The template "Replace imagery" image-fill path in generate-page must run the same relaxed last-resort fill pass as the freeform path, or deferred starters/stale-scrapes never backfill and heroes ship empty.
---

# Template replaceImagery must mirror the freeform relaxed fill pass

`generate-page.ts` has TWO image-fill pipelines that must stay in sync:

- **Freeform path**: `fillEmptyImages(...,false)` (strict) → `aiFillEmptyImages`
  (gated on AI-image-gen flags) → `fillEmptyImages(...,true)` (relaxed
  last-resort — documented as "fills every empty slot for tenants without AI
  image-gen").
- **Template `replaceImagery` branch**: historically ran ONLY the strict pass.

In `findBestImage`, generic STARTER seeds and stale scrapes are **deferred**
(`const deferred = starter || staleScrape; if (deferred && !relaxed) continue`).
They can only fill in a **relaxed** pass.

**The rule:** the template branch MUST also run
`fillEmptyImages(mergedBlocks, fillPool, pageImageContext, true, brandLogoUrls)`
after its strict pass.

**Why:** without it, a template "Replace imagery" page whose tenant has no own
hero image shipped an **empty hero** even when on-topic shared starter heroes
existed (prod Neon has 100+ shared `lp-hero` starters, several dental) — while
the SAME tenant's freeform page filled it. The divergence appeared after the
June-2026 tiering change deferred starters to the relaxed pass; the freeform
path got the relaxed pass, the template path didn't. This surfaced as a
"pre-existing" replace-imagery integration-test failure (hero.props.imageUrl
== "").

**How to apply:**
- "Empty beats wrong" is NOT weakened by adding the relaxed pass — the relaxed
  hero/product relevance floor in `findBestImage` (requirePurposeFloor +
  starter-topicality) still rejects OFF-topic starters. Only a topically-
  matching starter fills. Off-brand tenants still get empty heroes.
- Pass `brandLogoUrls` in the relaxed template call (the freeform call omits it;
  passing it is strictly safer — excludes logo slots from fill).
- Known remaining divergence (follow-up, intentionally not fixed): the template
  path has NO `aiFillEmptyImages` pass, so AI-image-gen-enabled tenants get
  relaxed starters where the freeform path would first place an AI image. That's
  a quality gap, not a correctness bug.
- When #1443's "starter-hero elimination" (heroes go empty when no suitable
  TENANT image) lands, BOTH pipelines AND this test's contract must change
  together — don't pre-empt it in one path only.
