# Handover — two open items (2026-08-02)

Both items below are now **BUILT** (not yet verified on Replit — the authed
sales screens can't render locally without the API server + DB). Everything
else from this session is committed and pushed to `staging`.

Background for both lives in `~/.claude/projects/.../memory/`:
`og-capture.md` (share cards + email embed) and `marketo-sync.md`.

---

## 1. Email embed button doesn't open the choose-a-link modal — DONE

**Reported:** "when I open the page view the email embed button doesn't open
the modal to choose the link type."

**Diagnosis:** the Pages table envelope *did* open the modal. The modal simply
only existed in `sales-pages.tsx`; three other surfaces copied on click.

**What was built.** The modal moved to
`artifacts/lp-studio/src/components/sales/EmailPreviewModal.tsx`, which now
exports:
- `EmailPreviewModal` — the choose-a-link dialog, self-contained (its own
  contact search, busy/copied keys, and on-the-fly hotlink creation).
- `useEmailPreviewCopy()` — copy + compose, with the decoupling rule intact.
- `useOutreachTemplates()` — lazy: surfaces that only show compose buttons no
  longer re-fetch the brand config on every view, and `load()` is awaited
  before a draft is built so the first click still gets the real template.
- `ComposeButtons` — the Gmail + email-app pair for per-hotlink rows.

Per surface:

| Surface | Now |
|---|---|
| Pages table | Same modal, imported instead of inline. |
| Accounts → microsites tab | **Opens the modal.** It previously copied `site.firstToken` — the page's *first* hotlink — so every visit from that email was attributed to whichever contact happened to be first. |
| Accounts → contact rows | Keeps the instant copy, plus compose buttons. |
| Page drill-down → Links tab | Keeps the instant copy, plus compose buttons. |
| Contacts → hotlink rows | Keeps the instant copy, plus compose buttons. |

**Tests:** `components/sales/EmailPreviewModal.test.tsx` pins the contract,
including the don't-regress rule — a rejected clipboard write still opens the
draft, addressed from the hotlink's own email, and warns the rep the card
didn't make it.

---

## 2. Marketo lists are cached but nothing displays them — DONE

**Reported:** "where do lists go? I can't see them."

**Diagnosis:** confirmed — they went into the database and no screen read them.

**What was built.** A "Lists & Programs" card on
`artifacts/lp-studio/src/pages/sales/marketo-settings.tsx`: static lists and
programs on separate tabs with counts, search across name / Marketo id /
description, and a copy-id button on each row — the id is exactly what the
campaign wizard's "Push to Marketo static list" asks for, so this screen is
the missing half of the workflow that already works.

Notes:
- **No member counts.** Marketo's `/v1/lists.json` and
  `/asset/v1/programs.json` don't return one and the cache has no column for
  it; the card says so rather than showing a fake zero.
- **The duplicate buttons are gone.** "Refresh Lists" and "Refresh Programs"
  ran the identical `discoverLists()` call; there is now one "Refresh lists &
  programs" button, and it POSTs to `discover/refresh` rather than
  `sync/lists` — only the former is sync-toggle-agnostic, and the toggle is
  off on both tenants.
- **Read-only for now.** Whether picking a list should *do* something (feed an
  audience / campaign) is still an open product question — see below.

**Tests:** `pages/sales/marketo-settings.lists.test.tsx` (4 cases).

### Follow-up: picking a list now imports it — BUILT

Answered: both "import contacts" and "campaign audience", because they're a
sequence, not alternatives. Campaigns select LOCAL contacts (`contactIds`, and
saved audiences resolve to contacts), so a Marketo list can only become an
audience after its members exist as `sales_contacts`.

Each static list now has an **Import** button → `POST
/marketo/lists/:listId/import` → `marketoService.importListMembers`, followed
by **Save as campaign audience**, which posts to the ordinary
`POST /sales/audiences` with `filters.contactIds`. No new storage concept, and
it appears in the wizard's "Start from a saved audience" picker.

Three things this deliberately does differently from `importLeads`:

1. **Bounded and user-initiated.** One list the rep chose, capped per run
   (`maxLeads`, default 2,000) and reporting `truncated` when the cap bites.
   This is the inverse-the-sync recommendation in a form someone can trigger —
   it is NOT the 851k-lead scan, and it doesn't consult `sync_enabled`.
2. **`importUnlinked` is a per-call argument, defaulting on.** Of 2,208 sampled
   leads carrying a Salesforce contact id, 3 matched a local contact. Honouring
   the connection toggle would import a list you picked and create nobody.
3. **Set-based matching** — two queries for the batch instead of two per lead,
   the shape `previewImport` already uses.

**Two bugs fixed on the way, both of which would have bitten immediately:**

- **Migration 0134** — `sales_contacts.marketo_lead_id` and
  `hubspot_contact_id` carried the same GLOBAL `.unique()` that 0133 fixed for
  `salesforce_id`. Since the importer inserts with `ON CONFLICT DO NOTHING`, a
  second workspace importing an overlapping lead would silently lose the row.
  Verified on the live schema before writing it: both were global.
- **Email matching in `applyImportedLead`.** Dedupe was by `marketo_lead_id`
  only, so anyone already present from Salesforce or a CSV — who has no Marketo
  id — got a second contact. Now matched by email within the tenant, after the
  Salesforce-id match and before the create branches. This helps the existing
  importer too.

**Tests:** `marketo-service.listImport.integration.test.ts` (3 cases, real
Postgres) covers 15-vs-18 id matching, email matching, within-batch duplicate
addresses, `importUnlinked=false`, and re-import idempotence. Frontend cases
added to `marketo-settings.lists.test.tsx`.

**Verified against a Neon branch** (`test-0134-list-import`,
`br-snowy-sun-ame8ax9y`): migration applied cleanly and all Marketo suites
pass. Delete the branch when you're done with it — along with
`test-0133-migration` (`br-rough-cell-amqwt7wl`) from the previous session.

**Not yet verified on Replit**, and nothing here has been run against real
Marketo data. The first real import should be a small list.

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

### WORKING TODAY — push personalized links to a Marketo static list

**This works and nothing diagnosed here breaks it.** Easy to miss: it is NOT
`marketoService.addLeadToList` (that function has zero callers and is dead
code with a settings field, `enrollListId`, still wired to the UI). The live
path is an **export destination**:

- UI: campaign wizard → "Generate links only" → `LinkExportPanel` →
  **"Push to Marketo static list"** (asks for a list id + a Marketo field name).
- Server: `marketoDestination` in `lib/exportDestinations.ts` →
  `syncLinksToMarketoStaticList` in `lib/notifications.ts`.
- It create-or-updates each contact in Marketo, writes the personalized link
  onto the named field, and adds them to the static list.

Why today's bugs don't touch it:
- Matches on **`lookupField: "email"`**, not Salesforce id — so the 15-vs-18
  mismatch is irrelevant.
- Does **not** use `marketo_lead_id` (empty on all 8,134 contacts).
- Credentials come from `getFormSyncCredentials`, which keys on
  `status = 'connected'` and **deliberately ignores `sync_enabled`** — so
  disabling the sync did not break it on either tenant.
- Fail-closed: validates the link field exists in Marketo before sending, and
  refuses if it can't read the schema.

Implication: LP Studio generates the links, Marketo does the sending. That is
arguably the whole workflow, and it makes the inbound lead sync optional
rather than necessary.

### RECOMMENDATION

**1. Build the Marketo lists UI (item 2 above). Highest value, lowest risk.**
It is the only one of the three original goals — accounts, contacts, lists for
emailing — that Marketo can actually serve. 320 lists are already cached on
each tenant; the only missing piece is a screen. — **BUILT, pending Replit
verify.**

**2. Do NOT enable the INBOUND lead sync as it stands.** A full run scans
851,000 leads to find ~800 matches, on a 15-minute poller, forever. Even after
batching the per-lead queries the cost/benefit is poor. This says nothing about
the outbound static-list push above, which works and should be left alone.

**3. Only if enrichment is genuinely wanted, invert the sync instead of
batching it.** Consider skipping this entirely — the outbound push already
covers the "get links in front of people via Marketo" workflow. The
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
