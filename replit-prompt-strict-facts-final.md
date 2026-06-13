# Replit prompt — Strict Facts mode: simplified review flow

## What we're building

A review flow that lets users ship pages with AI-generated stats they trust **without forcing every stat into the global approved-facts library**. The library is for reusable facts. Page-level approval is for one-off facts (account-specific, quarter-specific, campaign-specific). Today's UX conflates the two — fix that.

## What's broken today

- The Strict Facts banner opens a modal where the only per-row action is "Add to Brand Settings."
- There's no way to remove, swap, or approve-for-this-page-only.
- Sales reps generating per-account microsites have 13 account-specific stats and no fast path to ship — they either pollute their library by adding each one, or they have to manually rewrite the page.
- There's no publish gate, so users can silently ship unapproved stats.

## The new flow

### 1. After AI generation

Server scans the output, identifies unapproved stats, inserts pending flag rows. Page renders complete (no auto-strip). A **yellow banner** appears at the top of the builder:

> ⚠️ **N stats need review · [Review →]**

No post-generation modal. No interrupt. Just the banner. Click → review modal opens.

### 2. The review modal

Layout (showing a mix of stat, claim, and quote rows — the same 4 actions apply to all three kinds):

```
┌─ Review facts (13 pending) ──────────────────────────────┐
│                                                          │
│  [✓ Approve all for this page]                           │
│                                                          │
│  ─── or review each one ───                              │
│                                                          │
│  STAT · business-case-centered · costItems[0]            │
│  "7.2%" — "...delivering 7.2% improvement..."            │
│  [✓ Approve]  [✎ Edit]  [⇄ Swap]  [✕ Remove]            │
│                                                          │
│  STAT · business-case-centered · costItems[2]            │
│  "$35k" — "...saves $35k per case..."                    │
│  [✓ Approve]  [✎ Edit]  [⇄ Swap]  [✕ Remove]            │
│                                                          │
│  QUOTE · testimonial · pull-quote-2                      │
│  "We replaced three vendors with one workspace."         │
│  — Priya Anand, VP Marketing, Cobalt Systems             │
│  [✓ Approve]  [✎ Edit]  [⇄ Swap]  [✕ Remove]            │
│                                                          │
│  CLAIM · hero · trust-line                               │
│  "Trusted by 8,000+ dentists"                            │
│  [✓ Approve]  [✎ Edit]  [⇄ Swap]  [✕ Remove]            │
│                                                          │
│  ... 9 more ...                                          │
│                                                          │
│  4 of 13 resolved · 9 remaining                          │
│                                  [Close]  [Publish →]    │
└──────────────────────────────────────────────────────────┘
```

Each row has a small `STAT / CLAIM / QUOTE` label in the top-left so the user can tell at a glance what kind of content they're reviewing. The row body renders the content appropriately — stats and claims as one line; quotes as a two-line block (quote on top, attribution underneath).

### Per-row actions

The same 4 actions apply to all three `factKind`s (stat, claim, quote) but with kind-specific UX details called out below.

1. **✓ Approve** — keeps the fact on the page as-is. Flag marked `triageState='approved_for_page'`. **Does NOT touch the global library.** A small secondary link appears below the resolved row: "+ Also save to library" — one-click upgrade if the user wants to reuse this fact.

   **Quote-specific:** clicking Approve on a `factKind='quote'` row opens a small confirmation: *"Confirm this is a real quote and you have permission to use it on this page."* with a single OK button. Friction is intentional — approving a made-up testimonial is a compliance problem (you're putting words in a real or fake person's mouth). The confirmation is logged to telemetry as `strict_facts_quote_approve_confirmed`.

2. **✎ Edit** — row expands with a text input pre-filled with the current value. User edits, clicks Save. Page block is updated to the new value. Flag marked `triageState='edited'`. Same "+ Also save to library" secondary link after save.

   **Quote-specific:** the edit expander shows two inputs — the quote body AND the attribution (name / title / company). All three are pre-filled; user can change any. This makes "fix a typo in the title" easy without forcing the user to retype the whole quote.

