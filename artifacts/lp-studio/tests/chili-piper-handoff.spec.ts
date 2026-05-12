// End-to-end coverage for the Marketo → Chili Piper handoff on the public viewer.
//
// What we want to prove
// ─────────────────────
// When a tenant configures `chili_piper_config` on an lp_forms row and that
// form is rendered through a Marketo-mode FormBlock on a published page, a
// successful Marketo submission must:
//   • cancel Marketo's default redirect,
//   • build a Chili Piper URL by merging the submitted Marketo field map
//     (Email, FirstName, …) into the configured scheduler URL via
//     buildChiliPiperHandoffUrl,
//   • and surface that URL inline as an iframe (mode === "modal" — the
//     default UX, no Dandy/SMB-leaking redirect involved).
//
// We exercise this against a real Royal-style generic-industry tenant so the
// per-tenant isolation path is the same one used in production. The tenant's
// Marketo creds are stubbed (window.MktoForms2 is replaced via addInitScript)
// to avoid hitting Marketo from the test runner.
//
// Why this matters for isolation
// ──────────────────────────────
// The Chili Piper URL never lives in app code — it lives only on the
// lp_forms.chili_piper_config row for the tenant we set it on. The sibling
// `no-dandy-leak-tenant.spec.ts` keeps the leak guarantee honest by creating
// a fresh tenant *without* a Chili Piper config and scanning for leaks; if
// CP URLs ever leaked across tenants, that spec would catch it.

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

// Stub Marketo's global so the FormBlock's MarketoForm can mount without
// touching the real network. The stub records the most recent loaded form
// instance on `window.__mktoTestForm` so the test can fire onSuccess().
const MKTO_INIT_SCRIPT = `
  (function () {
    if (window.MktoForms2) return;
    const handlers = [];
    const instance = {
      _handlers: handlers,
      vals(_v) {},
      getId() { return 999; },
      onSuccess(handler) { handlers.push(handler); },
      // Test hook: invoke every registered onSuccess handler with the given
      // submitted-values object (mirrors what real Marketo passes).
      _trigger(vals) {
        for (const h of handlers) { try { h(vals, ""); } catch (e) {} }
      },
    };
    window.MktoForms2 = {
      loadForm(_baseUrl, _munchkinId, _formId, cb) {
        window.__mktoTestForm = instance;
        if (typeof cb === "function") cb(instance);
      },
      whenReady(cb) { if (typeof cb === "function") cb(instance); },
    };
  })();
`;

declare global {
  interface Window {
    __mktoTestForm?: {
      _trigger: (vals: Record<string, string>) => void;
    };
  }
}

