// End-to-end coverage for the Marketo Forms2 "ghost submit" *failure*
// telemetry path.
//
// What we want to prove
// ─────────────────────
// Task #275 covered the happy ghost-submit path, and task #279 wired up
// `ghost_submit_attempted` / `ghost_submit_failed` telemetry events on the
// hidden MarketoForm. There is, however, no automated coverage that proves
// a *failed* loader actually emits the `ghost_submit_failed` event — a
// future MarketoForm refactor (e.g. swapping the script-load promise, the
// onLoadError prop wiring, or the BlockForm telemetry POST) could silently
// regress the alerting signal we just built and we'd only learn from
// missing-leads complaints.
//
// We additionally guard the visitor's success UX: when the ghost loader
// fails, the BlockForm.handleSubmit `await ghostSubmitDone` waiter must be
// released by MarketoForm's onLoadError → ghostResolveRef path *immediately*,
// not after the 2s safety timeout cap. We exercise the awaiter by configuring
// the form with a `redirect_url` and asserting the post-submit navigation
// completes well before the 2s + 1.5s baseline that an un-released waiter
// would impose.
//
// How
// ───
// • Stub `window.MktoForms2` via addInitScript with a `loadForm` that throws
//   synchronously. MarketoForm wraps the `loadForm` invocation in a `.then`
//   chain whose `.catch` fires `onLoadError`, so the throw is the cleanest
//   way to drive the failure branch without touching CSP or routing the
//   forms2.min.js URL to a 5xx.
// • Intercept POSTs to `/api/lp/track` and count exactly the
//   `ghost_submit_failed` ones. Other tracking events on the page (page
//   visit, form_submit conversion, ghost_submit_attempted) are recorded but
//   not asserted-against — only the failure event has a hard count.
// • Configure the global form with a `redirect_url` so handleSubmit's
//   redirect branch awaits `ghostSubmitDone`. Time the navigation to assert
//   it completes well before the 2s timeout cap (~1500ms vs ~3500ms).

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

