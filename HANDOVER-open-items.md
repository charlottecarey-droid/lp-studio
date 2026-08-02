# Handover — two open items (2026-08-02)

Everything else from this session is committed and pushed to `staging`
(through `d8ee64ff3`). These two were identified but **not started**.

Background for both lives in `~/.claude/projects/.../memory/`:
`og-capture.md` (share cards + email embed) and `marketo-sync.md`.

---

## 1. Email embed button doesn't open the choose-a-link modal

**Reported:** "when I open the page view the email embed button doesn't open
the modal to choose the link type."

**Status:** not reproduced on the Pages table. Its envelope *does* open the
modal — verified in production and again locally with all of today's changes.
So the report is almost certainly about a different surface.

**What's actually inconsistent.** The modal only exists in `sales-pages.tsx`.
Three other places have envelope buttons that call `copyEmailPreview()`
directly and copy on click with no modal:

| Surface | File | Notes |
|---|---|---|
| Page drill-down → Links tab | `artifacts/lp-studio/src/pages/sales/SalesPageDrillDown.tsx` (~line 461, `copyPreviewForToken`) | Per-hotlink. Contact already chosen, so "choose the link type" is arguably meaningless here — but it has **no Gmail/Mail compose buttons**, which is a real gap. |
| Accounts → microsites tab | `artifacts/lp-studio/src/pages/sales/sales-accounts.tsx` (~2807, `handleCopyEmailPreview`) | Page-level. **Most likely what she clicked.** |
| Contacts | `artifacts/lp-studio/src/pages/sales/sales-contacts.tsx` (~1672) | Per-contact hotlink row. |

**First step:** ask which screen, or just make them consistent — the answer is
the same either way.

**Suggested fix.** Extract the modal out of `sales-pages.tsx` into
`components/sales/EmailPreviewModal.tsx` and reuse it. It currently depends on
this local state, all of which needs to move with it:
`emailPreviewModal`, `epSearch`, `epAllContacts`, `epContactsLoading`,
`epBusyKey`, `epCopiedKey`, `epOutreach`, plus `copyPreviewTo`,
`copyPersonalizedPreview`, `openComposerFor` and the debounced contact-search
`useEffect`.

Wire page-level buttons (Accounts microsites tab) to open it. For the
per-hotlink rows in the drill-down and Contacts, a modal is the wrong shape —
give them the Gmail + Mail compose buttons instead, matching the pair now in
the Pages modal.

**Don't regress:** the copy call must stay decoupled from the compose call — a
clipboard failure must not swallow the draft (see `copyPreviewTo` in
`sales-pages.tsx`), and the compose body always carries the URL so an
un-pasted send still works.

---

## 2. Marketo lists are cached but nothing displays them

**Reported:** "where do lists go? I can't see them."

**Status:** confirmed — they go into the database and no screen reads them.
Searched the whole frontend: **zero references** to the lists endpoint.

**What already works (server side):**
- `GET /api/sales/marketo/discover/lists` — returns the cached rows.
- `POST /api/sales/marketo/discover/refresh` and the "Refresh Lists" button
  populate `marketo_lists`.
- Dandy SMB (tenant 5, connection 462) currently holds **300 static lists +
  20 programs**, sitting invisible.

**What's missing:** any UI. `artifacts/lp-studio/src/pages/sales/marketo-settings.tsx`
has the Refresh buttons but never renders the result.

**Why it matters:** of the three things she wanted from Marketo (accounts,
contacts, lists for emailing), lists are the **only** one Marketo can actually
deliver today — accounts don't come from Marketo at all, and contacts need
Salesforce data first. The data is already there; it just needs a surface.

**Suggested scope:** a "Lists" section on the Marketo settings page —
searchable table of name / type / Marketo id / member count if available,
static lists and programs separated. Then decide whether picking a list should
do something (feed an audience / campaign), or whether read-only visibility is
enough for now. Worth asking before building the picker.

