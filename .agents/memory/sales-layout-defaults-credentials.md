---
name: Sales layout-defaults save silently vanishes
description: Why sales one-pager template defaults appear not to save — cross-origin cookie-gated PUT/DELETE missing credentials.
---

# Sales one-pager "defaults won't save" = missing fetch credentials

The sales one-pager layout-defaults API (`/sales/layout-defaults/:key`) gates
PUT and DELETE behind `requirePermission("sales_campaigns")` (session cookie),
while GET is open. The lp-studio client calls it cross-origin (different artifact
origin), so the cookie is only sent when the fetch passes `credentials: "include"`.

**Symptom:** template editor "Save" appears to succeed (toast shows), but on
reload the changes are gone. This is because:
1. The save writes localStorage AND fires a PUT, but the PUT 401s (no cookie) and
   the error is swallowed by `catch {}`.
2. `loadLayoutDefault` is API-first (`cache: "no-store"`) and, on a successful GET
   that returns the stale/empty server value, it OVERWRITES localStorage. So the
   client-side cache that briefly held the edit is clobbered.

**Why:** the GET already had `credentials: "include"` (so loads worked), but the
PUT/DELETE were written without it — the asymmetry made loads succeed and saves
silently fail, which reads as "not saving."

**How to apply:** every write/delete to a cookie-gated cross-origin API must send
`credentials: "include"`, matching the GET. These `saveLayoutDefault` /
`loadLayoutDefault` / `deleteLayoutDefault` helpers are DUPLICATED in both
`sales-one-pager-editor.tsx` and `sales-one-pager.tsx` (a header comment says keep
them in sync) — fix all copies. When a save "doesn't persist" but no error shows,
suspect a swallowed 401 on the write path plus an API-first loader overwriting the
local cache, not a serialization bug.
