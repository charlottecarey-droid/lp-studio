// End-to-end coverage for the GTM `Marketo Form Submission` dataLayer push.
//
// What we want to prove
// ─────────────────────
// Marketing keys downstream tags (ads conversions, GA4 events) off a
// `{ event: "Marketo Form Submission", formName: "Demo Form" }` push into
// `window.dataLayer`. The `formName` is hardcoded to the literal
// `"Demo Form"` string regardless of which Marketo form actually
// submitted, because that's what marketing's GTM container matches on.
//
// The push must:
//   • only fire after Marketo confirms the submit (form.onSuccess), never
//     on a button click;
//   • carry the literal `{ formName: "Demo Form", event: "Marketo Form
//     Submission" }` payload — exact casing, no extra keys;
//   • dedupe per page load — a second submit (or a parent unmount/remount
//     of the embed, or a successful submit on a *different* form on the
//     same page) must NOT push a second event. Both the visible-embed
//     (BlockForm) and modal (EmailCaptureModal) paths share the same
//     module-level dedupe slot.
//
// A regression that drops the dedupe (e.g. moving the guard to a `useRef`)
// or stops hardcoding the literal `"Demo Form"` string would silently
// break downstream conversion accounting.
//
// How
// ───
// • Stub `window.MktoForms2` via addInitScript so MarketoForm picks it up
//   without a real script fetch. The stub captures the registered
//   `onSuccess` callbacks per (munchkinId, formId) pair and exposes a
//   `__fireMarketoSuccess(formId, vals)` global so the test can simulate a
//   Marketo-confirmed success against a specific embed.
// • Render a published page with a Form block in *Marketo* mode and fire
//   the success handler, asserting the literal payload.
// • For the embed-vs-embed dedupe test, render two Form blocks pointing
//   at different Marketo form ids on the same page and fire success on
//   each — assert exactly one push lands.

import pg from "pg";
import { test, expect, request } from "./setup/pw";
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

// Marketo Forms2 stub. Captures onSuccess handlers keyed by formId and
// exposes `window.__fireMarketoSuccess(formId, vals)` so the test can
// synthesise a Marketo-confirmed submission against a specific embed.
// Pre-seeds `window.dataLayer = []` so the push helper finds it.
const MKTO_INIT_SCRIPT = `
  (function () {
    if (!window.dataLayer) window.dataLayer = [];
    if (window.MktoForms2) return;
    var handlersByForm = {};
    window.__fireMarketoSuccess = function (formId, vals) {
      var key = String(formId);
      var hs = handlersByForm[key] || [];
      var v = vals || {};
      // Marketo invokes every registered handler; honour that order so a
      // handler that returns false to cancel the redirect doesn't suppress
      // a sibling handler's side effects (mirrors the real Forms2 loader).
      for (var i = 0; i < hs.length; i++) {
        try { hs[i](v, ""); } catch (e) { /* ignore */ }
      }
    };
    window.MktoForms2 = {
      loadForm: function (baseUrl, munchkinId, formId, cb) {
        var key = String(formId);
        if (!handlersByForm[key]) handlersByForm[key] = [];
        var stored = {};
        var instance = {
          vals: function (val) { Object.assign(stored, val || {}); },
          getId: function () { return formId; },
          onSuccess: function (fn) { if (typeof fn === "function") handlersByForm[key].push(fn); },
          submit: function () {},
        };
        if (typeof cb === "function") cb(instance);
      },
      whenReady: function () {},
    };
  })();
`;

type DataLayerEntry = { event?: string; formName?: string };

const EXPECTED_FORM_NAME = "Demo Form";