**Related, same file:** "Refresh Programs" and "Refresh Lists" both call
`discoverLists()` — they are duplicate buttons. Either differentiate them or
remove one.

---

## Marketo — test COMPLETE, recommendation below

The test ran. Everything below is measured, not inferred. Full background in
`memory/marketo-sync.md`.

### What was broken (three separate things)

1. **Global `salesforce_id` uniqueness** — one Salesforce record could exist in
   only one workspace platform-wide. Fixed, migration 0133.
2. **15-vs-18 Salesforce ID mismatch** — Marketo returns 18-character ids
   (`marketoIdLengths: [18]`, measured); every contact here stores 15. Exact
   string comparison could never match, which is the entire "0 created, 0
   updated, 100% skipped" story. Fixed in `296f0c5de` — both match paths
   compare `left(id, 15)`.
3. **Scan-everything design** — still unfixed, see below.

### Measured result (ENT, 3,197 leads sampled across 27 of 300 lists)

| | |
|---|---|
| Leads carrying a Salesforce contact id | 2,208 (69%) |
| Matches with the OLD exact comparison | **0** |
| Matches with the fix | **3** (1 enrich, 2 create-under-account) |

So the fix works — and the ceiling is still low. Extrapolated across 851k
leads that is roughly 800 matches: a few hundred contacts enriched with lead
scores, a few hundred created under existing accounts. Order of magnitude
only; the sample is the first 27 lists, not random.

### RECOMMENDATION

**1. Build the Marketo lists UI (item 2 above). Highest value, lowest risk.**
It is the only one of the three original goals — accounts, contacts, lists for
emailing — that Marketo can actually serve. 320 lists are already cached on
each tenant; the only missing piece is a screen.

**2. Do NOT enable the lead sync as it stands.** A full run scans 851,000 leads
to find ~800 matches, on a 15-minute poller, forever. Even after batching the
per-lead queries the cost/benefit is poor.

**3. If enrichment is wanted, invert the sync instead of batching it.** The
current design scans every lead hoping to hit one of our contacts. Marketo's
API can be queried the other way — leads BY Salesforce contact id, 300 ids per
call. 7,781 contacts becomes ~26 API calls, finds every match rather than
whatever a scan reaches, and needs no poller (on-demand or nightly).
**Verify first:** Marketo requires a field to be marked searchable for that
filter, so confirm `sfdcContactId` is queryable on the instance (~10 min).

**4. Leave the sync disabled on BOTH tenants** until 3 is done. Note that
`sync_enabled` defaults to `true` for any newly connected tenant.

### Other unfixed Marketo bugs (all small, all cost a day of confusion)

- A run skipping 100% of records reports **"Completed"**. Should warn.
- Crashed runs stay `status='running'` forever — nothing reaps them (17 stale
  rows in SMB). Reap on boot.
- `importLeads` never re-checks `sync_enabled` mid-run, so disabling the toggle
  does not stop an in-flight run — only a process restart does.
- The migration advisory lock is **session-scoped over a pgbouncer-pooled
  connection**, so a migration that crashes mid-run can strand the lock and
  block the next deploy (this happened). `pg_advisory_xact_lock` releases on
  rollback and cannot leak. Note the error message advises
  `pg_terminate_backend(<pid>)` — that pid is a SHARED pooled backend serving
  live traffic, not a stray migration, so following that advice is risky.

### State / cleanup

- SMB (tenant 5) contains **345 throwaway contacts + 20 accounts** imported for
  this test. The 3 original contacts were deleted, so *everything* in tenant 5
  is now test data — delete wholesale rather than by id cutoff.
- Temporary Neon branch `test-0133-migration` (`br-rough-cell-amqwt7wl`) used to
  verify migration 0133 and the relink queries. Safe to delete.
- Both tenants: `sync_enabled = false`. ENT list cache now populated (320).
