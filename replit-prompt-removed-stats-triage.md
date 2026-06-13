# Replit prompt — removed-stats triage modal (add back · save · block)

## Today's behavior

After AI generates a landing page or microsite with **Strict AI Facts mode** on, any stat / quote / percentage the model tried to write that wasn't in the tenant's approved-facts library gets stripped. A banner appears at the top of the generated page telling the user "N stats were removed" with a link to add them to Brand & Content so the AI can use them "next time." That last bit is the failure mode: by the time the user reviews the banner, **the page already lacks the stats**, and they have to manually re-add them (find the right block, paste the number, re-style) or regenerate the whole page.

## What we're adding

A triage modal on the removed-stats banner. The user sees every removed stat as a row, can multi-select, and gets **three actions** per row (or as bulk actions on the selection):

1. **Add back to this page** — inject the stat into the most appropriate block on the current page (or open a picker if there's ambiguity). The page updates in place; no re-generation needed.
2. **Save to brand approved facts** — adds to the `lp_proof_points` library so the AI uses it on future generations (this is roughly the existing "add to brand settings" link, just per-row + bulk).
3. **Never suggest again** — permanent block. The AI must not propose this fact on any future generation, even if it would be true / on-brand. Useful for outdated stats, deprecated claims, or facts the user just doesn't want to ship.

Rows can also have any combo: e.g. "save to brand approved facts AND add back to this page" is valid (the most common path for stats the user thinks are correct but the AI shouldn't have stripped).

---

## Step 1 — Audit the existing strict-facts flow

Before changing anything, find and read these files (search the repo to confirm exact paths):

- The **strict-facts filter** in the AI generation pipeline. Look in `artifacts/api-server/src/lib/` for `strictFacts*`, `factsFilter*`, or similar. Specifically: how does the model's draft output get scanned for stats? What data shape does a "removed stat" have (raw string? structured `{ value, unit, context, blockId }`?)? Where do they get stored — on the generation result, on the page row, or in a separate `lp_page_removed_facts` table?
- The **approved-facts library**. Likely `lib/db/src/schema/lpProofPoints.ts` or similar. Document the columns + how rows are tagged per-tenant.
- The **banner UI** that currently surfaces removed stats. Likely lives in `artifacts/lp-studio/src/pages/builder/` or in a `RemovedFactsBanner.tsx` component. Document the current state (what it shows, what the "add to brand settings" link does today).
- The **page-content storage model** — how are blocks + their content stored? Is each block a JSON blob, a row in `lp_page_blocks`, or just JSON inside `lp_pages.content`? You'll need to know this to implement "add back to page."
- The **AI prompt construction** — where does the AI's system prompt + brand-facts payload get assembled before generation? You'll need to add the block-list there.

Put a 5-line summary of what you found in the PR description so reviewers can sanity-check the integration points.

---

## Step 2 — Data model changes

### Two new tables

**`lp_blocked_facts`** — per-tenant permanent block list. Mirrors the shape of `lp_proof_points` (or whatever the approved-facts table is) so the AI can dedupe against either list with the same key.

Columns:

- `id` PK
- `tenantId` NOT NULL FK → `tenants(id)` ON DELETE CASCADE + index
- `factText` TEXT NOT NULL — the literal stat/claim string (e.g. "Used by 8,000+ dentists")
- `factNormalized` TEXT NOT NULL — lowercased + whitespace-collapsed version for dedupe matching
- `factKind` TEXT — `stat | quote | claim | percentage | other` (same enum as `lp_proof_points`)
- `blockedAt` TIMESTAMP
- `blockedBy` FK → `app_users(id)`
- `blockedFromPageId` FK → `lp_pages(id)` NULLABLE — track which page triggered the block (audit only, not for logic)
- `reason` TEXT NULLABLE — optional free-text note from the user

Add a UNIQUE constraint on `(tenantId, factNormalized)` so the same fact can't be blocked twice on retry.

**`lp_page_removed_facts`** — record of what got stripped from each generation. If this table already exists (per Step 1 audit), extend it; otherwise create:

Columns:

- `id` PK
- `tenantId` NOT NULL FK + index
- `pageId` FK → `lp_pages(id)` NOT NULL + index
- `factText`, `factNormalized`, `factKind` — same shape as `lp_blocked_facts`
- `originalBlockId` TEXT NULLABLE — which block on the AI's draft the fact was originally in, so "add back" can target the right spot
- `originalContext` JSONB NULLABLE — surrounding sentence / paragraph the AI proposed, so the user can see the stat in context
- `triageState` TEXT NOT NULL DEFAULT `'pending'` — `'pending' | 'restored' | 'saved_to_brand' | 'blocked' | 'dismissed'`
- `triagedAt` TIMESTAMP NULLABLE
- `triagedBy` FK → `app_users(id)` NULLABLE
- `createdAt` TIMESTAMP

The `triageState` is the key field for the UI — pending rows are what the banner counts, triaged rows hide.

### Migration

New migration file (next sequence number in `lib/db/migrations/`). Include `tenant_id NOT NULL` FK + index from the initial migration — do NOT retrofit later.

---

## Step 3 — API endpoints

Mount under `/api/lp/pages/:pageId/removed-facts` (or whatever pattern the existing facts routes use — mirror that). Every route uses `requireAuth` + `getTenantId(req, res)`. All DB writes scoped via `.where(eq(table.tenantId, tenantId))`.

```
GET    /api/lp/pages/:pageId/removed-facts
       — list pending removed facts for the page; returns
         [{ id, factText, factKind, originalBlockId, originalContext, suggestedTargetBlockId }]
         where suggestedTargetBlockId is computed server-side
         (best guess for "add back to page" — see Step 4).

POST   /api/lp/pages/:pageId/removed-facts/:factId/restore
       Body: { targetBlockId?: string }
       — inject the fact into the page; mark triageState='restored';
         return the updated block content + the new page version.

POST   /api/lp/pages/:pageId/removed-facts/:factId/save-to-brand
       — copy the fact into lp_proof_points; mark triageState='saved_to_brand'.
         Idempotent if the fact already exists in the brand library.

POST   /api/lp/pages/:pageId/removed-facts/:factId/block
       Body: { reason?: string }
       — insert into lp_blocked_facts; mark triageState='blocked'.

POST   /api/lp/pages/:pageId/removed-facts/:factId/dismiss
       — mark triageState='dismissed' without taking any action
         (user looked at it, decided to ignore it, doesn't want it nagging again).

POST   /api/lp/pages/:pageId/removed-facts/bulk
       Body: { factIds: string[], action: 'restore' | 'save-to-brand' | 'block' | 'dismiss', reason?: string }
       — bulk version of the above; runs each action transactionally per fact.
```

Idempotency: each per-fact endpoint should be safe to retry. Use the `triageState` as the guard — once a fact is triaged, subsequent calls return the current state without changing it.

---

## Step 4 — "Add back to page" injection logic

This is the trickiest part. The user clicks "Add back to page" on a stat like "8,000+ dentists trust us." The system needs to put it somewhere reasonable on the current page without breaking the layout.

### Suggested target block

Server-side, when listing removed facts (the `GET` endpoint), compute a `suggestedTargetBlockId` per fact using these heuristics in order:

1. If `originalBlockId` exists on the removed-fact row AND that block still exists on the page → use it. The AI knew where it wanted the stat; respect that.
2. Otherwise, scan the current page's blocks for the best fit by `factKind`:
   - `stat | percentage` → first **StatStrip** / **MetricBlock** / **NumberHighlight** block (whatever the block-catalog calls them — check `lp_block_catalog`).
   - `quote` → first **Testimonial** / **QuoteBlock**.
   - `claim` → first **TrustBar** / **SocialProofRow** / **HeroSubhead**.
   - `other` → first paragraph-style block.
3. If no compatible block exists → return `suggestedTargetBlockId: null` and let the UI show a "Where should this go?" picker showing all current blocks with their thumbnails / labels.

### Inserting the fact

Once a target block is chosen, the injection depends on block type:

- **StatStrip / MetricBlock** with a fixed grid of stat slots: append the fact as a new slot. If the grid is full (say 4-up), grow to 5-up if the layout supports it; otherwise replace the lowest-confidence existing stat (the one whose source field is empty or marked "AI placeholder").
- **Testimonial**: append as a new testimonial card.
- **Paragraph-style block**: insert the fact as a new sentence at the end of the paragraph, formatted on-brand (the brand-content system already has a sentence-formatter — reuse it).
- **Hero subhead / TrustBar**: append after the existing copy, comma-separated.

After insertion, save the page (write to `lp_pages.content` and bump `lp_pages.version` + `lp_pages.updated_at`). Return the updated block payload so the builder can hot-swap it without a full page reload.

### Don't break style locks

If the target block has `isLocked: true` or its content fields are flagged as approval-required, do NOT mutate it silently. Instead return `409 conflict` with a payload explaining the block is locked, and let the UI present a "this block is locked — unlock to add the stat" affordance.

---

## Step 5 — Block-list enforcement in AI generation

Update the AI page-generation pipeline (Step 1 will tell you the exact path):

1. Before assembling the AI prompt, load the tenant's `lp_blocked_facts` rows.
2. Pass the block list to the system prompt as: `BLOCKED_FACTS = ['fact 1', 'fact 2', ...]` with the instruction: "You may not use any of these facts in your output, even if they are true or relevant. They have been explicitly blocked by the user."
3. After generation, post-process the draft: normalize the model's output stats and check each against `lp_blocked_facts.factNormalized`. If any blocked fact leaks through (LLMs sometimes paraphrase), reject the generation and retry once with a more aggressive instruction. If it leaks twice, strip the offending sentence(s) and add a banner note: "Some content was filtered (blocked facts list)."
4. Telemetry: log when the model attempts a blocked fact, so you can audit which facts the model keeps trying to suggest despite the block. Useful for tuning the block-list prompt later.

Performance: blocked-facts list is typically small (<100 rows per tenant) — load it once per generation, not per-fact.

---

## Step 6 — UI: triage modal

### The banner

The existing "N stats were removed" banner at the top of the generated page stays, with one change: clicking it opens a modal instead of linking to Brand & Content.

The banner text becomes: **"N stats were removed by Strict AI Facts. [Review]"** with the Review button being the primary action.

### The modal

Title: **"Review removed stats"**

Subtitle: "These claims didn't match your approved facts. Decide what to do with each one."

Body — a table or list with each pending removed fact as a row:

| Stat | Where AI wanted it | Source context | Actions |
|---|---|---|---|
| (checkbox) "Used by 8,000+ dentists" | Hero subhead | "...with **8,000+ dentists** trust us across the country." | [Add back] [Save to brand] [Block] [Dismiss] |
| (checkbox) "Saves 47% chair time" | Stat strip · slot 2 | "Saves **47% chair time** vs traditional workflows" | [Add back] [Save to brand] [Block] [Dismiss] |

Layout details:

- **Source context** column shows the sentence the AI was going to use, with the stat bolded. Helps the user remember why the fact came up.
- **Where AI wanted it** column shows the block name + slot/position. Hover reveals a small thumbnail of that block.
- **Actions** are 4 buttons inline. Hover states clear; "Add back" + "Save to brand" both indigo (primary actions), "Block" is coral-tinted (destructive intent), "Dismiss" is gray (neutral close).
- Above the table: a select-all checkbox + bulk actions strip ("Add back all · Save all to brand · Block all · Dismiss all") that lights up when ≥1 row is checked.
- Below the table: a small "About Strict AI Facts mode" expandable explainer + a link to Brand & Content → Approved facts library.

### Per-row "Add back" UX

When the user clicks Add back on a row:

1. If `suggestedTargetBlockId` is non-null, the row collapses to show: "Adding to **{block name}** · [Undo]" + a 2-second progress spinner, then the row marks as resolved (green ✓ icon) and the underlying page updates in the builder behind the modal (visible if the modal is semi-transparent or the user closes it).
2. If `suggestedTargetBlockId` is null, the row expands to show a "Where should this go?" picker — list of compatible blocks on the page with thumbnails. User picks one, action proceeds.
3. If the target block is locked (returns 409), the row shows: "**{block name}** is locked. [Unlock & add] [Pick another block]"

### Bulk "Add back all"

When the user clicks Bulk Add Back with multiple rows selected:

1. The system tries to fit each fact into its `suggestedTargetBlockId`. If conflicts arise (e.g. 3 stats all want the same stat-strip slot), prompt the user to confirm which order to insert them.
2. After resolution, show a single confirmation: "Added 4 stats back to your page. [Undo all]"
3. Single undo button reverses the entire bulk in one transaction.

### Once a row is triaged

The row stays visible in the modal with a status badge ("✓ Added to Hero subhead" / "★ Saved to brand library" / "✕ Blocked from future generations" / "○ Dismissed") and grays out. The user can keep scrolling through remaining pending rows.

When all rows are triaged, the modal shows a summary footer: "**4 stats triaged · 2 added back · 1 saved · 1 blocked**. [Done]" and the banner on the page disappears.

### Modal close + persistence

If the user closes the modal mid-triage, the pending facts stay in `lp_page_removed_facts` with `triageState='pending'`. The banner stays visible on the page until all pending rows are triaged or dismissed. Re-opening the modal restores their pending state.

### Mobile

On `<md` viewport, the table collapses to a card-per-fact layout. Actions become a 2x2 grid below the source context. The bulk-action strip stays at the bottom with a sticky position so it's always reachable.

---

## Step 7 — Brand & Content integration

In Brand & Content > **Approved facts** (the existing surface where users review what the AI is allowed to say), add a new tab next to it: **Blocked facts**. Lists `lp_blocked_facts` rows, lets the user unblock any of them (which deletes the row, freeing the AI to suggest it again on future generations).

The "Add or review your approved facts" link in the Strict AI Facts banner on Brand & Content should now also surface a count of blocked facts: "**12 approved · 3 blocked**".

---

## Acceptance criteria

- [ ] `lp_blocked_facts` table created with `tenant_id NOT NULL` FK + index + unique on `(tenantId, factNormalized)` in the initial migration
- [ ] `lp_page_removed_facts` table created (or extended if existing) with `triageState` field defaulting to `'pending'`
- [ ] All 6 API endpoints exist + tenant-scoped + idempotent on `triageState`
- [ ] Banner now opens the triage modal instead of linking to Brand & Content
- [ ] Each pending row shows fact text + source context + suggested target block + 4 actions
- [ ] "Add back" injects into the suggested block without re-generating the page
- [ ] Locked blocks return 409 and the UI handles it gracefully
- [ ] Block list flows back into AI generation: blocked facts never appear in output (verified by triggering a generation with a known blocked fact and confirming it's absent)
- [ ] Brand & Content has a new "Blocked facts" tab with unblock action
- [ ] Strict AI Facts banner shows both counts ("12 approved · 3 blocked")
- [ ] Modal works on mobile (`<md` viewport) — cards instead of table, sticky bulk-action bar
- [ ] `pnpm typecheck` clean across all workspaces
- [ ] Smoke test: generate a page with strict facts on, get N removed facts, triage them, verify the page state matches the triage decisions

## Don't

- Don't silently mutate locked blocks when adding back — always return 409 and let the user choose
- Don't store the full AI draft in `lp_page_removed_facts.originalContext` — just the sentence containing the fact, ~140 chars. Bigger storage will balloon the table.
- Don't make "Block" require a reason — make the reason field optional. Friction here means users will Dismiss instead of Block, defeating the point.
- Don't re-run the full AI generation when adding a fact back — only update the target block's content
- Don't pop the modal automatically on page load. Banner stays clickable; let the user open it on their own timing.
- Don't lose the pending facts if the user navigates away mid-triage. State persists in DB; banner reappears when they return.
- Don't refactor the existing approved-facts (`lp_proof_points`) flow as part of this PR. Keep it scoped to the new triage layer.
