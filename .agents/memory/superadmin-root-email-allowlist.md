---
name: Superadmin root email allowlist
description: Who is a "root superadmin", and the /auth/me override the frontend guard depends on.
---

The platform superadmin surface is gated on the FRONTEND by `appUserRole === "superadmin"` where `appUserRole` comes ONLY from `GET /auth/me`. `/auth/me` reads it from `app_users.role`, so any email-based root override applied elsewhere (e.g. `requireSuperadmin` middleware) is invisible to the frontend unless `/auth/me` applies it too.

**Rule:** every place that computes `appUserRole` for the client — especially `/auth/me`, but also the session-stamping login/password paths — must apply `isRootSuperadminEmail(email)` → force `"superadmin"`. Fixing only the API middleware leaves the root account locked out of the UI with "does not have the superadmin role".

**Root identity** lives in `lib/rootSuperadmin.ts` as a case-insensitive ALLOWLIST, not a single email:
- `ALWAYS_ROOT_SUPERADMIN_EMAILS` = built-in, always-on roots (currently admin@lpstudio.ai + charlotte.carey@meetdandy.com).
- `ROOT_SUPERADMIN_EMAIL` env is ADDITIVE (single or comma/space/semicolon list), never replaces the built-ins.
- `getRootSuperadminEmails()` = union, lowercased/deduped; `isRootSuperadminEmail()` = membership; `getRootSuperadminEmail()` = a single "primary" (env first entry, else default) kept only for display/back-compat.

**Why:** "root" means more than the superadmin role — roots can manage the superadmin roster (`requireRootSuperadmin`) and are non-removable (admin.ts DELETE guard). Adding an email to the built-in list grants that full power permanently (only a code deploy removes it). If a future request is "let X into SuperAdmin" but NOT "let X manage the roster / be non-removable", that needs a SEPARATE non-root superadmin allowlist, not this one.

**How to apply:** password-login must match `LOWER(email)=LOWER($1)` (case-variant duplicate rows are possible since `app_users.email` unique is case-sensitive) and allow when `row.role==='superadmin' OR isRootSuperadminEmail(row.email)`. The migrate seed loops `getRootSuperadminEmails()`, upserting+verifying each (fail-closed). The seed/override self-heal an existing wrong-role row on next boot/request without DB surgery.
