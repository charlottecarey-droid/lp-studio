// End-to-end coverage for the Marketo ghost-submit *attribution* path.
//
// What we want to prove
// ─────────────────────
// Task #279 wired `pageId` + `formId` into the BlockForm telemetry POSTs for
// the hidden Marketo Forms2 ("ghost") submit, and task #280 surfaced those
// rows through `/lp/analytics/ghost-submits` so admins can pinpoint *which*
// page/form is silently dropping leads. Before that fix the funnel report
// could only show a tenant-wide ghost-submit count and operators had to
// manually bisect across published pages to find the regression.
//
// `marketo-ghost-submit-failed.spec.ts` already locks the *count* of
// `ghost_submit_failed` track POSTs and the visitor success-UX release path,
// but it does not look at the persisted row or the analytics API. A
// regression that drops `pageId` / `formId` from the BlockForm telemetry
// payload — or a future tracking-route refactor that stops persisting either
// column on lp_events — would silently re-introduce the original
// "tenant-wide count only" problem and slip past existing coverage.
//
// This spec closes that gap end-to-end:
//   • mounts BlockForm with a Marketo-configured global form,
//   • simulates a ghost-submit failure (loadForm throws) on a published page,
//   • asserts the recorded `lp_events` row carries the correct `page_id` /
//     `form_id`,
//   • asserts `/lp/analytics/ghost-submits` groups the failure under the
//     same page + form pair (with the page's title/slug and form's name).
//
// How
// ───
// Same Marketo Forms2 stub shape as `marketo-ghost-submit-failed.spec.ts`
// (loadForm throws synchronously → MarketoForm.onLoadError fires → BlockForm
// emits `ghost_submit_failed` with pageId/formId). The DB + analytics
// assertions then validate the *attribution contract* end-to-end.

import pg from "pg";
import { test, expect, request } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders, newAuthedContext } from "./setup/csrf";
import { assertApiHealthy } from "./setup/api-health";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL / DATABASE_URL must be set");
  return url;
}

// Marketo Forms2 stub whose loadForm throws synchronously. Mirrors the
// failure stub from `marketo-ghost-submit-failed.spec.ts` — surfaces inside
// MarketoForm's `ready.then(...).catch(...)` chain and triggers the
// `onLoadError` prop, which is what fires the `ghost_submit_failed`
// telemetry POST whose attribution we're asserting.
const MKTO_FAIL_INIT_SCRIPT = `
  (function () {
    if (window.MktoForms2) return;
    window.MktoForms2 = {
      loadForm: function () {
        throw new Error("simulated Marketo Forms2 loader failure");
      },
      whenReady: function () {},
    };
  })();
`;