test.describe("Marketo → Chili Piper handoff", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let formId: number;
  let pageId: number;
  let pageSlug: string;

  test.beforeAll(async ({ request }) => {
    // Fast-fail with a clear pointer to the api-server log if startup crashed
    // (see task #242), instead of letting the first /api/lp/pages POST
    // surface a bare ECONNREFUSED.
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

    // Refresh the API server's in-process tenant-host cache so the freshly
    // inserted Royal tenant (with domain='localhost') is visible to
    // findTenantByHost without waiting out the 60s TTL — otherwise the
    // public /api/lp/page/:slug live-URL lookup below resolves no tenant
    // and 404s our just-published page. Mirrors the pattern in
    // draft-preview-gating.spec.ts. Dev-only endpoint (gated on NODE_ENV).
    // purgeStaleRoyalTenants() above can also delete a previously-cached
    // localhost mapping, so invalidating here covers both cases.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Insert an lp_forms row with chili_piper_config set. Done via SQL so the
    // test stays focused on the viewer behaviour rather than the editor UI
    // (which has its own coverage in tests/forms-editor.spec or similar).
    const formInsert = await pool.query<{ id: number }>(
      `INSERT INTO lp_forms (tenant_id, name, description, steps, multi_step,
                             submit_button_text, success_message, redirect_url,
                             background_style, email_recipients, webhook_url,
                             marketo_config, salesforce_config, chili_piper_config)
       VALUES ($1, $2, NULL, $3::jsonb, false,
               'Submit', NULL, NULL,
               'white', '[]'::jsonb, NULL,
               NULL, NULL, $4::jsonb)
       RETURNING id`,
      [
        tenant.tenantId,
        "Chili Piper Handoff Test Form",
        JSON.stringify([{ id: "step-1", title: "", subtitle: "", fields: [], conditions: [] }]),
        JSON.stringify({
          url: "https://example.chilipiper.com/router/test?id=&existing=1",
          mode: "modal",
        }),
      ],
    );
    formId = formInsert.rows[0].id;

    // Publish a page with a single Form block in Marketo mode pointing at the
    // form we just created. Marketo creds are placeholders — the stub in
    // MKTO_INIT_SCRIPT short-circuits the real Marketo loader.
    pageSlug = `cp-handoff-${Date.now().toString(36)}`;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "CP Handoff Page",
        slug: pageSlug,
        status: "published",
        blocks: [
          {
            id: "form-1",
            type: "form",
            props: {
              formMode: "marketo",
              formId,
              marketoBaseUrl: "https://example.marketo.com",
              marketoMunchkinId: "111-AAA-222",
              marketoFormId: 999,
              headline: "Get a demo",
            },
          },
        ],
      },
    });
    expect(
      createRes.ok(),
      `page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);
    const row = (await createRes.json()) as { id: number };
    pageId = row.id;
  });

  test.afterAll(async ({}, testInfo) => {
    // Drop the api-server's in-process tenant-by-host cache so subsequent
    // royal-tenant tests (e.g. no-dandy-leak-tenant.spec.ts) don't see stale
    // entries pointing at this test's now-deleted tenant. The endpoint is
    // dev-only (NODE_ENV !== "production").
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
      // lp_forms is not cleaned by the standard fixture — drop our row first
      // (lp_pages is purged by cleanupRoyalTenant via the tenant cascade).
      await pool.query(`DELETE FROM lp_forms WHERE id = $1`, [formId]).catch(() => undefined);
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) await pool.end();
  });

  test("submitting the Marketo form swaps in a Chili Piper iframe with submitted values prefilled", async ({ page, baseURL, request }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    // Sanity: the page response must surface formId on the form block. If
    // the API ever stops persisting that field the rest of this test would
    // hang waiting for /api/lp/forms/:id, so check it explicitly first.
    const pageRes = await request.get(`/api/lp/page/${pageSlug}`);
    expect(pageRes.ok(), `viewer fetch failed: ${pageRes.status()}`).toBe(true);
    const pageJson = (await pageRes.json()) as { blocks: Array<{ type: string; props: Record<string, unknown> }> };
    const formBlock = pageJson.blocks.find((b) => b.type === "form");
    expect(formBlock, "saved page is missing the form block").toBeTruthy();
    expect(
      formBlock!.props.formId,
      `form block lost formId on save/load round-trip; props=${JSON.stringify(formBlock!.props)}`,
    ).toBe(formId);

    // Inject the Marketo stub before any page script runs so the FormBlock's
    // useEffect picks it up synchronously and never tries to <script src=...>
    // out to marketo.com.
    await page.addInitScript(MKTO_INIT_SCRIPT);

    // Track every /api/lp/track POST status so we can assert at the end that
    // none of them came back as a swallowed 5xx. The original bug shipped a
    // hard-coded `testId: 0` on builder-page submissions, which violated the
    // FK constraint on lp_events.test_id and silently 500'd inside a
    // try/catch — funnel reports lost the conversion entirely. This guard
    // would have caught that regression on day one.
    const trackStatuses: number[] = [];
    page.on("response", (resp) => {
      const req = resp.request();
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/lp/track")) return;
      trackStatuses.push(resp.status());
    });

    // Surface uncaught console errors / page errors so a render crash
    // doesn't manifest as a mysterious "iframe not found".
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`console.error: ${msg.text()}`);
    });

    const viewerUrl = `/lp/${pageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // Wait for the BlockForm's globalForm fetch to complete first — we
    // gate the MarketoForm mount on that response so the onSuccess closure
    // sees the loaded chiliPiperConfig.
    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );

    // Then wait for MarketoForm to mount and register with our stub.
    await page.waitForFunction(
      () => Boolean((window as Window).__mktoTestForm),
      undefined,
      { timeout: 30_000 },
    );
    // React state setter from the fetch then commits — give it a frame.
    await page.waitForTimeout(100);

    // Simulate a successful Marketo submission. The values match the
    // DEFAULT_FIELD_MAP keys in chili-piper-handoff.ts.
    await page.evaluate(() => {
      window.__mktoTestForm!._trigger({
        Email: "jane@example.com",
        FirstName: "Jane",
        LastName: "Doe",
        Phone: "555-1212",
        Company: "Acme Co",
      });
    });

    // The BlockForm marketo branch should now render <ChiliPiperModal/> with
    // an iframe pointing at the configured CP URL plus mapped query params.
    const iframe = page.locator("iframe[src*='chilipiper.com']").first();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    const src = await iframe.getAttribute("src");
    expect(src, "iframe should have a src").toBeTruthy();

    const u = new URL(src!);
    // Existing query params on the configured URL must be preserved.
    expect(u.searchParams.get("existing")).toBe("1");
    // Mapped Marketo → CP keys (per DEFAULT_FIELD_MAP).
    expect(u.searchParams.get("email")).toBe("jane@example.com");
    expect(u.searchParams.get("firstName")).toBe("Jane");
    expect(u.searchParams.get("lastName")).toBe("Doe");
    expect(u.searchParams.get("phone")).toBe("555-1212");
    expect(u.searchParams.get("company")).toBe("Acme Co");

    // Final guard for the underlying bug: every /api/lp/track POST that
    // fired during this flow must have come back 2xx. Before the fix the
    // form_submit POST returned 500 (FK violation on a phantom test_id=0)
    // and the catch block in BlockForm swallowed it, dropping the
    // conversion from analytics. At least one track call must have fired
    // (the form_submit) so an empty list is also a failure.
    //
    // The track POST is fire-and-forget from BlockForm.onSubmit and races
    // with the React state update that mounts ChiliPiperModal. The iframe
    // can become visible *before* the track response lands, which made this
    // assertion flaky. Wait explicitly for at least one track response
    // before reading trackStatuses.
    if (trackStatuses.length === 0) {
      await page
        .waitForResponse(
          (r) => r.request().method() === "POST" && r.url().includes("/api/lp/track"),
          { timeout: 5_000 },
        )
        .catch(() => undefined);
    }
    expect(
      trackStatuses.length,
      "expected at least one /api/lp/track POST during the flow",
    ).toBeGreaterThan(0);
    const failedStatuses = trackStatuses.filter((s) => s >= 400);
    expect(
      failedStatuses,
      `expected every /api/lp/track POST to return 2xx, got ${JSON.stringify(trackStatuses)}`,
    ).toHaveLength(0);
  });

  test("a Chili Piper booking-confirmed postMessage records a chilipiper_booking conversion attributed to the same session/variant as the form_submit", async ({ page, baseURL, request }) => {
    // Mirrors the structure of the previous test, but stops at the iframe
    // mount and then drives the postMessage flow that proves the second
    // conversion event lands. Kept as a separate test so a regression on
    // either half (handoff URL build vs. booking-confirmed listener) can be
    // diagnosed in isolation.
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();

    // Capture every POST to /api/lp/track up-front. We assert on the bodies
    // rather than on individual request.waitForResponse calls so the test
    // works even if the conversion fires before we've started awaiting.
    const trackCalls: Array<{
      sessionId: unknown;
      testId: unknown;
      variantId: unknown;
      conversionType: unknown;
    }> = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/lp/track")) return;
      const raw = req.postData();
      if (!raw) return;
      try {
        const body = JSON.parse(raw) as Record<string, unknown>;
        trackCalls.push({
          sessionId: body.sessionId,
          testId: body.testId,
          variantId: body.variantId,
          conversionType: body.conversionType,
        });
      } catch {
        /* non-JSON track call — ignore */
      }
    });

    // Capture every track POST status so we can assert at the end that
    // none of the conversion events were silently rejected by the API.
    // See test 1 for the full bug history.
    const trackStatuses: number[] = [];
    page.on("response", (resp) => {
      const req = resp.request();
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/lp/track")) return;
      trackStatuses.push(resp.status());
    });

    await page.addInitScript(MKTO_INIT_SCRIPT);

    const viewerUrl = `/lp/${pageSlug}`;
    const response = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    await page.waitForResponse(
      (r) => r.url().includes(`/api/lp/forms/${formId}`) && r.ok(),
      { timeout: 30_000 },
    );
    await page.waitForFunction(
      () => Boolean((window as Window).__mktoTestForm),
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(100);

    await page.evaluate(() => {
      window.__mktoTestForm!._trigger({
        Email: "booker@example.com",
        FirstName: "Book",
        LastName: "Er",
        Phone: "555-9090",
        Company: "Acme Co",
      });
    });

    // Iframe must be mounted before we fire the postMessage — the listener
    // is attached by the BlockForm's useChiliPiperBookingTracking hook only
    // after chiliPiperHandoffUrl flips to a non-empty value, which happens
    // in the same render that mounts the iframe. Waiting on visibility
    // ensures both have settled.
    const iframe = page.locator("iframe[src*='chilipiper.com']").first();
    await expect(iframe).toBeVisible({ timeout: 10_000 });

    // The form_submit conversion is fired synchronously in the Marketo
    // onSuccess closure, so by the time the iframe is on screen it must
    // already have hit the network.
    await expect.poll(
      () => trackCalls.find((c) => c.conversionType === "form_submit"),
      { timeout: 10_000, message: "expected a form_submit conversion to be recorded" },
    ).toBeTruthy();
    const formSubmit = trackCalls.find((c) => c.conversionType === "form_submit")!;

    // Fake what Chili Piper's iframe would post once the visitor picks a
    // slot. Dispatched on the parent window (same origin) since the listener
    // is attached to `window` and doesn't filter on `event.source`.
    await page.evaluate(() => {
      window.postMessage(
        {
          action: "booking-confirmed",
          lead: {
            email: "booker@example.com",
            firstName: "Book",
            lastName: "Er",
            phone: "555-9090",
          },
        },
        "*",
      );
    });

    // The booking-conversion POST is async (the listener awaits the lead
    // upsert before firing it), so poll until it shows up.
    await expect.poll(
      () => trackCalls.find((c) => c.conversionType === "chilipiper_booking"),
      { timeout: 10_000, message: "expected a chilipiper_booking conversion to be recorded" },
    ).toBeTruthy();
    const booking = trackCalls.find((c) => c.conversionType === "chilipiper_booking")!;

    // Attribution must match the original form_submit event — same visitor
    // session, same A/B variant, same testId — otherwise the funnel reports
    // would attribute the booking to a different visitor.
    expect(booking.sessionId, "booking conversion sessionId must match form_submit").toBe(formSubmit.sessionId);
    expect(booking.variantId, "booking conversion variantId must match form_submit").toBe(formSubmit.variantId);
    expect(booking.testId, "booking conversion testId must match form_submit").toBe(formSubmit.testId);

    // Defensive: only one booking conversion should fire per submission.
    // The hook guards with a submittedRef, so a second postMessage should
    // be a no-op. If this ever regresses we'll over-count bookings.
    await page.evaluate(() => {
      window.postMessage({ action: "booking-confirmed", lead: { email: "booker@example.com" } }, "*");
    });
    await page.waitForTimeout(300);
    const bookingCount = trackCalls.filter((c) => c.conversionType === "chilipiper_booking").length;
    expect(bookingCount, "duplicate postMessage must not double-fire the booking conversion").toBe(1);

    // Same status guard as test 1: every track POST during this flow must
    // have come back 2xx. Both the form_submit and the chilipiper_booking
    // events fired through the API, so a silent 5xx here would mean the
    // funnel reports lose conversions in production.
    expect(
      trackStatuses.length,
      "expected at least one /api/lp/track POST during the booking flow",
    ).toBeGreaterThan(0);
    const failedStatuses = trackStatuses.filter((s) => s >= 400);
    expect(
      failedStatuses,
      `expected every /api/lp/track POST to return 2xx, got ${JSON.stringify(trackStatuses)}`,
    ).toHaveLength(0);
  });
});
