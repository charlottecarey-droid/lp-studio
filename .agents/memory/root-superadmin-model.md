---
name: Root superadmin model
description: How the platform-operator superadmin role + root identity work in LP Studio
---

# Root superadmin model

- The `superadmin` god-mode role is a plain `app_users.role='superadmin'` flag set by manual DB grant. **No code path, default, or seed auto-promotes by email/domain** (Dandy or otherwise). Any Dandy-domain superadmin in the DB (e.g. a `@meetdandy.com` operator) is a manual data grant, NOT a code tie — do not assume code grants it.
- **Root identity is email-based**, resolved by `lib/rootSuperadmin.ts` (`getRootSuperadminEmail`/`isRootSuperadminEmail`) reading `ROOT_SUPERADMIN_EMAIL` at call time (default `admin@lpstudio.ai`). Only a superadmin whose email matches is "root". Root-only routes use `requireRootSuperadmin` AFTER `requireSuperadmin`.

**Why:** the owner wanted LP Studio's own `admin@lpstudio.ai` as the sole roster manager, decoupled from Dandy (now just a white-label tenant). Root manages the superadmin roster; non-root superadmins keep full god-mode but cannot change who is a superadmin.

**How to apply:**
- The migrate.ts "root superadmin seed" upserts the root with `tenant_id NULL` **only on fresh insert**; on conflict it deliberately does NOT null an existing row's tenant_id (avoids detaching a pre-existing account). So "no tenant scope" is guaranteed for the canonical fresh-DB case but a pre-existing prod row may keep its home tenant — that's intentional, don't "fix" it without owner sign-off.
- Admin-password login (`auth.ts`): a superadmin with NO tenant membership gets a tenant-less session (`tenantId:null, role:'superadmin'`) instead of 403 — required so the tenant-less root can sign in. Superadmin surface gates on re-read `appUserRole`, not on a tenant binding.
- Route tests for root-gated admin routes: pin `process.env.ROOT_SUPERADMIN_EMAIL` to a unique per-run email in `beforeAll` (lib reads env at call time) so you never mutate the real seeded root; drive via in-process `inject()` + seeded `app_sessions` rows.
