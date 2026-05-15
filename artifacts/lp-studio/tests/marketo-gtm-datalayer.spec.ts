// End-to-end coverage for the GTM `Marketo Form Submission` dataLayer push.
//
// What we want to prove
// ─────────────────────
// Marketing keys downstream tags (ads conversions, GA4 events) off a
// `{ event: "Marketo Form Submission", formName: <name> }` push into
// `window.dataLayer`. The push must:
//   • only fire after Marketo confirms the submit (form.onSuccess), never
//     on a button click;
//   • carry the linked lp_form's `name` when there is one, falling back to
//     `"Marketo Form <id>"` when not;
//   • dedupe per-formName per page load — a second submit (or a parent
//     unmount/remount of the embed) must NOT push a second event.
//
// A regression that drops the dedupe (e.g. moving the guard to a `useRef`)
// or stops surfacing `name` on the public form fetch would silently break
// downstream conversion accounting.
//
// How
// ───
// • Stub `window.MktoForms2` via addInitScript so MarketoForm picks it up
//   without a real script fetch. The stub captures the registered
//   `onSuccess` callbacks and exposes a `__fireMarketoSuccess()` global so
//   the test can simulate a Marketo-confirmed success.
// • Render a published page with a Form block in *Marketo* mode pointing at
//   a linked lp_form so MarketoForm gets `formName=<lp_form.name>`.
// • Fire the success handler twice (and resize the viewport in between so
//   any incidental React re-render also gets a chance to double-fire) and
//   assert exactly one `Marketo Form Submission` entry in `dataLayer`.

import pg from "pg";
import { test, expect, request } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";
import { assertApiHealthy } from "./setup/api-health";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL / DATABASE_URL must be set");
  return url;
}

// Marketo Forms2 stub. Captures every onSuccess handler registered against
// the form instance and exposes `window.__fireMarketoSuccess(vals)` so the
// test can synthesise a Marketo-confirmed submission. Mirrors the surface
// `MarketoForm.tsx` actually touches (loadForm, vals, getId, onSuccess,
// submit). Pre-seeds `window.dataLayer = []` so the push helper finds it.
const MKTO_INIT_SCRIPT = `
  (function () {
    if (!window.dataLayer) window.dataLayer = [];
    if (window.MktoForms2) return;
    var handlers = [];
    window.__fireMarketoSuccess = function (vals) {
      var v = vals || {};
      // Marketo invokes every registered handler; honour that order so a
      // handler that returns false to cancel the redirect doesn't suppress
      // a sibling handler's side effects (mirrors the real Forms2 loader).
      for (var i = 0; i < handlers.length; i++) {
        try { handlers[i](v, ""); } catch (e) { /* ignore */ }
      }
    };
    window.MktoForms2 = {
      loadForm: function (baseUrl, munchkinId, formId, cb) {
        var stored = {};
        var instance = {
          vals: function (val) { Object.assign(stored, val || {}); },
          getId: function () { return formId; },
          onSuccess: function (fn) { if (typeof fn === "function") handlers.push(fn); },
          submit: function () {},
        };
        if (typeof cb === "function") cb(instance);
      },
      whenReady: function () {},
    };
  })();
`;

type DataLayerEntry = { event?: string; formName?: string };

