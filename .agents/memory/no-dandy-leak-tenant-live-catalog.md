---
name: no-dandy-leak-tenant reads stale live catalog
description: Why the no-dandy-leak-tenant e2e can fail on blocks you never touched, and how to triage it
---

The `no-dandy-leak-tenant.spec.ts` e2e ("builder + viewer render the live catalog
without leaking Dandy") builds a page out of EVERY row returned by `/api/block-catalog`
on the shared Neon DB — not the in-process registry. Its sibling
`no-dandy-leak.spec.ts` ("every generic-catalog block renders without Dandy leakage")
scans the in-process registry-derived generic catalog instead.

**Rule:** when only the *-tenant (live-catalog) variant fails but the in-process
variant passes, the leak is stale/contaminated DB rows, not your code.

**Why:** `scripts/seed-block-catalog.cjs` UPSERTs its managed generic rows but has
NO prune/DELETE step. It intentionally EXCLUDES all `dandy-*`/`dso-*` blocks plus
`event-page`, `spatial-tour`, `horizontal-showcase`, `bold-statement`, `sticky-stack`
(they hardcode Dandy lime/forest colors or "Dandy" copyright) — explicitly called out
in the seed as "Tracked separately as cleanup debt / out of scope". But older
`industry='generic'` rows for those excluded block_types persist in the shared DB and
keep leaking. The shared DB is also concurrently re-seeded by other tasks.

**How to apply:** Triage by querying the live catalog for the leak
(`SELECT block_type FROM block_catalog WHERE industry='generic' AND is_enabled=true
AND default_props::text ILIKE '%dandy%'`). If the offending block_types are the
known-excluded Dandy/DSO set and none are yours, it is pre-existing cleanup debt, not
your regression. Do NOT prune the shared/prod Neon catalog as a side effect of an
unrelated task — that data cleanup is owned by catalog-seed work and risks prod.
