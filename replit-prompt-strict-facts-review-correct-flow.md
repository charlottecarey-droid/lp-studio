# Replit prompt — Strict Facts mode: fix the review flow

## What's broken today

The current Strict Facts banner ("13 stats on this page aren't in your approved facts") opens a modal where each flagged stat has an editable input and a single **Add to Brand Settings** button. That's it. Users can't:

- **Remove** an unapproved stat from the page
- **Swap** it for an existing approved stat
- **Edit** it inline and have the edit save to approved facts in one shot
- **Decline to review now** and come back later
- Get **a second warning at publish time** before shipping unapproved stats

The principle is missing from the implementation: **we don't ship unapproved stats by default.** Every flagged stat must be intentionally resolved before publish, OR the user explicitly bypasses the warning twice.

## The correct flow

### 1. After AI generation

User generates a page. Strict Facts mode is on. Server scans the output, identifies unapproved stats, inserts pending flag rows in `lp_page_fact_flags`. Page renders with all stats included (don't auto-strip).

**Immediate alert** (modal, not banner):

> ⚠️ **N stats on this page aren't in your approved facts**
>
> They'll stay on the page so you can review them, but you'll need to resolve each one before publishing.
>
> [Review now] [Review later]

- **Review now** → opens the review modal (Step 3).
- **Review later** → dismisses the alert. The yellow banner at the top of the builder stays visible until all flags are resolved. The banner is clickable and opens the review modal.

### 2. The banner (persistent)

When pending flags exist, a yellow banner stays at the top of the builder:

> ⚠️ N stats on this page aren't in your approved facts. **[Review →]**

Click → opens the review modal. The banner disappears once all flags are resolved.

### 3. The review modal — per-stat actions

For each pending flag, show one row with **all four actions** visible (no nested menus):

```
┌──────────────────────────────────────────────────────────┐
│ business-case-centered · props.costItems[0].stat         │
│                                                          │
│ "7.2%" — in context: "...delivering 7.2% improvement..." │
│                                                          │
│ [✓ Add to brand] [✎ Edit & save] [⇄ Swap] [✕ Remove]    │
└──────────────────────────────────────────────────────────┘
```

The four actions:

1. **✓ Add to brand** — the AI was right, the user endorses the stat. Stat stays on page; insert into `lp_proof_points`; flag marked `triageState='approved'`.

2. **✎ Edit & save** — user clicks → the row expands with a text input pre-filled with the current value. User types a correction (e.g. "7.2%" → "6.8%"). On confirm: the page block's text is updated to the new value AND the new value is inserted into `lp_proof_points`. Flag marked `triageState='edited'`. (Edit always promotes to approved — that's the contract.)

3. **⇄ Swap** — user clicks → the row expands with a searchable dropdown listing every fact in `lp_proof_points` (filterable by `factKind` so swapping a "%" only suggests other %-shaped facts). User picks one → the swapped fact replaces the flagged one on the page. Flag marked `triageState='swapped'`. Page hot-updates.

4. **✕ Remove** — strips the stat from the page block. If removing the stat alone would leave a sentence fragment (e.g. "delivering improvement"), strip the whole sentence (heuristic — server determines). Flag marked `triageState='removed'`. No library change.

### Once a row is resolved

The row collapses to show what was done with a status pill (`✓ Added to brand` / `✎ Edited to "6.8%"` / `⇄ Swapped with "5.4% YoY"` / `✕ Removed`) and an **Undo** affordance (10-second window, single-click reversal).

### Modal footer

```
4 of 13 resolved · 9 remaining           [Close]
```

User can close the modal at any time. Pending flags stay in `triageState='pending'`. Banner stays visible. Next time they open the page, the banner is still there.

### 4. The publish gate (second warning)

When the user clicks **Publish** with pending flags still present:

> ⚠️ **N unapproved stats are still on this page**
>
> Publishing now will ship them as-is. We strongly recommend reviewing each one — unapproved stats are the most common source of compliance issues.
>
> [Review now] [Publish anyway]

- **Review now** → cancels the publish, opens the review modal.
- **Publish anyway** → triggers a **second confirmation**:

> Are you sure?
>
> 9 unapproved stats will ship on this page. This decision is logged.
>
> [Yes, publish] [Cancel]

