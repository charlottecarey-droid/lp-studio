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
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

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
        Cookie: `lp_sid=${tenant.sessionSid}`,
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
  });
});
