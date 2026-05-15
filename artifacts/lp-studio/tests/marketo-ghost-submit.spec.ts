// End-to-end coverage for the hidden Marketo Forms2 "ghost submit" path.
//
// What we want to prove
// ─────────────────────
// When a tenant configures `marketo_config.forms2` (baseUrl + munchkinId +
// formId) on an lp_forms row and that form is rendered through a *standard*
// (non-Marketo-mode) FormBlock on a published page, a successful submission
// must additionally fire a hidden Marketo Forms2 POST so the lead lands in
// Marketo via Munchkin association in addition to the server-side REST sync.
//
// The ghost path has no automated coverage today — a regression in CSP, in
// the public form payload sanitiser, or in MarketoForm's one-shot
// `submitOnReady` guard could silently break Marketo lead capture across
// every page using this global form, and we'd only learn from Marketo's
// own logs. This spec catches all three categories of regression.
//
// How
// ───
// • Stub `window.MktoForms2` via addInitScript so MarketoForm picks it up
//   without ever attempting a `<script src=...marketo.com...>` fetch.
// • The stub's `form.submit()` issues a real `fetch()` against the canonical
//   `*.mktoresp.com/index.php/leadCapture/save2` endpoint, mirroring what
//   the real Forms2 loader does — so a Playwright `page.route` interceptor
//   on `**/*.mktoresp.com/**` can count submissions and capture the
//   submitted (mapped) field values.
// • The form block is rendered in default (native) mode, exercising the
//   `handleSubmit` → `setGhostSubmitVals` → hidden MarketoForm code path
//   in BlockForm (not the Marketo-mode branch — that has its own coverage
//   in chili-piper-handoff.spec.ts).

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

// Marketo Forms2 stub. Mirrors the public surface that MarketoForm.tsx
// touches (loadForm, vals, getId, onSuccess, submit). The interesting bit
// is `submit()`: it issues a real `fetch()` to the canonical mktoresp.com
// endpoint so Playwright's `page.route` interceptor can count submissions
// and inspect the submitted (mapped) field map.
const MKTO_INIT_SCRIPT = `
  (function () {
    if (window.MktoForms2) return;
    window.MktoForms2 = {
      loadForm: function (baseUrl, munchkinId, formId, cb) {
        var stored = {};
        var instance = {
          vals: function (v) { Object.assign(stored, v || {}); },
          getId: function () { return formId; },
          onSuccess: function () {},
          submit: function () {
            // Real Forms2 POSTs to <munchkinId-without-dashes>.mktoresp.com.
            // Replicate that target shape so a route interceptor on
            // **/*.mktoresp.com/** observes the request, then ship the
            // current vals as JSON for the assertion side to read back.
            var host = String(munchkinId || "").replace(/-/g, "").toLowerCase();
            var url = "https://" + host + ".mktoresp.com/index.php/leadCapture/save2";
            try {
              fetch(url, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ formId: formId, munchkinId: munchkinId, vals: stored }),
              }).catch(function () {});
            } catch (e) { /* ignore */ }
          },
        };
        if (typeof cb === "function") cb(instance);
      },
      whenReady: function () {},
    };
  })();
`;

