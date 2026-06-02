---
name: Undo-delete restore approach
description: How "Undo" for hard deletes works across Sales (Accounts/Contacts/Signals), Page Reviews, and LP Leads.
---

Undo for hard deletes uses **capture-and-reinsert**, not soft-delete — no schema/migration, no read-path changes.

**Rule:** DELETE endpoints return the full deleted rows under a `restore` key; matching POST `/restore` endpoints re-insert them via the generic `restoreRows(table, rows, overrides)` helper (`artifacts/api-server/src/lib/restoreRows.ts`). The frontend `toastUndoableDelete(...)` (`artifacts/lp-studio/src/lib/undo-delete.ts`) shows a Sonner toast whose Undo action POSTs the captured rows back.

**Why:** serial PKs allow explicit-id reinsert (sequence only moves forward, so restored ids can't collide); `onConflictDoNothing()` makes restore idempotent and safe against unique-key (salesforceId/token) or PK conflicts.

**How to apply / invariants:**
- `restoreRows` **forces** the scoping override (tenantId for sales, pageId for reviews) onto every row, so a tampered payload can never land a row in another tenant/page. Always pass the trusted scope, never trust the payload's tenantId/pageId.
- It converts date-string columns back to `Date` (JSON round-trip) so original timestamps (e.g. signal `createdAt`) survive — don't let restore reset them to now().
- Account restore covers account + contacts + signals only. Derived/regenerable data (briefings, contact_briefings, emails) is cascade-deleted and NOT restored. Hotlinks are SET NULL (survive).
- Restore in dependency order: accounts → contacts → signals (cascade FKs).
- The existing review-delete endpoint has no tenant check; the restore path matched that posture and only forces pageId.
- LP Leads: both `DELETE /lp/leads` (bulk) and `DELETE /lp/leads/test` return `restore: { leads }` (full rows via `.returning()`), and `POST /lp/leads/restore` re-inserts via `restoreRows(lpLeadsTable, leads, { tenantId })`. `createdAt` is a tz timestamp → round-trips as Date; jsonb `fields` passes through; serial id reinsert is safe.
- Drizzle generic insert: `db.insert(table).values(clean as never)` — `clean` is `Record<string,unknown>[]` (sanitized to real columns at runtime) and won't match the table's static insert type without the cast.
