---
name: Workspace login LP Studio branding
description: Tenant/workspace sign-in screens must read as LP Studio; Dandy is the sole white-label exception.
---

# Workspace login branding

Every per-tenant workspace login (e.g. `zoom.lpstudio.ai`, `tenant-locked` mode) and the
signed-in "Access Pending" screen must lead with the **LP Studio** brand lockup
(icon + "LP Studio" wordmark, the `LpStudioWordmark` component in `AuthGate.tsx`). The
specific workspace is named only in the heading ("Sign in to {workspace}").

- **Dandy is the one intentional white-label exception** — it keeps its own logo and the
  "Looking for Dandy?" link. Gate on `isDandyTenant` (`isLocked && tenantSlug === "dandy"`).
- **Tenant custom logos are intentionally NOT rendered on the login screen.** The brand
  fetch (`/api/lp/brand`) is still used, but only `brandName` (for the heading), not
  `logoUrl`.
- **No "powered by LP Studio" footer.** The user explicitly rejected that — the login must
  read as *being* LP Studio, not merely powered by it.
- The central open-domain screen (`OpenSignInScreen`, `mode === "open"`) was already
  LP Studio-branded; only the minimal `SignInPanel` / Access-Pending paths needed changing.

**Why:** product decision — workspaces are LP Studio's surface, so users should clearly see
which product they're signing into. Custom tenant logos on login muddied that, and a
"powered by" treatment was considered too weak.

**How to apply:** any future change to login/auth branding or white-labeling must preserve
LP Studio as the primary identity for non-Dandy tenants, and must add new white-label
exceptions explicitly (never default other tenants into showing their own logo on login).
