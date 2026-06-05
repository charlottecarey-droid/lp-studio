---
name: Marketo scheduled lead sync — resume cursor & lock model
description: Where the scheduled Marketo import persists its cross-run resume cursor and how its per-tenant advisory lock differs from the other pollers.
---

The scheduled Marketo lead poller (`lib/marketoSyncPoller.ts`) reuses
`marketoService.importLeads(connId, tenantId, { syncType: "scheduled", resume: true })`.

**Resume cursor lives in `marketo_connections.metadata.scheduledSync` (jsonb), NOT a column.**
Shape `{ listId, cursor }`; `cursor` is Marketo's `nextPageToken` for the
in-flight static list. Advanced per page, cleared to null on successful
completion, and deliberately LEFT in place on failure so the next poll resumes.
Parsing/planning are pure + unit-tested: `parseScheduledSyncState` /
`planResume` in `marketo-service.ts`.

**Why metadata, not a new column:** task wording said "lastCursor in
marketo_connections", but the per-run `marketo_sync_log.lastCursor` resets every
run. The existing `metadata` jsonb gave a clean cross-run home with no migration.

**Resume is list-granular and fail-safe:** lists are imported in deterministic
`ORDER BY marketo_id`; `planResume` skips lists before the saved one and resumes
the saved list from its cursor. Import is idempotent (onConflictDoNothing /
update), so an over-eager re-scan after a between-lists crash is harmless.

**Lock convention DIVERGES from the domain pollers.** The 415/783/787 pollers use
a *session* `pg_try_advisory_lock(taskNum, 1)`. This one uses a *transaction*-scoped
`pg_try_advisory_xact_lock(950, tenantId)` — PER-TENANT objid, xact-scoped so it
auto-releases on COMMIT and can't leak on the Neon `-pooler` endpoint (see
pooler-advisory-lock-leak). The lock client holds an open txn for the whole
tenant import while the import's own writes go through the shared pool.

**How to apply:** changing the scheduled import's list ordering or the metadata
key/shape breaks resume silently. Manual sync (`fullSync`/`syncObject` → default
`importLeads`) must stay `syncType:"manual"`, resume:false — it never touches the
resume cursor. Poller only starts in production OR `MARKETO_FAKE_MODE=1`.
