---
name: Drizzle wraps pg errors — SQLSTATE on .cause
description: Why err.code === "23505" silently fails under drizzle-orm 0.45.x and the shared helper to use instead.
---

# Drizzle wraps the driver error — read the SQLSTATE off `.cause`, not `.code`

drizzle-orm (≥0.45.x) wraps every query failure in a `DrizzleQueryError`
(`message = "Failed query: …"`). Its OWN `.code` is **undefined**; the real
node-postgres error (carrying the SQLSTATE `.code`, e.g. `"23505"` unique
violation) is on `err.cause`.

So any handler written as `(err as {code?:string}).code === "23505"` silently
never matches → the unique-violation branch (retry / 409 / ON CONFLICT fallback)
never fires.

**Why:** This bit twice. First `ensureHotlink.ts` (token-collision retry), then
the sales microsite slug-uniqueness retry in
`routes/sales/generate-microsite.ts` — where the FIRST colliding slug threw
straight to the outer catch, surfacing to the user as a generic "generation
failed" / "the template didn't work at all" (the template + AI copy were
actually fine; only the `lp_pages` INSERT failed). The symptom is **silent**:
no detection, the retry just never runs.

**How to apply:** Detect unique violations via the shared
`artifacts/api-server/src/lib/dbErrors.ts` → `isUniqueViolation(err)`, which
walks the `.cause` chain (depth-capped, null-safe). Do NOT inspect top-level
`.code`. When you touch any of these still-direct callsites, migrate them to the
helper — they are latent-broken the same way: `routes/admin.ts`,
`routes/notifications.ts`, `routes/lp/pages.ts`, `routes/auth.ts`,
`routes/lp/programmatic-pages.ts`.
