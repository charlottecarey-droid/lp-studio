// Shared Playwright base test for the lp-studio E2E suite.
//
// Why this exists
// ───────────────
// The Marketo integration is entirely client-side: `MarketoForm` injects a
// `<script src="//app-XXX.marketo.com/js/forms2/js/forms2.min.js">` (via
// `loadMarketoScript`), `MunchkinLoader` injects
// `https://munchkin.marketo.net/munchkin.js`, and on submit Marketo's loader
// POSTs to `<munchkinId>.mktoresp.com`. In the sandboxed E2E environment none
// of those hosts resolve, so every spec that renders a Marketo form / Munchkin
// tracker — not just the dedicated Marketo specs — used to flood the run with
// `net::ERR_NAME_NOT_RESOLVED` console noise (and incur the real DNS timeout).
//
// Rather than make every spec remember to stub Marketo, we install a single
// global route interceptor for ALL specs that import `test` from here. It
// fulfils Marketo host requests with harmless stubs so nothing ever escapes to
// real DNS:
//   • `forms2.min.js`     → a no-op `window.MktoForms2` stub (loadForm invokes
//                            its callback with an inert form instance),
//   • `munchkin.js`       → a no-op `window.Munchkin` stub,
//   • everything else on a Marketo host (Forms2 `leadCapture/save2` POSTs,
//     Munchkin visitor beacons, etc.) → a 200 `{}` so it's observed-and-swallowed.
//
// The dedicated Marketo specs that need to *observe* a submit (e.g.
// ghost-submit) register their own `page.route("**/*.mktoresp.com/**")`. Page
// routes take precedence over the context route installed here, so those specs
// keep their exact assertions; this global handler is only the safety net for
// every other page that happens to render Marketo content.
//
// The interceptor is attached to every BrowserContext — including ones a spec
// creates manually via `browser.newContext()` — by wrapping `browser.newContext`
// in the overridden (worker-scoped) `browser` fixture. The override is lazy: a
// pure-API spec that never touches the `browser` fixture pays nothing.

import { test as base } from "@playwright/test";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Route,
} from "@playwright/test";

/** True for any request whose host is a Marketo-owned domain. */
function isMarketoUrl(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return (
    h === "marketo.com" ||
    h.endsWith(".marketo.com") ||
    h === "munchkin.marketo.net" ||
    h === "mktoresp.com" ||
    h.endsWith(".mktoresp.com")
  );
}

// Inert Forms2 stub. `loadForm` synchronously calls its callback with a form
// instance whose `submit()` is a no-op, so a page that renders a Marketo form
// without its own addInitScript stub still mounts cleanly (no 10s load
// watchdog, no error UI) and never POSTs to mktoresp.com. Guarded by
// `if (window.MktoForms2) return;` so a spec's own addInitScript stub always
// wins.
const FORMS2_STUB = `/* Marketo Forms2 stub (lp-studio E2E network guard) */
(function () {
  if (window.MktoForms2) return;
  window.MktoForms2 = {
    loadForm: function (baseUrl, munchkinId, formId, cb) {
      var stored = {};
      var instance = {
        vals: function (v) { if (v) Object.assign(stored, v); return stored; },
        getValues: function () { return stored; },
        getId: function () { return formId; },
        onSuccess: function () { return instance; },
        onValidate: function () { return instance; },
        onSubmit: function () { return instance; },
        submittable: function () { return instance; },
        submit: function () { return instance; },
      };
      if (typeof cb === "function") cb(instance);
      return instance;
    },
    whenReady: function () {},
    whenRendered: function () {},
    whenFormReady: function () {},
  };
})();`;

// Inert Munchkin stub. `MunchkinLoader` only calls `Munchkin.init(...)` if
// `window.Munchkin` exists; the stub's `init` is a no-op so no visitor beacon
// is ever fired.
const MUNCHKIN_STUB = `/* Marketo Munchkin stub (lp-studio E2E network guard) */
(function () {
  if (window.Munchkin) return;
  window.Munchkin = { init: function () {}, munchkinFunction: function () {} };
})();`;

async function fulfillMarketo(route: Route): Promise<void> {
  const req = route.request();
  const url = req.url();
  const type = req.resourceType();

  if (url.includes("forms2.min.js") || (type === "script" && url.includes(".marketo.com"))) {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: FORMS2_STUB,
    });
    return;
  }

  if (url.includes("munchkin.js") || (type === "script" && url.includes("munchkin.marketo.net"))) {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: MUNCHKIN_STUB,
    });
    return;
  }

  // Forms2 submission POSTs (`*.mktoresp.com/index.php/leadCapture/save2`),
  // Munchkin visitor beacons, images, etc. — swallow with a harmless 200 so
  // nothing reaches real DNS.
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: "{}",
  });
}

/**
 * Attach the Marketo host interceptor to a BrowserContext. Exposed so a spec
 * that builds a context outside the fixture (rare) can opt in explicitly; the
 * `test` export below already applies it to every context automatically.
 */
export async function installMarketoInterception(context: BrowserContext): Promise<void> {
  await context.route(isMarketoUrl, fulfillMarketo);
}

type PatchableBrowser = Browser & { __marketoPatched?: boolean };

export const test = base.extend<Record<string, never>, Record<string, never>>({
  // Override the worker-scoped `browser` fixture. We wrap `newContext` once per
  // worker so that EVERY context — the built-in `context`/`page` fixtures (which
  // create their context via `browser.newContext`) and any spec-created
  // `browser.newContext()` — gets the Marketo interceptor. Lazy: only runs when
  // a spec actually depends on `browser`.
  browser: [
    async ({ browser }, use) => {
      const b = browser as PatchableBrowser;
      if (!b.__marketoPatched) {
        const orig = b.newContext.bind(b);
        b.newContext = (async (options?: BrowserContextOptions) => {
          const ctx = await orig(options);
          await installMarketoInterception(ctx);
          return ctx;
        }) as Browser["newContext"];
        b.__marketoPatched = true;
      }
      await use(browser);
    },
    { scope: "worker" },
  ],
});

export { expect, request } from "@playwright/test";
export type {
  APIRequestContext,
  Browser,
  BrowserContext,
  Locator,
  Page,
  Route,
  TestInfo,
} from "@playwright/test";
