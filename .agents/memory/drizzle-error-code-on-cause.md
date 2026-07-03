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

**How to apply:** Detect violations via the shared
`artifacts/api-server/src/lib/dbErrors.ts` helpers, which walk the `.cause`
chain (depth-capped, null-safe) via a private `hasPgCode`: `isUniqueViolation`
(23505) and `isForeignKeyViolation` (23503). Do NOT inspect top-level `.code`
and do NOT string-match `.message`. When you touch any of these still-direct
callsites, migrate them to the helper — they are latent-broken the same way:
`routes/admin.ts`, `routes/notifications.ts`, `routes/auth.ts`,
`routes/lp/programmatic-pages.ts`.

**The `.message.includes(...)` trap (this is what looked fine but wasn't):**
the presence route caught the FK with `err?.message?.includes("foreign key
constraint")`. That NEVER matched at runtime (real `err.message` is only
`"Failed query: …\nparams: …"`; the FK text is on `err.cause.message`), so the
FK rethrew and every poll for a deleted page returned **500 Unhandled error**
instead of a benign 404. It's deceptive because pino's error serializer merges
the cause into the LOGGED `message`, so the log shows the FK text and the string
match looks correct — but that string only exists post-serialization, not on the
live error you're testing. Always match the SQLSTATE via the cause-chain helper.