3. **⇄ Swap** — row expands with a searchable dropdown listing approved facts from `lp_proof_points`, filtered by `factKind`. Picking one replaces the flagged content on the page. Flag marked `triageState='swapped'` with `swappedWithProofPointId` set.

   **Quote-specific:** the Swap dropdown for quotes renders each approved quote as a multi-line card (quote text + attribution name/title/company + small photo if present), not a one-line text option. Users need to see who said it before picking. The dropdown also has a "Search by name, company, or text…" filter at the top. **This is the highest-leverage action for quotes** — sales reps with a vetted testimonial library will swap their way through unapproved AI quotes faster than any other path.

4. **✕ Remove** — strips the fact from the page block. If removing the fact alone would leave a sentence fragment, strip the whole sentence (server-side heuristic). For quotes, strip the entire quote + attribution + any surrounding quote-card chrome — don't leave a half-empty testimonial slot. If removing a quote leaves the parent block empty, leave the block scaffolding (empty Testimonial block) so the user can populate it manually; don't auto-delete the block. Flag marked `triageState='removed'`.

### Bulk action

**[✓ Approve all for this page]** at the top of the modal — single click marks every pending flag as `triageState='approved_for_page'`. Doesn't touch the library. This is the sales-microsite happy path: 13 account-specific stats → 1 click → ship.

### Resolved rows

Collapse to a one-line status: `✓ Approved for this page` / `✎ Edited to "6.8%"` / `⇄ Swapped with "5.4% YoY"` / `✕ Removed`. Each shows an Undo button for 10 seconds.

### Modal footer

`N of M resolved` counter + `[Close]` + `[Publish →]` button (right-aligned, primary). Publish button is disabled while pending flags exist. Once all are resolved, button becomes enabled.

### 3. Publish gate

When the user clicks Publish from the builder (outside the modal):

- **All flags resolved** → publishes normally.
- **Pending flags exist** → the review modal opens directly with a different primary CTA at the bottom:

```
9 stats still pending. Approve them or resolve each before publishing.
                                  [Close]  [Approve all & publish →]
```

Clicking **Approve all & publish** does the bulk-approve action AND publishes in one transaction. The decision is logged to telemetry as `published_with_bulk_approve` so you can track how often users use the fast path.

No separate "Publish anyway" confirmation modal. The review modal IS the gate.

---

## Step 1 — Audit current state

Read:

