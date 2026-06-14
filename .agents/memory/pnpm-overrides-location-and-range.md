---
name: pnpm overrides location + range discipline
description: Where pnpm overrides live in this monorepo and why a package.json pnpm.overrides block or a >= floor is dangerous.
---

This monorepo declares dependency `overrides` in `pnpm-workspace.yaml` (a large block: security pins like `protobufjs: '>=7.6.1'`, an EXACT toolchain pin `esbuild: 0.27.3`, and many `<pkg>>@scope/binary: '-'` platform-binary prune entries that keep the deploy image small).

**Rule 1 — never add a `pnpm.overrides` block to any `package.json`.**
**Why:** pnpm uses only ONE overrides source. Adding `pnpm.overrides` in root `package.json` makes pnpm IGNORE the entire `pnpm-workspace.yaml` overrides block — silently dropping every security pin and every platform-prune entry (lockfile churns massively, vulnerable transitives can return, image bloats).
**How to apply:** To add/change an override, edit the `overrides:` map in `pnpm-workspace.yaml` (merge, don't replace), then `pnpm install`.

**Rule 2 — to bump a pinned dep, change the pin in the overrides map, not just the consumer's devDep.**
**Why:** An exact override pin (e.g. `esbuild: 0.27.3`) FORCES that version everywhere and silently overrides a consumer package.json bump (`^0.28.1` stayed 0.27.3 until the pin itself was bumped). The esbuild pin also governs lp-studio's vite esbuild.

**Rule 3 — prefer a caret (`^x.y.z`), not a `>=` floor, for toolchain-deep deps.**
**Why:** A `>=` override grabs the highest version in the registry across majors (brace-expansion `>=2.0.3` resolved to 5.0.6, three majors up; it's consumed by minimatch→glob, so a forced major can break globbing). Use `^2.0.3` to stay in the safe major (→2.1.1). `>=` floors are only safe when the line's latest major is known-compatible.

**Minimal-diff technique:** after a bad full re-resolve, restore the lockfile to baseline with `git show HEAD:pnpm-lock.yaml > pnpm-lock.yaml` (read-only git + shell redirect, allowed) then `pnpm install` — pnpm preserves existing resolutions and touches only what the changed overrides force (verify with `git diff --stat pnpm-lock.yaml` and an overrides-line count of HEAD vs now).
