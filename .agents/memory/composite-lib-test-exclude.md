---
name: Composite lib must exclude test files from dist build
description: Why a sibling *.test.ts can break consumers with TS6305, and the fix
---

A composite lib package (declaration/dist build, project-referenced by consumers)
must set `"exclude": ["src/**/*.test.ts"]` in its tsconfig, or a test file's
errors block the whole project's dist emit.

**Why:** `tsconfig.base.json` sets `"types": []`, so test files importing
`node:test` / `node:assert/strict` fail with TS2307. Under `tsc -b`, a project
with any error does not emit its `dist/*.d.ts`. Consumers that project-reference
the lib then fail with **TS6305 "Output file ... has not been built from source
file ..."** — and the failing consumer may be a *pre-existing* unrelated file,
making it look like your change broke it.

**How to apply:** If you see TS6305 pointing at a `lib/*/dist/index.d.ts`, the lib
didn't build. Check that lib's tsconfig has the `*.test.ts` exclude (lp-template-engine
has it; lead-utils was missing it). Add it, then `tsc -b lib/<pkg> --force`.
Tests still run via the package's `tsx --test` script — they're only excluded from
the declaration build, not from the test runner.