- The current Strict Facts banner component (probably in `BuilderEditor.tsx` or `StrictFactsBanner.tsx`)
- The current review modal — find file path
- The fact-flag storage layer: `lp_page_fact_flags` (or whatever it's called — should exist per the screenshot showing 13 flagged stats)
- `lp_proof_points` (approved facts library)
- The publish endpoint
- The AI generation pipeline + post-generation fact detection
- The flag-detection logic — does it currently look for numeric stats only, or also claims/quotes/percentages? Note for Step 2.

5-line summary in PR description.

---

## Step 2 — Data model changes

### Update `lp_page_fact_flags` state machine

`triageState` values:

- `'pending'` — initial, fresh from AI
- `'approved_for_page'` — kept on page, NO library write
- `'edited'` — page text updated, NO library write unless user also clicked "Also save to library"
- `'swapped'` — replaced with an approved fact
- `'removed'` — stripped from page

Add columns:

- `replacementText TEXT NULLABLE` (for `edited`)
- `swappedWithProofPointId INTEGER NULLABLE FK → lp_proof_points(id)` (for `swapped`)
- `librarySaved BOOLEAN DEFAULT FALSE` — true if the user clicked "Also save to library" on this flag

Migration: add columns + CHECK constraint on the enum. `tenant_id NOT NULL` already in place.

### Detection scope (in the fact extractor)

Detect three kinds of unapproved content:

- **Numeric stats** — percentages (7.2%), dollar amounts ($35K), counts (8,000+, 12+, +185), durations (47 days). `factKind = 'stat'`.
- **Named-entity claims** — "Trusted by [Name]", "Used by [Name]", "[Name] customers". `factKind = 'claim'`.
- **Customer quotes / testimonials** — anything inside quotation marks with an attribution (name + title and/or company). E.g. `"We replaced three vendors with one workspace." — Priya Anand, VP Marketing, Cobalt Systems`. `factKind = 'quote'`. Detection rule: look for any text inside paired smart-quotes or straight quotes that's ≥6 words AND has an attribution within ~20 chars after the closing quote. Also detect quotes inside Testimonial / PullQuote / QuoteBlock block types regardless of punctuation — those are quote slots by definition.

Don't detect:
- Adjectives ("fastest", "most reliable") — different compliance problem
- Generic copy without numbers, names, or quotation marks

### Quote storage shape

`lp_proof_points` rows of `factKind = 'quote'` should carry an attribution payload. If the existing schema doesn't already have these columns, add them in this migration:

- `attributionName` TEXT — "Sarah Chen"
- `attributionTitle` TEXT — "CRO"
- `attributionCompany` TEXT — "Apex Systems"
- `attributionPhotoUrl` TEXT NULLABLE
- `attributionConsentNote` TEXT NULLABLE — free-text reminder from the user (e.g. "Verbal consent on the Aug 12 call · email confirmation in CRM")

For non-quote `factKind`s, the attribution fields stay null.

### Fuzzy phrasing match

When checking detected stats against `lp_proof_points`, do fuzzy matching on the numeric kernel + entity. E.g., if approved is "8,000+ dentists trust us" and AI writes "trusted by over 8,000 dentists," the numbers + entity match → don't flag. Implement with a normalizer that extracts the numeric value(s) + the noun phrase and compares as a tuple, not a string-equality check.

### Regen memory

When a page is regenerated, before flagging new stats, check `lp_page_fact_flags` for `pageId = current` AND `triageState != 'pending'`. If the new AI output proposes a stat that was previously resolved on this page (matched by `factNormalized`), auto-apply the same decision and don't flag it. This avoids whack-a-mole.

### Scope

Strict Facts review applies to **every AI-generated prose surface** — landing pages, microsites, one-pagers, AI email drafts. Each surface that runs AI generation must call the fact-flag detection + writing flow, and each must render the banner + review modal in its respective editor UI.

For template-authored content: when a template is seeded, the template's authored stats are pre-inserted into a system-managed corner of `lp_proof_points` (or tagged `source='template'` on existing rows). So using a vetted template = no flags.

---

## Step 3 — API endpoints

```
GET    /api/lp/pages/:pageId/fact-flags
       — returns all flags (with state), banner uses this to count

POST   /api/lp/pages/:pageId/fact-flags/:flagId/approve-for-page
       — keep on page, no library change; mark 'approved_for_page'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/edit
       Body: { replacementText: string }
       — update block text; mark 'edited'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/swap
       Body: { proofPointId: number }
       — replace flagged text with proof-point text; mark 'swapped';
         record swappedWithProofPointId

POST   /api/lp/pages/:pageId/fact-flags/:flagId/remove
       — strip from block (sentence-aware fragment handling);
         mark 'removed'

POST   /api/lp/pages/:pageId/fact-flags/:flagId/save-to-library
       — secondary action: insert factText (or replacementText, if edited)
         into lp_proof_points; mark librarySaved = true.
         Only valid when flag is in approved_for_page or edited state.

POST   /api/lp/pages/:pageId/fact-flags/:flagId/undo
       — within 10 seconds, revert the last action on this flag

POST   /api/lp/pages/:pageId/fact-flags/bulk-approve
       — sets all pending flags on the page to approved_for_page
         in one transaction

POST   /api/lp/pages/:pageId/publish
       — refuses with 409 + flag list if any pending flags exist
       — accepts { bulkApproveAndPublish: true } which calls
         bulk-approve in the same transaction and publishes

GET    /api/proof-points?factKind=percentage
       — for the Swap dropdown; returns approved facts filtered
         by factKind, plus an "Show all kinds" option
```

All routes: `requireAuth`, `getTenantId`, tenant-scoped queries. Transactional per action.

---

## Step 4 — Banner

Replace the existing banner. New version:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠ N stats need review                       [Review →]  │
└──────────────────────────────────────────────────────────┘
```

- Yellow (amber) background, single CTA on the right.
- Clickable across the full width.
- Hides itself with a fading "✓ All stats reviewed" toast when count drops to 0.

---

## Step 5 — Review modal

Replace the existing modal. Layout per Step 2 above. Implementation notes:

- **Bulk approve button** at the top — disabled until pending flags exist, primary indigo styling.
- **Per-row actions** as 4 buttons always visible (no hidden dropdowns). Equal weight visually; no single "primary" action — the user picks.
- **Edit expansion** in place — clicking ✎ Edit replaces the action row with an input + Save/Cancel.
- **Swap expansion** in place — clicking ⇄ Swap replaces the action row with a searchable dropdown of approved facts (filterable by factKind, default-filtered to match). If the tenant has 0 approved facts of matching kind, the dropdown shows: "No approved facts in this category — try adding one in Brand Settings."
- **"+ Also save to library"** appears below each resolved row when state is `approved_for_page` or `edited`. One click, no confirmation. Sets `librarySaved=true` and inserts into `lp_proof_points`.
- **Undo button** appears on resolved rows for 10 seconds, single-click reverses to pending.
- **Footer counter** `N of M resolved · K remaining` + Close button + Publish button.
- **Publish button** disabled while any flag is pending. Enabled when all resolved. Clicking publishes the page.

Mobile: row layout collapses to stacked vertical (action buttons in a 2x2 grid below the context line). Bulk approve button stays sticky at top.

---

## Step 6 — Publish gate

In the builder's publish flow (outside the modal):

- User clicks Publish → check pending flag count via the existing API.
- If 0 pending → publish normally.
- If > 0 pending → open the review modal with footer CTA changed from `[Publish →]` to `[Approve all & publish →]`. Clicking that CTA calls `POST /publish { bulkApproveAndPublish: true }` which performs both actions transactionally.

No separate intermediate warning modal. The review modal is the only review-and-publish surface.

---

## Step 7 — Brand & Content unchanged for now

Don't restructure Brand & Content > Approved facts. The library remains the source of truth for reusable facts. The new "approved for this page" state is page-scoped only and doesn't show up in Brand Settings.

Optional later: a "Page-specific approvals" rollup in Brand & Content that shows facts approved-for-page across all pages in the workspace, with a bulk "promote to library" action. Not in this PR.

---

## Step 8 — Telemetry

Fire events:

- `strict_facts_flag_created` — server-side, per flag at generation time (factKind + factText + tenant)
- `strict_facts_action` — per resolution (action: approve/edit/swap/remove)
- `strict_facts_bulk_approve` — when the bulk button is used (flag count)
- `strict_facts_library_upgrade` — when "Also save to library" is clicked
- `published_with_bulk_approve` — when the bulk-approve-and-publish path is taken (flag count)
- `strict_facts_modal_dismissed` — close button hit with pending flags remaining

---

## Acceptance criteria

- [ ] Banner shows count + "Review →" CTA, hides when count is 0
- [ ] Review modal opens with [Approve all for this page] button at the top
- [ ] Each row shows 4 actions: Approve · Edit · Swap · Remove
- [ ] Each row shows a kind label: STAT / CLAIM / QUOTE
- [ ] Fact extractor detects all three kinds: numeric stats, named-entity claims, and customer quotes (text in quote marks with attribution, OR text inside Testimonial/PullQuote/QuoteBlock block types)
- [ ] Approve keeps the fact on page and does NOT modify lp_proof_points
- [ ] **Quote-Approve shows a one-step "confirm this is a real quote you have permission to use" prompt before resolving**
- [ ] "Also save to library" link appears on approved/edited rows; one-click inserts into lp_proof_points
- [ ] Edit updates page block text in place; does not modify library unless user clicks the secondary link
- [ ] **Quote-Edit shows two inputs (quote body + attribution name/title/company), not just one**
- [ ] Swap dropdown lists approved facts filtered by factKind, with "No matching facts" state
- [ ] **Quote-Swap dropdown renders each approved quote as a multi-line card (quote + attribution + photo if present), searchable by name/company/text**
- [ ] Remove strips the fact with sentence-aware fragment handling
- [ ] **Quote-Remove preserves the empty Testimonial block scaffold; doesn't delete the block**
- [ ] `lp_proof_points` rows of factKind='quote' carry attribution fields (name/title/company/photo/consent note); migration added if not present
- [ ] Undo works within 10 seconds of any resolution
- [ ] Bulk approve resolves all pending flags as approved_for_page in one transaction (including quotes — but those still fire the per-quote confirm prompt OR the bulk button shows a single batch-confirm modal listing how many quotes are about to be approved)
- [ ] Publish button is disabled when pending flags exist
- [ ] Clicking publish with pending flags opens the modal with "Approve all & publish" CTA
- [ ] Bulk-approve-and-publish runs as a single transaction
- [ ] Regen on a page where flags were previously resolved auto-applies prior decisions (no re-flag)
- [ ] Fuzzy match prevents flagging stats whose numeric kernel + entity match an approved fact
- [ ] Fuzzy match prevents flagging quotes whose first 8 words + attribution name match an approved quote
- [ ] Strict Facts review applies to landing pages, microsites, one-pagers, AND AI email drafts
- [ ] Mobile modal works (row layout collapses, bulk button sticks at top, quote cards in Swap dropdown stay legible)
- [ ] All telemetry events fire (including `strict_facts_quote_approve_confirmed`)
- [ ] `pnpm typecheck` clean
- [ ] Smoke test: sales rep generates per-account microsite with 13 flagged facts (8 stats, 4 claims, 1 quote) → opens review modal → swaps the quote with a vetted testimonial → clicks "Approve all for this page" for the remaining 12 → clicks Publish → page publishes. Total clicks from "page generated" to "page live": 5 (banner → swap → pick quote → bulk approve → publish).

## Don't

- Don't add an immediate post-generation modal. Just the banner.
- Don't make "Add to library" the default. Page-level approval is the primary path; library upgrade is the optional follow-up link.
- Don't auto-strip flags pre-render. The AI's output stays on the page until the user decides what to do with it.
- Don't show a separate "Publish anyway" confirmation modal. The review modal is the only gate.
- Don't add a "Block forever" action in this PR. Useful later, not now.
- Don't hide any of the 4 actions behind a dropdown. All four visible always.
- Don't remove any existing approved facts from `lp_proof_points`. This PR only adds rows to it (via secondary library upgrade).
- Don't show flags on published / live pages — builder/draft view only.
- Don't refactor `lp_proof_points` schema beyond adding the quote-attribution columns. It's the source of truth for reusable approved facts.
- Don't promote page-approved facts to the library automatically. Page-scoped approval stays page-scoped unless the user explicitly clicks the upgrade link.
- Don't auto-strip quotes whose body looks "off." False positives on quote detection should err toward not-flagging. (Better to leak a real quote that's slightly off than to surface every paraphrase as a flag.)
- Don't let the Swap-with-approved-quote dropdown render quotes as single-line text — multi-line cards with attribution are the whole point. The user needs to see the human, not just the words.
- Don't skip the "confirm this is a real quote" prompt on Approve for quotes. Approving a hallucinated testimonial is the single biggest compliance risk in this feature; the prompt is the cheap insurance.