test.describe("Marketo GTM dataLayer push", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageSlug: string;
  const formName = "Global SMB Demo Form";

  // Marketo coords seeded on the form block. Values are arbitrary because
  // the stubbed MktoForms2 never reads them.
  const FORMS2_BASE_URL = "https://app-test123.marketo.com";
  const FORMS2_MUNCHKIN = "111-AAA-222";
  const FORMS2_FORM_ID = 9876;

  test.beforeAll(async ({ request }) => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

    // Refresh the api-server's tenant-by-host cache so the freshly seeded
    // Royal tenant (domain='localhost') is visible to /api/lp/forms/:id and
    // /api/lp/page/:slug without waiting out the 60s TTL. Mirrors the
    // pattern in chili-piper-handoff.spec.ts.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Linked lp_form. `name` is what the BlockForm Marketo branch passes
    // through to MarketoForm as `formName`, and is what the GTM push event
    // must carry. Steps are minimal — we never submit the native form,
    // just the simulated Marketo-side onSuccess.
    const stepsJson = JSON.stringify([
      {
        id: "step-1",
        title: "",
        subtitle: "",
        fields: [
          { id: "fld-email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
        ],
        conditions: [],
      },
    ]);
    const formInsert = await pool.query<{ id: number }>(
      `INSERT INTO lp_forms (tenant_id, name, description, steps, multi_step,
                             submit_button_text, success_message, redirect_url,
                             background_style, email_recipients, webhook_url,
                             marketo_config, salesforce_config, chili_piper_config)
       VALUES ($1, $2, NULL, $3::jsonb, false,
               'Submit', 'Thanks!', NULL,
               'white', '[]'::jsonb, NULL,
               NULL, NULL, NULL)
       RETURNING id`,
      [tenant.tenantId, formName, stepsJson],
    );
    formId = formInsert.rows[0].id;

    // Publish a page with a Form block in *Marketo* mode (formMode:
    // "marketo") so BlockForm renders MarketoForm directly. The
    // marketoBaseUrl/MunchkinId/FormId props are read from the block,
    // and the linked formId pulls in the lp_form's `name` via the
    // public form fetch.
    pageSlug = `marketo-gtm-${Date.now().toString(36)}`;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Marketo GTM dataLayer Page",
        slug: pageSlug,
        status: "published",
        blocks: [
          {
            id: "form-1",
            type: "form",
            props: {
              formId,
              formMode: "marketo",
              marketoBaseUrl: FORMS2_BASE_URL,
              marketoMunchkinId: FORMS2_MUNCHKIN,
              marketoFormId: FORMS2_FORM_ID,
              headline: "Get a demo",
              subheadline: "We will be in touch.",
              submitButtonText: "Submit",
              backgroundStyle: "white",
              steps: [],
              multiStep: false,
            },
          },
        ],
      },
    });
    expect(
      createRes.ok(),
      `page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);
  });

  test.afterAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL) {
      try {
        const ctx = await request.newContext({ baseURL });
        await ctx.post("/api/_test/invalidate-host-cache").catch(() => undefined);
        await ctx.dispose();
      } catch {
        /* best-effort */
      }
    }
    if (pool && tenant) {
      await pool.query(`DELETE FROM lp_forms WHERE id = $1`, [formId]).catch(() => undefined);
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) await pool.end();
  });

  test("a successful Marketo submit from the EmailCaptureModal popup also pushes exactly one Marketo Form Submission event keyed by the modal's Marketo form id", async ({ page, baseURL, request }) => {
    // Modal-path coverage. The modal embeds Marketo directly (no linked
    // lp_form), so EmailCaptureModal passes `formName="Marketo Form <id>"`
    // and the GTM event must use that fallback. We seed a fresh
    // Marketo form id distinct from the inline test's id so that even
    // if both tests run in the same browser session, the per-page-load
    // dedupe Set (keyed by formName) doesn't collide. (Each Playwright
    // `page` is a fresh context, but this also documents the
    // "different formName ⇒ different dedupe slot" invariant.)
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Publish a page with a Bottom CTA block configured to open the
    // EmailCaptureModal in `marketo` form mode. The CTA button is what
    // mounts the modal on click; the modal then mounts MarketoForm,
    // which registers the GTM-push onSuccess handler against our stub.
    const modalPageSlug = `marketo-gtm-modal-${Date.now().toString(36)}`;
    const modalMarketoFormId = FORMS2_FORM_ID + 1;
    const expectedModalFormName = `Marketo Form ${modalMarketoFormId}`;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Marketo GTM dataLayer Modal Page",
        slug: modalPageSlug,
        status: "published",
        blocks: [
          {
            id: "cta-1",
            type: "bottom-cta",
            props: {
              headline: "Book a demo",
              subheadline: "We will be in touch.",
              ctaText: "Open modal",
              ctaUrl: "#",
              ctaAction: "modal-form",
              modalFormSource: "marketo",
              modalMarketoBaseUrl: FORMS2_BASE_URL,
              modalMarketoMunchkinId: FORMS2_MUNCHKIN,
              modalMarketoFormId,
              modalHeadline: "Get a demo",
              modalSubheadline: "Quick form below.",
            },
          },
        ],
      },
    });
    expect(
      createRes.ok(),
      `modal-page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);

    await page.addInitScript(MKTO_INIT_SCRIPT);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));

    const viewerUrl = `/lp/${modalPageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // Click the CTA — this mounts EmailCaptureModal, which mounts
    // MarketoForm, which (via the stub's loadForm) registers our GTM
    // onSuccess handler.
    await page.getByRole("button", { name: /open modal/i }).click();

    await page.waitForFunction(() => typeof window.__fireMarketoSuccess === "function", { timeout: 10_000 });

    const beforePushes = await page.evaluate((evt) => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === evt);
    }, "Marketo Form Submission");
    expect(beforePushes, "no GTM event should fire before Marketo confirms").toEqual([]);

    await page.evaluate(() => (window as unknown as { __fireMarketoSuccess: (v: unknown) => void }).__fireMarketoSuccess({ Email: "modal@example.com" }));

    await expect.poll(async () => {
      return page.evaluate(() => {
        const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
        return dl.filter((e) => e?.event === "Marketo Form Submission").length;
      });
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    const afterFirst = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(afterFirst, `expected exactly one push from the modal path, got ${JSON.stringify(afterFirst)}`).toHaveLength(1);
    expect(afterFirst[0]).toMatchObject({
      event: "Marketo Form Submission",
      formName: expectedModalFormName,
    });

    // Fire a second simulated success — the module-level dedupe Set
    // is shared between the inline and modal paths (both render the
    // same MarketoForm component), so the same one-push-per-formName
    // guarantee must hold here.
    await page.evaluate(() => (window as unknown as { __fireMarketoSuccess: (v: unknown) => void }).__fireMarketoSuccess({ Email: "modal@example.com" }));
    await page.waitForTimeout(250);
    const afterSecond = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(
      afterSecond,
      `a second modal submit must not push a duplicate event; dataLayer ended with ${JSON.stringify(afterSecond)}`,
    ).toHaveLength(1);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);
  });

  test("a successful Marketo submit pushes exactly one Marketo Form Submission event with the linked lp_form's name, and a second submit does NOT push a duplicate", async ({ page, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    await page.addInitScript(MKTO_INIT_SCRIPT);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));

    const viewerUrl = `/lp/${pageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // Wait for the public form fetch so MarketoForm has been mounted and
    // the stub's `loadForm` callback has run (registering our
    // pushMarketoSubmissionToDataLayer onSuccess handler).
    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );

    // Wait until at least one onSuccess handler is registered (the
    // dedicated GTM-push handler MarketoForm always registers when
    // submitOnReady is false).
    await page.waitForFunction(() => typeof window.__fireMarketoSuccess === "function", { timeout: 10_000 });

    // Sanity: nothing should be in dataLayer for our event yet — Marketo
    // hasn't confirmed any submit.
    const beforePushes = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(beforePushes, "no GTM event should fire before Marketo confirms").toEqual([]);

    // Fire the simulated Marketo success.
    await page.evaluate(() => (window as unknown as { __fireMarketoSuccess: (v: unknown) => void }).__fireMarketoSuccess({ Email: "demo@example.com" }));

    // Wait for the push to land.
    await expect.poll(async () => {
      return page.evaluate(() => {
        const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
        return dl.filter((e) => e?.event === "Marketo Form Submission").length;
      });
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    const afterFirst = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(afterFirst, `expected exactly one push after first success, got ${JSON.stringify(afterFirst)}`).toHaveLength(1);
    expect(afterFirst[0]).toMatchObject({
      event: "Marketo Form Submission",
      formName,
    });

    // Force a re-render by resizing the viewport (mirrors the re-render
    // guard in marketo-ghost-submit.spec.ts) — the module-level dedupe
    // Set must hold across any incidental remount of MarketoForm.
    await page.setViewportSize({ width: 800, height: 700 });
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(150);

    // Fire a second simulated success — this is the duplicate-guard
    // assertion. Marketing explicitly asked for at-most-one push per
    // (formName, page load) so downstream tags can't double-count.
    await page.evaluate(() => (window as unknown as { __fireMarketoSuccess: (v: unknown) => void }).__fireMarketoSuccess({ Email: "demo@example.com" }));

    // Give any async push a chance to settle, then re-read.
    await page.waitForTimeout(250);
    const afterSecond = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(
      afterSecond,
      `a second submit must not push a duplicate event; dataLayer ended with ${JSON.stringify(afterSecond)}`,
    ).toHaveLength(1);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);
  });
});