test.describe("Marketo GTM dataLayer push", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageSlug: string;

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

    // Seed a linked lp_form whose `name` is intentionally NOT "Demo Form"
    // — the GTM push must hardcode the literal "Demo Form" string and
    // ignore this name entirely.
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
      [tenant.tenantId, "Global SMB Lead Form", stepsJson],
    );
    formId = formInsert.rows[0].id;

    // Publish a page with a Form block in *Marketo* mode (formMode:
    // "marketo") so BlockForm renders MarketoForm directly.
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

  test("a successful Marketo submit from the EmailCaptureModal popup pushes exactly one Marketo Form Submission event with the literal Demo Form payload", async ({ page, baseURL, request }) => {
    // Modal-path coverage. The modal embeds Marketo directly — the GTM
    // push must still carry the literal `formName: "Demo Form"`.
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Publish a page with a Bottom CTA block configured to open the
    // EmailCaptureModal in `marketo` form mode. The CTA button is what
    // mounts the modal on click; the modal then mounts MarketoForm,
    // which registers the GTM-push onSuccess handler against our stub.
    const modalPageSlug = `marketo-gtm-modal-${Date.now().toString(36)}`;
    const modalMarketoFormId = FORMS2_FORM_ID + 1;
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

    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "modal@example.com" }), modalMarketoFormId);

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
    // Hard equality: the payload must be exactly the literal pair
    // marketing's GTM tag matches on — no extra keys, exact casing.
    expect(afterFirst[0]).toEqual({
      event: "Marketo Form Submission",
      formName: EXPECTED_FORM_NAME,
    });

    // Fire a second simulated success — the module-level dedupe sentinel
    // must hold.
    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "modal@example.com" }), modalMarketoFormId);
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

  test("a successful Marketo submit pushes exactly one Marketo Form Submission event with the literal Demo Form payload, and a second submit does NOT push a duplicate", async ({ page, baseURL, request }) => {
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

    // Wait until the global firing helper is exposed.
    await page.waitForFunction(() => typeof window.__fireMarketoSuccess === "function", { timeout: 10_000 });

    // Sanity: nothing should be in dataLayer for our event yet — Marketo
    // hasn't confirmed any submit.
    const beforePushes = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(beforePushes, "no GTM event should fire before Marketo confirms").toEqual([]);

    // Fire the simulated Marketo success.
    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "demo@example.com" }), FORMS2_FORM_ID);

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
    // Hard equality: literal payload only — even though the linked
    // lp_form's name is "Global SMB Lead Form", the push must hardcode
    // "Demo Form".
    expect(afterFirst[0]).toEqual({
      event: "Marketo Form Submission",
      formName: EXPECTED_FORM_NAME,
    });

    // Force a re-render by resizing the viewport (mirrors the re-render
    // guard in marketo-ghost-submit.spec.ts) — the module-level dedupe
    // sentinel must hold across any incidental remount of MarketoForm.
    await page.setViewportSize({ width: 800, height: 700 });
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(150);

    // Fire a second simulated success — duplicate-guard assertion.
    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "demo@example.com" }), FORMS2_FORM_ID);

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

  test("two distinct Marketo forms on the same page share one dedupe slot — a successful submit on each results in exactly one push", async ({ page, baseURL, request }) => {
    // Cross-form dedupe: now that the helper hardcodes `formName:
    // "Demo Form"`, the dedupe sentinel is keyed on a single page-load
    // flag (no longer per-formName). A successful submit on form A
    // followed by a successful submit on form B on the same page must
    // therefore push exactly one event.
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    const twoFormSlug = `marketo-gtm-two-${Date.now().toString(36)}`;
    const formAId = FORMS2_FORM_ID + 100;
    const formBId = FORMS2_FORM_ID + 101;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Marketo GTM dataLayer Two-Form Page",
        slug: twoFormSlug,
        status: "published",
        blocks: [
          {
            id: "form-a",
            type: "form",
            props: {
              formId,
              formMode: "marketo",
              marketoBaseUrl: FORMS2_BASE_URL,
              marketoMunchkinId: FORMS2_MUNCHKIN,
              marketoFormId: formAId,
              headline: "Get a demo (A)",
              subheadline: "",
              submitButtonText: "Submit",
              backgroundStyle: "white",
              steps: [],
              multiStep: false,
            },
          },
          {
            id: "form-b",
            type: "form",
            props: {
              formId,
              formMode: "marketo",
              marketoBaseUrl: FORMS2_BASE_URL,
              marketoMunchkinId: FORMS2_MUNCHKIN,
              marketoFormId: formBId,
              headline: "Get a demo (B)",
              subheadline: "",
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
      `two-form page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);

    await page.addInitScript(MKTO_INIT_SCRIPT);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));

    const viewerUrl = `/lp/${twoFormSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    await page.waitForFunction(() => typeof window.__fireMarketoSuccess === "function", { timeout: 10_000 });

    // Wait until BOTH MarketoForm embeds have registered onSuccess
    // handlers in the stub. The stub's loadForm runs synchronously
    // inside MarketoForm's useEffect, so once the public form fetch
    // settles for both blocks the handlers are wired.
    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );
    // Give React a tick to mount both form blocks.
    await page.waitForTimeout(250);

    // Fire success on form A.
    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "a@example.com" }), formAId);

    await expect.poll(async () => {
      return page.evaluate(() => {
        const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
        return dl.filter((e) => e?.event === "Marketo Form Submission").length;
      });
    }, { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    const afterA = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(afterA, `expected exactly one push after form A, got ${JSON.stringify(afterA)}`).toHaveLength(1);
    expect(afterA[0]).toEqual({
      event: "Marketo Form Submission",
      formName: EXPECTED_FORM_NAME,
    });

    // Fire success on form B — the shared dedupe slot must suppress it.
    await page.evaluate((fid) => (window as unknown as { __fireMarketoSuccess: (fid: number, v: unknown) => void }).__fireMarketoSuccess(fid, { Email: "b@example.com" }), formBId);
    await page.waitForTimeout(250);

    const afterB = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer ?? [];
      return dl.filter((e) => e?.event === "Marketo Form Submission");
    });
    expect(
      afterB,
      `form B submit must not push a duplicate event; dataLayer ended with ${JSON.stringify(afterB)}`,
    ).toHaveLength(1);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);
  });
});