If the user clicks "Yes, publish," the page publishes with all unapproved stats intact. The publish event is logged with the list of unapproved stats that were knowingly shipped (`page_published_with_unapproved_facts` telemetry event). Banner clears (page is now live with the user's explicit acceptance).

If they cancel, nothing happens; pending flags + banner persist.

**This is the only path to ship unapproved stats: explicitly bypass two confirmations.**

---

## Step-by-step implementation

### Step 1 — Audit current state

Read:

- The current banner component (likely in `BuilderEditor.tsx` or a `StrictFactsBanner.tsx`)
- The current review modal — find its file path
- The flag-storage layer — probably `lp_page_fact_flags` (already exists per the screenshot)
- The publish endpoint — likely `routes/lp/pages.ts:publish`
- The approved facts table: `lp_proof_points`

Put a 5-line summary in the PR description.

### Step 2 — Update `lp_page_fact_flags` state machine

The current `triageState` likely only has `'pending'` and `'approved'`. Add three more values:

- `'pending'` — initial state
- `'approved'` — Add to brand action
- `'edited'` — Edit & save action; `replacementText` column populated
- `'swapped'` — Swap action; `swappedWithProofPointId` column populated (new FK → `lp_proof_points.id`)
- `'removed'` — Remove action

Migration: add `replacementText TEXT NULLABLE` and `swappedWithProofPointId INTEGER NULLABLE FK → lp_proof_points(id)`. Add a CHECK constraint or just enum on `triageState`.

### Step 3 — API endpoints (extend existing, add new)

```
GET    /api/lp/pages/:pageId/fact-flags?state=pending
       — list pending flags for the modal

POST   /api/lp/pages/:pageId/fact-flags/:flagId/approve
       — Add to brand: insert into lp_proof_points; mark 'approved'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/edit
       Body: { replacementText: string }
       — update block text in place; insert replacementText into lp_proof_points;
         mark 'edited'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/swap
       Body: { proofPointId: number }
       — update block text by replacing flagged fact with proof-point text;
         mark 'swapped'; record swappedWithProofPointId

POST   /api/lp/pages/:pageId/fact-flags/:flagId/remove
       — strip fact from block (sentence-aware); mark 'removed'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/undo
       — within 10 seconds of a resolution, reverse the action

POST   /api/lp/pages/:pageId/publish
       — if any pending flags exist: return 409 with the flag list
         UNLESS body has { acknowledgeUnapprovedFacts: true } which lets
         publish proceed with pending flags intact. Server logs the
         knowingly-shipped facts list to telemetry.
```

All routes: `requireAuth`, `getTenantId`, tenant-scoped queries. Transactional per action.

### Step 4 — Post-AI-generation alert

After a successful AI page generation, the response payload should include `{ pendingFactFlagCount: N }`. In the builder, when this number is > 0, immediately show the alert modal (Step 1 above) with Review now / Review later buttons. Use the existing modal system; don't reinvent.

### Step 5 — Yellow banner (already exists; minor changes)

The banner is already there with the count and the link. Update:

- Make it clickable across its full width (currently only "Review stats" text appears clickable)
- The CTA text: change "Review stats" + "Open Brand Settings →" to just **"Review →"** (single primary action)
- When all pending flags are resolved, the banner hides itself with a brief "✓ All stats reviewed" confirmation that fades after 3s

### Step 6 — Review modal redesign

Replace the existing modal with the 4-action-per-row layout from Step 3 above. Key components:

- **Row** with the flag's context (block ID + field + factText + surrounding sentence)
- **4 action buttons** visible at all times (no dropdowns hiding actions)
- **Inline edit input** that expands on Edit click
- **Inline swap dropdown** that opens on Swap click — searchable + grouped by `factKind`
- **Resolved-state collapse** with status pill + Undo button
- **Footer counter**: `4 of 13 resolved · 9 remaining`
- Modal does NOT block the page; it's a side sheet or large modal that the user can close mid-triage

### Step 7 — Publish gate

In the publish flow:

- Before submitting publish, check pending flag count via the existing endpoint.
- If > 0: intercept the publish click; show the publish-time warning modal (Step 4 above).
- "Review now" → cancel publish + open review modal.
- "Publish anyway" → show second confirmation modal ("Are you sure? N stats will ship."). On confirmation, retry publish with `{ acknowledgeUnapprovedFacts: true }`. Log telemetry event.

### Step 8 — Telemetry

Fire events:

- `strict_facts_review_opened` — when user opens the review modal (track from-alert vs from-banner vs from-publish-warning)
- `strict_facts_action` — when a flag is resolved (action + fact + factKind)
- `strict_facts_review_dismissed` — Review later clicked
- `strict_facts_publish_with_unapproved` — publish-anyway confirmed (count + flag IDs)

---

## Acceptance criteria

- [ ] After AI generation, the alert modal appears with [Review now] [Review later] buttons
- [ ] Yellow banner persists until all flags are resolved
- [ ] Review modal shows each flag with all 4 actions visible (Add to brand · Edit · Swap · Remove)
- [ ] Edit pre-fills with current value; saving updates the page block AND adds new value to lp_proof_points
- [ ] Swap dropdown lists approved facts filterable by factKind; selecting one updates the page block AND records the link
- [ ] Remove strips the fact (sentence-aware for fragments); doesn't change the library
- [ ] Add to brand keeps the fact on the page AND inserts into lp_proof_points
- [ ] Undo works within 10 seconds of any resolution
- [ ] Publish with pending flags returns 409 unless `acknowledgeUnapprovedFacts: true`
- [ ] Publish-anyway requires a second confirmation modal
- [ ] All four resolution paths are logged to telemetry
- [ ] `pnpm typecheck` clean
- [ ] Smoke test: generate page → see alert → click Review later → banner stays → re-open builder → banner still there → click Publish → see publish warning → click Publish anyway → see second confirmation → confirm → page publishes with pending flags shipped + telemetry logged

## Don't

- Don't auto-strip flags pre-render. The page must show the AI's full output; the user reviews and decides.
- Don't hide any of the 4 actions behind a dropdown. All four visible all the time.
- Don't allow publish with pending flags without TWO confirmations. The whole point is "explicit ignore twice."
- Don't change `lp_proof_points` schema. The approved-facts library is the source of truth; this PR only adds rows to it via the resolution actions.
- Don't add a "Block forever" action in this PR. It's a useful future enhancement but not in the scope Charlotte described.
- Don't strip the flag context (surrounding sentence) from the modal. Users need to see the stat where it lives, otherwise the resolution decision is uninformed.
- Don't keep the existing modal's "Open Brand Settings →" footer link as the primary action. The modal IS the brand-settings flow for these stats; redirecting to Brand Settings was the broken pattern.