// Ghost-submit is gated off via GHOST_SUBMIT_ENABLED in BlockForm.tsx while
// marketing validates Graham's GTM dataLayer-push approach. Re-enable these
// tests when the flag flips back to true.
test.describe.skip("Marketo ghost-submit attribution", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageId: number;
  let pageSlug: string;
  let pageTitle: string;
  const formName = "Marketo Ghost Submit Attribution Test Form";

  // Same forms2 triple shape as the sibling specs — values are arbitrary
  // because the loader stub never reads them.
  const FORMS2_BASE_URL = "https://app-test123.marketo.com";
  const FORMS2_MUNCHKIN = "111-AAA-222";
  const FORMS2_FORM_ID = 4242;

  test.beforeAll(async ({ request }) => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

    // Refresh the api-server tenant-by-host cache so the freshly seeded
    // Royal tenant (domain='localhost') is visible to /api/lp/forms/:id and
    // /api/lp/page/:slug without waiting out the 60s TTL. Mirrors the
    // pattern in chili-piper-handoff.spec.ts.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    pageSlug = `marketo-ghost-attr-${Date.now().toString(36)}`;
    pageTitle = "Marketo Ghost Submit Attribution Page";

    const stepsJson = JSON.stringify([
      {
        id: "step-1",
        title: "",
        subtitle: "",
        fields: [
          { id: "fld-email", label: "Email", type: "email", required: true, placeholder: "you@example.com" },
          { id: "fld-first", label: "First Name", type: "text", required: false, placeholder: "Jane" },
          { id: "fld-company", label: "Company", type: "text", required: false, placeholder: "Acme" },
        ],
        conditions: [],
      },
    ]);
    const marketoConfigJson = JSON.stringify({
      enabled: true,
      fieldMappings: {
        "Email": "Email",
        "First Name": "FirstName",
        "Company": "Company",
      },
      forms2: {
        baseUrl: FORMS2_BASE_URL,
        munchkinId: FORMS2_MUNCHKIN,
        formId: FORMS2_FORM_ID,
      },
    });
    const formInsert = await pool.query<{ id: number }>(
      `INSERT INTO lp_forms (tenant_id, name, description, steps, multi_step,
                             submit_button_text, success_message, redirect_url,
                             background_style, email_recipients, webhook_url,
                             marketo_config, salesforce_config, chili_piper_config)
       VALUES ($1, $2, NULL, $3::jsonb, false,
               'Submit', 'Thanks!', NULL,
               'white', '[]'::jsonb, NULL,
               $4::jsonb, NULL, NULL)
       RETURNING id`,
      [tenant.tenantId, formName, stepsJson, marketoConfigJson],
    );
    formId = formInsert.rows[0].id;

    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: pageTitle,
        slug: pageSlug,
        status: "published",
        blocks: [
          {
            id: "form-1",
            type: "form",
            props: {
              formId,
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
    const created = (await createRes.json()) as { id: number };
    pageId = created.id;
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
      // lp_events is cascaded by the tenant teardown via the lp_pages /
      // lp_tests cascade chain, but be explicit about the form row that
      // royal-tenant doesn't drop (lp_forms only has a tenant FK, not a
      // page FK) — see cleanupRoyalTenant for the rest.
      await pool.query(`DELETE FROM lp_forms WHERE id = $1`, [formId]).catch(() => undefined);
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) await pool.end();
  });

  test("a failed Marketo loader records lp_events with the originating page_id/form_id and the analytics drill-down groups the failure under that page+form", async ({ page, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    // Re-invalidate immediately before navigation: the beforeAll invalidate
    // races with any in-flight tenant-host loadCache promise from a prior
    // spec.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    await page.addInitScript(MKTO_FAIL_INIT_SCRIPT);

    // Surface uncaught page errors so a render crash doesn't manifest as a
    // mysterious "no failure event observed". The simulated loader throw
    // itself is caught by MarketoForm's `.catch` and never reaches the
    // window error handler.
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));

    const viewerUrl = `/lp/${pageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // Wait for the BlockForm globalForm fetch so the form's steps and
    // marketoConfig are present before we type / submit.
    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );

    const emailInput = page.getByPlaceholder("you@example.com");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill("attribution@example.com");
    await page.getByPlaceholder("Jane").fill("Attribution");
    await page.getByPlaceholder("Acme").fill("AttrCo");

    await page.getByRole("button", { name: /submit/i }).click();

    // Success branch must render — the hidden MarketoForm is mounted inside
    // it, which is where loadForm throws and onLoadError fires.
    await expect(page.getByText("Thanks!")).toBeVisible({ timeout: 10_000 });

    // Wait for the failure track POST to round-trip so the row is
    // committed before we read lp_events. A 5xx here would mean the
    // attribution payload was rejected by /lp/track — a bug in either
    // the BlockForm payload or the route's column mapping.
    const trackResp = await page.waitForResponse(
      async (r) => {
        if (r.request().method() !== "POST") return false;
        if (!r.url().includes("/api/lp/track")) return false;
        const raw = r.request().postData();
        if (!raw) return false;
        try {
          const body = JSON.parse(raw) as { conversionType?: string };
          return body.conversionType === "ghost_submit_failed";
        } catch {
          return false;
        }
      },
      { timeout: 10_000 },
    );
    expect(
      trackResp.status(),
      `ghost_submit_failed /lp/track POST should return 2xx, got ${trackResp.status()}`,
    ).toBeLessThan(400);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);

    // ─── DB assertion ──────────────────────────────────────────────
    // The recorded lp_events row must carry both page_id and form_id —
    // without either, the /lp/analytics/ghost-submits drill-down can't
    // attribute the failure to a specific page/form pair and the row
    // falls back to the tenant-wide-only counter we explicitly fixed.
    const { rows: eventRows } = await pool.query<{
      page_id: number | null;
      form_id: number | null;
      conversion_type: string;
    }>(
      `SELECT e.page_id, e.form_id, e.conversion_type
         FROM lp_events e
         JOIN lp_pages p ON p.id = e.page_id
        WHERE p.tenant_id = $1
          AND e.conversion_type = 'ghost_submit_failed'
          AND e.page_id = $2
          AND e.form_id = $3`,
      [tenant.tenantId, pageId, formId],
    );
    expect(
      eventRows.length,
      `expected at least one lp_events row attributed to page=${pageId} form=${formId}, got ${eventRows.length}`,
    ).toBeGreaterThanOrEqual(1);
    const row = eventRows[0];
    expect(row.page_id, "lp_events.page_id must match the originating page").toBe(pageId);
    expect(row.form_id, "lp_events.form_id must match the originating form").toBe(formId);

    // ─── Analytics endpoint assertion ─────────────────────────────
    // The drill-down endpoint runs through the same authenticated path
    // the admin UI uses (requireAuth + getTenantId from session). Use a
    // pre-authed context so CSRF + lp_sid are wired correctly, even
    // though the endpoint is GET-only — newAuthedContext is the
    // canonical way to attach the session.
    const authed = await newAuthedContext({
      baseURL: baseURL!,
      sid: tenant.sessionSid,
    });
    try {
      const drillRes = await authed.get("/api/lp/analytics/ghost-submits");
      expect(
        drillRes.ok(),
        `ghost-submits drill-down failed: ${drillRes.status()} ${await drillRes.text()}`,
      ).toBe(true);
      const drillRows = (await drillRes.json()) as Array<{
        pageId: number;
        pageTitle: string;
        pageSlug: string;
        formId: number | null;
        formName: string | null;
        attempts: number;
        failures: number;
      }>;

      const ours = drillRows.find((r) => r.pageId === pageId && r.formId === formId);
      expect(
        ours,
        `expected the ghost-submits drill-down to surface a row for page=${pageId} form=${formId}, got ${JSON.stringify(drillRows)}`,
      ).toBeTruthy();
      // Page + form metadata round-trips so the admin sees a useful
      // label, not a bare ID. A regression that drops the join on
      // lp_pages / lp_forms would surface here as a missing
      // pageTitle/formName.
      expect(ours!.pageTitle, "drill-down row must carry page title").toBe(pageTitle);
      expect(ours!.pageSlug, "drill-down row must carry page slug").toBe(pageSlug);
      expect(ours!.formName, "drill-down row must carry form name").toBe(formName);
      expect(
        ours!.failures,
        "drill-down row should count at least one failure for our page/form",
      ).toBeGreaterThanOrEqual(1);
    } finally {
      await authed.dispose();
    }
  });
});