// Marketo Forms2 stub whose loadForm throws synchronously. The throw
// surfaces inside MarketoForm's `ready.then(...).catch(...)` chain, which
// triggers the `onLoadError` prop — which is the exact code path that
// reports `ghost_submit_failed` telemetry.
//
// We also stub `whenReady` (no-op) just so any defensive call by future
// MarketoForm code doesn't crash with "is not a function" before the
// failure is reported.
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
test.describe.skip("Marketo Forms2 ghost submit failure telemetry", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageSlug: string;
  let redirectPath: string;

  // Same forms2 triple shape as the happy-path spec — values are arbitrary
  // because the loader stub never reads them.
  const FORMS2_BASE_URL = "https://app-test123.marketo.com";
  const FORMS2_MUNCHKIN = "111-AAA-222";
  const FORMS2_FORM_ID = 4242;

  const FIELD_MAPPINGS = {
    "Email": "Email",
    "First Name": "FirstName",
    "Company": "Company",
  };

  test.beforeAll(async ({ request }) => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

    // Refresh the api-server tenant-by-host cache so the freshly seeded
    // Royal tenant (domain='localhost') is visible to /api/lp/forms/:id and
    // /api/lp/page/:slug without waiting out the 60s TTL.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Configure a redirect_url on the form so BlockForm's handleSubmit
    // exercises the `await ghostSubmitDone` branch. Without a redirect (or
    // chiliPiperConfig) the success UX is unconditional and the awaiter is
    // never blocked — which would make the release-path assertion vacuous.
    pageSlug = `marketo-ghost-fail-${Date.now().toString(36)}`;
    redirectPath = `/lp/${pageSlug}?after_submit=1`;

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
      fieldMappings: FIELD_MAPPINGS,
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
               'Submit', 'Thanks!', $4,
               'white', '[]'::jsonb, NULL,
               $5::jsonb, NULL, NULL)
       RETURNING id`,
      [tenant.tenantId, "Marketo Ghost Submit Failure Test Form", stepsJson, redirectPath, marketoConfigJson],
    );
    formId = formInsert.rows[0].id;

    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Marketo Ghost Submit Failure Page",
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

  test("a failed Marketo loader emits exactly one ghost_submit_failed track event and does not stall the visitor's success UX", async ({ page, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    // See the happy-path spec for why we re-invalidate immediately before
    // navigation: the beforeAll invalidate races with any in-flight
    // tenant-host loadCache promise from a prior spec.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Inject the failing Marketo stub before any page script runs so the
    // ghost MarketoForm picks it up synchronously and skips the network
    // <script src=...> fetch entirely.
    await page.addInitScript(MKTO_FAIL_INIT_SCRIPT);

    // Capture every POST to /api/lp/track and bucket by conversionType so
    // we can assert *exactly one* `ghost_submit_failed` and *zero*
    // `ghost_submit_attempted` (the failure path short-circuits before the
    // attempted-callback fires by definition — loadForm threw).
    const trackByType = new Map<string, number>();
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/lp/track")) return;
      const raw = req.postData();
      if (!raw) return;
      let body: { conversionType?: string } = {};
      try { body = JSON.parse(raw) as { conversionType?: string }; } catch { return; }
      const ct = body.conversionType;
      if (!ct) return;
      trackByType.set(ct, (trackByType.get(ct) ?? 0) + 1);
    });

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
    await emailInput.fill("ghost-fail@example.com");
    await page.getByPlaceholder("Jane").fill("Ghostly");
    await page.getByPlaceholder("Acme").fill("GhostCo");

    // Time the submit → redirect cycle. With a healthy release path
    // (onLoadError → ghostResolveRef.resolve()) the redirect branch awaits
    // a near-instant ghostSubmitDone, then runs the 1500ms `setTimeout`
    // before navigating — total ~1500ms. With a regressed release path
    // it would instead wait the full 2000ms timeout cap before the timer
    // even starts — total ~3500ms.
    const submitStart = Date.now();
    await page.getByRole("button", { name: /submit/i }).click();

    // The success branch ("Thanks!") must appear independently of the
    // ghost-submit awaiter (setSubmitted runs before the await), and the
    // hidden MarketoForm is mounted inside it — that's where loadForm
    // throws and onLoadError fires.
    await expect(page.getByText("Thanks!")).toBeVisible({ timeout: 10_000 });

    // Wait for the failure track event. Polling rides out the network
    // hop for the keepalive POST.
    await expect
      .poll(() => trackByType.get("ghost_submit_failed") ?? 0, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);

    // Wait for the redirect navigation. The waitForURL itself bounds how
    // long we will tolerate a stalled awaiter — 3000ms is comfortably
    // below the 3500ms baseline an un-released waiter would impose, and
    // comfortably above the ~1500ms healthy baseline.
    await page.waitForURL((url) => url.search.includes("after_submit=1"), { timeout: 3_000 });
    const elapsed = Date.now() - submitStart;

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);

    // Exactly one ghost_submit_failed event.
    expect(
      trackByType.get("ghost_submit_failed") ?? 0,
      `expected exactly one ghost_submit_failed track POST, got ${trackByType.get("ghost_submit_failed") ?? 0}`,
    ).toBe(1);

    // The "attempted" telemetry is wired to MarketoForm's
    // onGhostSubmitAttempted, which only fires *inside* the loadForm
    // callback — and our stub throws *before* invoking that callback. So
    // a failed loader must NOT emit a phantom attempted event, otherwise
    // the funnel-report alerting would compute an inflated success rate
    // and miss the regression.
    expect(
      trackByType.get("ghost_submit_attempted") ?? 0,
      `failed loader must not also emit ghost_submit_attempted; got ${trackByType.get("ghost_submit_attempted") ?? 0}`,
    ).toBe(0);

    // Release-path proof: the navigation completed well before the 2s
    // timeout-cap fallback would have allowed.
    expect(
      elapsed,
      `redirect after a failed ghost loader took ${elapsed}ms — the onLoadError → ghostResolveRef release path likely regressed (un-released waiter baseline is ~3500ms)`,
    ).toBeLessThan(2_800);
  });
});
