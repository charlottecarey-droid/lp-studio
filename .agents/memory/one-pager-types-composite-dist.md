---
name: one-pager-types composite dist drives consumer types
description: lp-studio resolves @workspace/one-pager-types types via the composite dist .d.ts, not src; stale dist causes phantom "unknown property" errors in consumers.
---

# one-pager-types composite dist drives consumer types

`artifacts/lp-studio/tsconfig.json` has a project `reference` to
`../../lib/one-pager-types`, so the lp-studio typecheck resolves
`@workspace/one-pager-types` types from the package's **compiled `dist/*.d.ts`**,
NOT from `src/*.ts` (the package.json `exports` pointing at src only governs
runtime/bundler resolution, not the composite type graph).

**Symptom:** lp-studio `tsc` reports a phantom error like "unknown property
'teamContacts' in NewPartnerOpts" even though the field clearly exists in
`lib/one-pager-types/src/generators.ts`. The dist `.d.ts` is stale — a prior
task edited the src interface without rebuilding the composite output.

**Why incremental can miss it:** `npx tsc -b lib/one-pager-types` can exit 0 as
a no-op when its tsbuildinfo considers it up-to-date, leaving the stale `.d.ts` in
place. The validation typecheck still fails because it reads that stale dist.

**Fix:** force a clean rebuild of the composite output:
`npx tsc -b lib/one-pager-types --force`, then verify the regenerated
`lib/one-pager-types/dist/generators.d.ts` matches the current src interfaces.

**How to apply:** after editing any exported type/interface in a `lib/*`
composite package (one-pager-types, lib/db, etc.), rebuild its dist with
`tsc -b --force` before relying on the consumer typecheck — same pattern as the
lib/db composite-dist note.
