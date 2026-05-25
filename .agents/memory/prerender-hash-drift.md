---
name: LP prerender hash drift
description: Why published landing pages broke after every lp-studio redeploy, and the structural fix shape (task #374).
---

**Symptom:** every lp-studio redeploy silently broke every published
tenant page. Visitors saw the SSR shell never hydrate; the entrypoint
`<script src="/assets/index-XXXX.js">` returned `text/html`.

**Root cause:** prerendered LP HTML lives in R2 forever (keyed by
`<host>/<slug>.html`). It hard-codes Vite-hashed asset paths. A redeploy
emits new hashes; old hashes vanish from the Replit static origin;
Replit's SPA rewrite returns `index.html` for the JS request.

**Structural fix (task #374):**
1. Build-time hook uploads `dist/public/assets/*` to R2 under
   `_studio-assets/assets/<basename>` as immutable objects.
2. CF Worker serves `/assets/*` from R2 first, with a sessionStorage-
   guarded one-shot reload shim (correct content-type) on miss.
3. Publish-time presence check refuses to write LP HTML whose referenced
   `/assets/*` aren't in R2.
4. Scheduled health-check canary samples published pages and alerts on
   asset miss.
5. Scheduled GC deletes only assets that are BOTH unreferenced AND
   >30d old; dry-run by default.

**Why:** the existing `main.tsx` ChunkLoadError shim only catches
*dynamic-import* failures. Entrypoint `<script>` failures never reach
React. The shim must live at the edge (Worker), not in lp-studio.

**How to apply:** any change to the LP asset pipeline must preserve all
five components together — they're a system. Don't remove the
publish-time presence check without removing the GC retention window,
etc. The asset-reference regex and R2 key derivation are centralized in
`artifacts/api-server/src/lib/assetRefs.ts` to prevent drift between
writers and readers.
