---
name: LP_ASSETS_GC_DRY_RUN
description: The daily R2 asset GC is dry-run by default; enabling deletion is opt-in. Default-deny because a bug here deletes content-addressed assets permanently.
---

`artifacts/api-server/src/lib/assetsGc.ts` runs daily via a setInterval
registered in `server.ts`. It walks every LP HTML in R2, collects
referenced asset basenames, and *would* delete any
`_studio-assets/assets/*` object that is BOTH unreferenced AND >30 days
old.

**Default behavior:** dry-run. Logs candidate list and exits. To enable
deletion, set `LP_ASSETS_GC_DRY_RUN=0` on the api-server deployment.
Any other value (including unset) keeps dry-run on.

**Why:** a content-addressed asset is the only physical copy. If the
reference-extraction regex or HTML-listing filter has a bug, the GC
deletes assets that *are* still referenced, permanently breaking pages
until republish. Carrying a few MB of orphans for a week while we watch
the dry-run logs is much cheaper than that failure mode.

**How to apply:** when modifying the asset-ref regex or the GC's
HTML-list filter, leave dry-run on for at least one full daily cycle
after deploy and read the candidate sample log lines before flipping
`LP_ASSETS_GC_DRY_RUN=0` back on.
