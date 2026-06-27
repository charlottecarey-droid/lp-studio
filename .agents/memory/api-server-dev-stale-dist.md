---
name: api-server dev serves stale dist until restart
description: Why a just-merged/edited api-server feature looks missing or broken in the running app until the workflow is restarted
---

The `artifacts/api-server` dev workflow runs `dev = build && migrate && start` (see its package.json) — it compiles `src/` into `dist/` ONCE and runs `node dist/index.mjs`. There is **no watch/HMR**. So after a code merge or any source edit, the RUNNING server keeps serving the previous `dist/` until the workflow is restarted.

**Why:** the frontend (`lp-studio`) is Vite and updates live, so the UI shows new code immediately, but the backend is frozen at the last build. The mismatch makes a brand-new, correctly-wired backend feature look broken: the UI renders the new controls while the stale API returns empty/old data.

**Symptom seen (microsite recipes):** superadmin "Page Recipes" → Microsites group rendered empty and the "New recipe" button was disabled. Root cause was NOT a code bug and NOT "missing DB seeding" — the running `dist/index.mjs` predated the merge and didn't contain the microsite recipe pool / block menu. The button is `disabled={availableBlocks[path].length===0}`, so an empty stale menu greys it out.

**How to apply:** before chasing a "merged feature doesn't show up" or "empty data / disabled control" report on this repo, check whether the api-server `dist` is older than the source (`ls dist/index.mjs` mtime vs the edited `.ts`, or `rg <new-symbol> artifacts/api-server/dist`). If stale, just `restart_workflow("artifacts/api-server: API Server")` (rebuilds dist) and re-verify — no code change required.

**Aside (page recipes have nothing to "seed"):** built-in recipes live in code (`page-recipes.ts` `recipesForPath`); the admin GET flatMaps every path's code recipes. `page_recipe_overrides` stores ONLY superadmin edits + custom recipes. So built-in microsite recipes appear automatically once the server runs current code — there is no seed step.
