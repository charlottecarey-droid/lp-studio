---
name: E2E Dandy-gating positive + negative paths
description: How lp-studio e2e tests BOTH sides of Dandy-only gating without minting a reserved-slug tenant
---
Every Dandy-only gating surface now keys off the SAME server-authoritative
signal — the tenant SLUG — so the spoofable `brand.brandName` no longer unlocks
anything:

- **Picker UI (templates gallery + rep generator)** gates on the server
  `brand.isDandy` flag (resolved from the immutable slug by `/lp/brand`), read as
  `brand.isDandy === true`. The old `brandName === "dandy"` trick is gone, so
  `createRoyalTenant(pool, { brandName: "Dandy" })` no longer makes the client
  treat a Royal tenant as Dandy. For positive picker assertions you MUST
  impersonate the seeded Dandy workspace via `createDandyOperatorSession(pool)`
  (set its `operator.sid` as the `lp_sid` cookie), exactly like the editor.
- **Template Editor** also gates on the server `brand.isDandy` — same as the
  pickers. Use `createDandyOperatorSession(pool)` for positive editor assertions.
- **Server publish/save + layout-defaults routes** gate on the tenant SLUG
  (`isProtectedEnterpriseSlug` → {"dandy","dandy-smb"}), which is unique +
  already seeded, so you CANNOT create a second Dandy tenant. Impersonate the
  seeded workspace via `createDandyOperatorSession(pool)` (mints an
  `app_sessions` row pointing at dandy-smb; payload `isAdmin:true` +
  `appUserRole:"admin"` so requireAuth skips host check + user lookup). The
  editor's layout-defaults PUT/DELETE gate keys off the storage-key shape
  `dandy_<id>_template_layout` via `isDandyGatedLayoutKey`.

**Why:** All surfaces now share the slug-derived `isDandy`, so the whole
positive describe block can run under ONE shared `createDandyOperatorSession`
(beforeAll/afterAll/beforeEach) instead of the per-surface brandName trick. The
seeded dandy-smb brand has `brandName:"Dandy"` so scrubBrand still no-ops there
(gated labels like "Dandy Evolution" render verbatim).

**How to apply:** Positive server-route tests WILL write rows to the real Dandy
tenant — you MUST delete them. Capture returned ids and call
`cleanupDandyOnePagerRows(pool, tenantId, {templateIds, pageIds})` in `finally`;
clean the shared session once in `afterAll` via `cleanupDandyOperatorSession`.
For client-only side effects (e.g. the Download-PDF handler's best-effort POST to
`/api/sales/pdf-submissions`), stub the request with `page.route(...)` so nothing
persists. Both directions live together in `tests/dandy-gated-builtins.spec.ts`.
