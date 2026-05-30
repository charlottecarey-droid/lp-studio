---
name: lib/db composite dist drives downstream types
description: After editing a lib/db Drizzle schema, rebuild lib/db declarations or consumer tsc fails on the new column/field.
---

`@workspace/db` `package.json` `exports` point at TS **source** (`./src/index.ts`), so runtime/esbuild bundling always sees fresh schema. BUT api-server's `tsc` resolves the package via the **composite project's emitted `dist/*.d.ts`** (lib/db tsconfig: `composite: true`, `emitDeclarationOnly`, `outDir: dist`). That dist is stale until rebuilt.

**Symptom:** after adding a column/field to a `lib/db/src/schema/*.ts` table, `pnpm --filter @workspace/api-server run typecheck` errors like `Object literal may only specify known properties, and '<newField>' does not exist in type {...}` on the `db.insert(...).values({...})` call — even though the schema source clearly has it.

**Fix:** run `npx tsc -b` inside `lib/db` (it's a composite build; there is **no** `build` script — only `push`/`push-force`). Then re-run the consumer typecheck. Confirm with `grep -c <newField> lib/db/dist/schema/<table>.d.ts`.

**Why:** the runtime path and the type-resolution path diverge; passing tests/build does not imply passing typecheck, and vice-versa.

**Same trap for `@workspace/lp-template-engine`:** after adding a new export (e.g. `src/robots.ts` + `index.ts` re-export), api-server `tsc` fails `Module '"@workspace/lp-template-engine"' has no exported member 'X'` until you rebuild its dist with `npx tsc -b` (or `npx tsc`) inside `lib/lp-template-engine`. Same composite-dist-vs-source divergence as lib/db.

**Same trap for `@workspace/one-pager-types` (consumed by lp-studio):** lp-studio's `tsconfig.json` lists `references: [{ path: ../../lib/one-pager-types }]`, so its `tsc -p` typecheck resolves the package through the referenced project's emitted `dist/*.d.ts`, not `src` — even though `exports` point at `./src/*`. After a merge adds fields to `lib/one-pager-types/src` (e.g. `primaryColor`/`accentColor` on `BrandContext`/`CustomTemplatePdfBrandOpts`, `salesMaxLength` on `OverlayField`), `pnpm --filter @workspace/lp-studio run typecheck` errors "Property does not exist" until you `npx tsc -b` inside `lib/one-pager-types`. **Its `dist/` is gitignored**, so this is a *local-only* stale-dist artifact: vite build resolves `src` directly and deploy/CI rebuilds dist fresh — never a publish blocker, nothing to commit.
