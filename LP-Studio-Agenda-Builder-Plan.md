# LP Studio — Conference Agenda Builder implementation plan

*Drafted 2026-07-26. Goal: replace per-account conference PowerPoints with a session
catalog + per-account matching + a published agenda page (share link), with optional
PDF export.*

## Why this is mostly assembly, not invention

- Accounts already sync from Salesforce (`src/lib/sfdc-service.ts` → `sales_accounts`:
  name, industry, type, website/domain, city/state).
- Per-account page publishing already exists (`routes/sales/web-one-pager.ts` builds an
  `lp_page` from rep inputs; ABM full-page blocks are personalized per account).
- Scrape-and-extract already exists (brand-import: Firecrawl + LLM extractors under
  `src/lib/brand-import/`; also used by `briefing-service.ts`).
- PDF machinery already exists (`lib/one-pager-types/src/generators.ts`).

New surface area: two tables, one import pipeline, one matching endpoint, one
full-page block, one rep-facing flow.

## 1. Data model (`lib/db/src/schema/`, one file per table)

**`salesEvents.ts` → `sales_events`**
`id, tenant_id, name, location, start_date, end_date, source_url, status
(draft|active|archived), created_at/by`

**`salesEventSessions.ts` → `sales_event_sessions`**
`id, event_id, tenant_id, title, description, day (date), start_time, end_time, room,
session_type, track, speakers (jsonb: [{name, title, org}]),
tags (jsonb: {roles: [], industries: [], topics: [], tiers: []}),
source_key (dedupe key for re-import: slug of title+day+start_time),
is_reserved_slot (bool — pinned 1:1 / dinner slots that always make the agenda)`

**`salesEventAgendas.ts` → `sales_event_agendas`** (the per-account artifact)
`id, event_id, account_id (FK sales_accounts, SET NULL per existing deletion
contract), tenant_id, lp_page_id (FK lp_pages, nullable until published),
attendee_roles (jsonb), selections (jsonb: ordered [{session_id, blurb_override}]),
status (draft|published), published_at`

Keeping `selections` as its own row (not just page props) is what enables
re-matching after catalog edits, analytics rollup per event, and PDF export from the
same data. New numbered migration follows the existing `01xx` sequence.

## 2. Getting the conference data in (three doors, one table)

**Door A — scrape an agenda URL (the Groundbreak case).** Verified 2026-07-26 against
https://www.procore.com/groundbreak/agenda: the static HTML contains **no** sessions —
it's a RainFocus widget hydrated client-side. But the *rendered* DOM is extremely
structured: 166 sessions, each with title, day, time range, session type,
"WHO IT'S FOR" roles, overview, and speakers with titles. So the pipeline is:

1. `POST /api/sales/events/:id/import { url }`
2. Firecrawl scrape **with JS rendering** (same client/config as brand-import — plain
   fetch returns an empty shell; respect the firecrawl-lockdown allowlist rules).
3. LLM extraction pass over the rendered markdown → array of session objects matching
   the schema above (title/day/times/type/roles/overview/speakers). Chunk by day
   headers if the page is long. Model outputs `roles` verbatim when the page states
   them (Groundbreak does); otherwise a second tagging pass infers roles/topics from
   the description.
4. Upsert by `source_key` so re-running the import updates times/rooms without
   duplicating or clobbering manual tag edits (only overwrite fields that came from
   the source; tags edited in-app win).

Caveats found on the real page: descriptions truncate behind "Show more" (accept
truncated overviews in v1; a Firecrawl actions pass can click-expand later), and some
agendas paginate by day — import accepts multiple URLs per event.

**Door B — CSV upload.** For Dandy's own internal conference the session list exists
in a spreadsheet before any website does. Column-mapped CSV import into the same
upsert. This is the v1 primary path; scraping is the accelerator for
externally-published agendas.

**Door C — manual editor.** Event detail page with an editable session table (add /
edit / tag / mark reserved slots). Always needed for cleanup regardless of door.

## 3. Matching + generation

`POST /api/sales/events/:eventId/agendas { accountId, attendeeRoles[] }` →

- **Deterministic scoring, no AI required:** score = role-tag intersection with
  `attendeeRoles` + industry match against `sales_accounts.industry` + tier match.
  One session per time slot (highest score wins the conflict), reserved slots pinned
  first. Returns a ranked draft the rep can reorder/swap — never a black box.
- **Optional AI blurb pass (phase 2):** per selected session, one line of "why this
  matters for {account}", grounded ONLY on the session description + synced account
  fields (strict-facts rules: no invented claims about the account). Stored in
  `selections[].blurb_override`, editable by the rep.
- **Publish:** builds an `lp_page` from the event-agenda block with props assembled
  from the agenda row — mirror the `web-one-pager.ts` route shape (tenant scoping,
  brand context, share link). Store `lp_page_id` back on the agenda row.
  Re-publish updates the same page.

## 4. The event-agenda block (three-place contract — keep in sync)

1. `artifacts/lp-studio/src/blocks/BlockEventAgenda.tsx` + `EVENT_AGENDA_DEFAULT_PROPS`
2. Seed mirror `EVENT_AGENDA_GENERIC_PROPS` in
   `artifacts/api-server/src/seeds/globalTemplates.ts` (`{{company_name}}` tokens only
   where the contract allows; no palette keys)
3. Property panel in `pages/builder/property-panels/` (day/session array editors,
   toggles)

Content: hero (event name/dates/city, account name + logo, count-up "N sessions
picked for you"), personal note from the account team, day-by-day timeline of session
cards (time, title, room, speakers, why-attend blurb), logistics/FAQ, CTA. Same
premium-editorial bar as the 2026-07-20 account-microsite redesign; all new props
optional + render-guarded; `pickContrastingColor` candidate order = near-white ink
before accent on dark surfaces. Block type id chosen once, never renamed
(recipe-system rule). Preview without backend: `/preview/generic-catalog-fixture` +
`window.__GENERIC_SEED__` (two pushState hops).

## 5. Rep UI (`artifacts/lp-studio/src/pages/sales/`)

- **Events** list + event detail (catalog table, import buttons, tag editor).
- **Build agenda** flow: account picker → attendee-role chips → matched session list
  with score badges → drag reorder / swap-in from full catalog → preview →
  Publish (share link) / Export PDF. Register routes alongside existing sales pages;
  respect plan gating conventions (`planFeatures.ts`) if this should be plan-gated.

## 6. Phasing

| Phase | Scope | Outcome |
|---|---|---|
| 1 | Tables + CSV/manual catalog + block + deterministic matching + publish | PowerPoint replaced |
| 2 | URL import (Firecrawl + extraction), AI why-attend blurbs | Minutes per account |
| 3 | PDF export (new generator in `lib/one-pager-types`, neutral-brand rules apply), .ics add-to-calendar, RSVP via existing lead blocks, per-event analytics rollup | Follow-through the decks never had |

## 7. Tests (match existing patterns)

- Route integration tests per `routes/sales/*.integration.test.ts` conventions
  (tenant scoping, deletion FK behavior for account/agenda rows).
- Extraction prompt test with a saved fixture of the rendered Groundbreak markdown
  (like `briefings.prompt.test.ts`) pinning field mapping + dedupe keys.
- Matching unit tests: role intersection, slot-conflict resolution, reserved-slot
  pinning.
- Block: seed/prop parity + render-guard tests per existing block governance suites;
  if PDF ships, the no-brand-leak lexicon contract applies to any default copy.
