---
name: Image fill-pool source ordering (scraped vs starter)
description: The precise priority order buildReferenceFillPool must keep, and why starter seeds rank below scrapes
---

`buildReferenceFillPool` (artifacts/api-server/src/routes/lp/generate-page.ts,
shared by generate-page + generate-microsite) ranks empty-slot fill candidates:

  genuine curated → current-reference scraped → starter seeds → other-host scraped

**Why:** Starter seeds (STARTER_IMAGE_SEEDS, tagged "starter") and untagged
page-reference scrapes are BOTH purpose-neutral → both score 0 in scoreImage.
findBestImage keeps the FIRST max-scorer on ties, so whatever sits earlier in the
pool wins. Originally starter seeds lived in the `curatedImages` bucket (placed
first), so they beat the current reference's score-0 scrapes on every tie — the
"scraped images never used, irrelevant starters shown instead" symptom. Splitting
starter out (isStarterImage) and placing it AFTER current-reference scrapes lets
the requested site's imagery win. Genuine brand-import/upload/AI assets stay first
(they're the tenant's real assets). Stale unrelated-host scrapes stay last
(gated > 0; neutral starters are safer than off-brand stale scrapes as fallback).

**How to apply:** Never fold "starter"-tagged rows back into curatedImages. The
strict gate still requires current-ref scrapes to be in trustedScrapedIds
(buildTrustedScrapedIds) to pass the >=0 gate; tests must pass trusted ids, not
rely on relaxed-mode, to exercise real strict-pass tie-breaks.
