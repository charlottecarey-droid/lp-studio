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

## Also in flight — don't drop this

A Marketo test was set up but not run. Full detail in `memory/marketo-sync.md`.

1. Deploy `staging` (includes migration 0133 — the previous deploy failed on it;
   it's fixed and verified against a Neon branch off prod).
2. Import a **slice** of the ENT contacts CSV into Dandy SMB — throwaway test data.
3. Run `POST /api/sales/marketo/sync/preview` on SMB. It writes nothing and
   works with the sync disabled. Reports how many leads would match vs skip.
4. If the match rate is healthy, **batch `applyImportedLead` before enabling any
   real sync** — its 1–2 DB queries per lead are what exhausted the pool and
   produced a day of stuck runs.

**Cleanup for the throwaway import (tenant 5):** delete anything with
`sales_contacts.id > 49570` or `sales_accounts.id > 5040`. Real rows to keep:
contacts `47554, 49569, 49570`; accounts `2622, 5039, 5040`.

**Left behind:** a temporary Neon branch `test-0133-migration`
(`br-rough-cell-amqwt7wl`) used to verify the migration. Safe to delete.
