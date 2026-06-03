---
name: Link-export connected-destination E2E needs server-side fake mode
description: Why E2E coverage of a CONNECTED links-only export destination can't be browser-stubbed, and how to drive it.
---

The links-only campaign export "deliver" step runs SERVER-SIDE in api-server
(Marketo → `*.mktorest.com`, Google Sheet → googleapis), so the browser-level
Playwright route interceptor in `tests/setup/pw.ts` (the Marketo browser stub)
CANNOT intercept it — it only sees requests the browser makes.

**How to test the success path:** add a server-side fake-mode env guard mirroring
the existing `ASANA_FAKE_MODE` precedent. For Marketo, `MARKETO_FAKE_MODE === "1"`
at the top of `syncLinksToMarketoStaticList` returns a synthetic
`{created, failed:0, addedToList, reasons:[]}` and bypasses all token/describe/push
network. Set the env in the api-server `webServer.env` block of
`artifacts/lp-studio/playwright.config.ts` so it applies to the booted server.

**Why:** the route under test (`/api/sales/link-export/<id>`) does real third-party
delivery; the only way to assert Send-enabled → 200 → success toast without live
credentials is to fake the deliver call where it actually runs (the server).

**Marketo connected-state seeding:** insert an enabled `lp_integrations` row
(provider='marketo', plaintext config with munchkinId/clientId/clientSecret —
`isConfigured()` only checks those three exist, no network). Clear it in afterEach.

**Flake note:** this spec uses a `royal-test-%` tenant. Under a contended full-suite
run it shares the known shared-Neon flakes: the page-`<select>` `toHaveCount(1)` wait
times out, and on retry another parallel spec's `purgeStaleRoyalTenants` deletes the
tenant mid-run → `lp_integrations_tenant_id_fkey` FK violation. Authoritative signal
is an ISOLATED single-spec run (`playwright test link-export-campaign --workers=1`),
which is green.