test.describe("Marketo Forms2 ghost submit", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageSlug: string;

  // The forms2 triple seeded onto lp_forms.marketo_config. Munchkin id is
  // intentionally hyphenated so the stub's normalisation
  // (`.replace(/-/g, "")`) is exercised the same way the real Forms2
  // loader normalises it.
  const FORMS2_BASE_URL = "https://app-test123.marketo.com";
  const FORMS2_MUNCHKIN = "111-AAA-222";
  const FORMS2_FORM_ID = 4242;

  // Field mappings: form labels (left) → Marketo REST names (right). The
  // ghost-submit path translates by label so what lands in Marketo must be
  // keyed by the right-hand side.
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

    // Refresh the api-server's tenant-by-host cache so the freshly seeded
    // Royal tenant (domain='localhost') is visible to /api/lp/forms/:id and
    // /api/lp/page/:slug without waiting out the 60s TTL. Mirrors the
    // pattern in chili-piper-handoff.spec.ts.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Seed an lp_forms row with marketo_config.{fieldMappings, forms2}.
    // chili_piper_config is left null so the post-submit code path does
    // NOT route through the scheduler — we want the plain success branch
    // that mounts the hidden ghost MarketoForm.
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
               'Submit', 'Thanks!', NULL,
               'white', '[]'::jsonb, NULL,
               $4::jsonb, NULL, NULL)
       RETURNING id`,
      [tenant.tenantId, "Marketo Ghost Submit Test Form", stepsJson, marketoConfigJson],
    );
    formId = formInsert.rows[0].id;

    // Publish a page with a single Form block in *native* mode pointing at
    // the form we just seeded. Native mode (not "marketo") is what triggers
    // the BlockForm.handleSubmit → ghost-submit branch under test.
    pageSlug = `marketo-ghost-${Date.now().toString(36)}`;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Marketo Ghost Submit Page",
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
    // Drop the api-server's tenant-by-host cache so subsequent royal-tenant
    // tests don't hit a stale entry pointing at this test's tenant.
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

  test("submitting the visible form fires exactly one Marketo Forms2 POST with mapped field names, and re-rendering the success branch does not double-fire", async ({ page, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    // Re-invalidate the api-server's tenant-by-host cache once more right
    // before navigation. The beforeAll invalidate races with any in-flight
    // loadCache promise that may have been kicked off by other middleware
    // (e.g. CORS) in a prior spec — if that load resolves AFTER our
    // invalidate, the cache is repopulated WITHOUT our just-inserted
    // tenant, and the public viewer GET 404s. A second invalidation
    // after the in-flight has settled clears that stale state.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Inject the Marketo stub before any page script runs so the ghost
    // MarketoForm's useEffect picks it up synchronously. Without this the
    // component would try to <script src=...marketo.com...> out to the
    // public CDN and the test would either time out or actually hit the
    // network.
    await page.addInitScript(MKTO_INIT_SCRIPT);

    // Intercept every POST to the canonical Marketo Forms2 endpoint. We
    // capture the body for the field-name assertion and short-circuit with
    // a synthetic 200 so the in-page fetch never escapes the test. The
    // route is registered before navigation so the very first request is
    // captured.
    const ghostPosts: Array<{ url: string; body: unknown }> = [];
    await page.route("**/*.mktoresp.com/**", async (route) => {
      const req = route.request();
      let body: unknown = null;
      const raw = req.postData();
      if (raw) {
        try { body = JSON.parse(raw); } catch { body = raw; }
      }
      ghostPosts.push({ url: req.url(), body });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    // Surface uncaught page errors so a render crash doesn't manifest as
    // a mysterious "no POST observed". We deliberately do NOT collect
    // generic console.error() entries — the public viewer makes a few
    // best-effort authenticated probes (e.g. /api/auth/me) that 401 for
    // anonymous visitors and log "Failed to load resource: 401" via the
    // browser's resource loader, which is unrelated to the ghost-submit
    // path under test.
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));

    const viewerUrl = `/lp/${pageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // Wait for the BlockForm's globalForm fetch to complete so the form's
    // steps (and marketoConfig) are present before we type. Without this,
    // we could race the fetch and submit an empty form against the
    // fallback `props.steps = []`.
    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );

    // Visible fields should now be on the page. Use placeholders to locate
    // them — robust to label-vs-input wiring tweaks in the future.
    const emailInput = page.getByPlaceholder("you@example.com");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill("ghost@example.com");
    await page.getByPlaceholder("Jane").fill("Ghostly");
    await page.getByPlaceholder("Acme").fill("GhostCo");

    // Click the submit button. Use role+name so a styling change on the
    // button (e.g. the brand-aware accent colour swap) doesn't break the
    // selector.
    await page.getByRole("button", { name: /submit/i }).click();

    // The success branch should appear. The ghost MarketoForm is mounted
    // inside the success section (display:none wrapper), so when we see
    // the success message the component has had a chance to mount and
    // fire submit() in its useEffect.
    await expect(page.getByText("Thanks!")).toBeVisible({ timeout: 10_000 });

    // Wait until exactly one ghost POST has been observed. Polling lets us
    // ride out the `setTimeout(submit, 0)` deferral inside MarketoForm.
    await expect.poll(() => ghostPosts.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join("\n")}`).toEqual([]);

    // Exactly one POST.
    expect(ghostPosts, `expected exactly one mktoresp.com POST, got ${JSON.stringify(ghostPosts)}`).toHaveLength(1);

    // Submitted-fields assertion: the request body must carry the values
    // keyed by the *Marketo REST names* (right-hand side of fieldMappings),
    // not the form labels. This guards the public form payload sanitiser
    // and the label→REST mapping in BlockForm.handleSubmit.
    const post = ghostPosts[0];
    expect(post.url).toContain(".mktoresp.com/");
    // Munchkin id has the dashes stripped in the host.
    expect(post.url).toContain(FORMS2_MUNCHKIN.replace(/-/g, "").toLowerCase() + ".mktoresp.com");
    const body = post.body as { formId?: number; vals?: Record<string, string> };
    expect(body.formId, "ghost POST must carry the configured Forms2 formId").toBe(FORMS2_FORM_ID);
    expect(body.vals, "ghost POST must include a vals payload").toBeTruthy();
    // Mapped REST names — Email is identity-mapped, but FirstName / Company
    // exercise the label→REST translation.
    expect(body.vals).toMatchObject({
      Email: "ghost@example.com",
      FirstName: "Ghostly",
      Company: "GhostCo",
    });
    // And, critically, the raw form labels must NOT appear as keys —
    // otherwise Marketo would silently drop the values as unknown fields.
    expect(Object.keys(body.vals!)).not.toContain("First Name");
    expect(Object.keys(body.vals!)).not.toContain("Email Address");

    // ── Re-render guard ───────────────────────────────────────────────────
    // The MarketoForm component's submittedKeysRef one-shot guard is meant
    // to prevent a second submit when the success branch re-renders (e.g.
    // a parent state change, a viewport resize triggering a re-layout, or
    // any incidental re-render in the React tree). Force a few re-renders
    // by resizing the viewport and waiting, then re-assert that no second
    // POST has fired.
    await page.setViewportSize({ width: 800, height: 700 });
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(500);

    expect(
      ghostPosts.length,
      `re-rendering the success branch must not produce a second Marketo POST; got ${ghostPosts.length}`,
    ).toBe(1);
  });
});
