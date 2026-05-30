---
name: E2E Dandy-gating positive + negative paths
description: How lp-studio e2e tests BOTH sides of Dandy-only gating without minting a reserved-slug tenant
---
Dandy-only gating uses different signals per surface, so each side is tested differently:

- **Picker UI (templates gallery + rep generator)** gates on
  `brand.brandName === "dandy"` (NOT slug). So
  `createRoyalTenant(pool, { brandName: "Dandy" })` yields a fixture the client
  treats as Dandy (gated built-ins appear, PDF enabled) with a normal
  non-reserved `royal-test-*` slug — no collision. Use this for gallery /
  rep-generator / Download-PDF positive assertions.
- **Template Editor** gates on the server-authoritative `brand.isDandy` (resolved
  from the immutable slug), NOT brandName — so the royal-brandName trick does
  NOT unlock the editor's gated tabs. For editor positive assertions you must
  impersonate the seeded Dandy workspace via `createDandyOperatorSession(pool)`
  (override the beforeEach cookie with `operator.sid`), same as the server routes.
- **Server publish/save + layout-defaults routes** gate on the tenant SLUG
  (`isProtectedEnterpriseSlug` → {"dandy","dandy-smb"}), which is unique +
  already seeded, so you CANNOT create a second Dandy tenant. Instead
  impersonate the seeded workspace via `createDandyOperatorSession(pool)` (mints
  an `app_sessions` row pointing at dandy-smb; payload `isAdmin:true` +
  `appUserRole:"admin"` so requireAuth skips host check + user lookup). The
  editor's layout-defaults PUT/DELETE gate keys off the storage-key shape
  `dandy_<id>_template_layout` via `isDandyGatedLayoutKey`.

**Why:** The brandName/slug split is what makes positive coverage possible.
Earlier this was believed untestable; it isn't — the fixture + impersonation
helpers now live in `tests/setup/royal-tenant.ts`.

**How to apply:** Positive server-route tests WILL write rows to the real Dandy
tenant — you MUST delete them. Capture returned ids and call
`cleanupDandyOnePagerRows(pool, tenantId, {templateIds, pageIds})` +
`cleanupDandyOperatorSession` in `finally`. For client-only side effects (e.g.
the Download-PDF handler's best-effort POST to `/api/sales/pdf-submissions`),
stub the request with `page.route(...)` so nothing persists. Both directions
live together in `tests/dandy-gated-builtins.spec.ts`.
