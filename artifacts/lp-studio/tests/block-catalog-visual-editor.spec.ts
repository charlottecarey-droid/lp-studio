// E2E coverage for the visual block-default editor (feature #1026).
//
// What this feature does
// ──────────────────────
// The SuperAdmin "Block Catalog" tab lets a superadmin edit a global block
// default *visually* in the existing page builder instead of hand-editing JSON.
// The user-facing flow this spec drives end-to-end is:
//
//   1. superadmin opens /superadmin#catalog
//   2. filters to an industry + searches a block, then clicks the row's
//      "Edit visually" (Eye) action — this POSTs
//      /api/admin/block-catalog/scratch-page, which seeds a single-block
//      scratch page on the reserved system tenant whose page_variables.__catalog*
//      flags put the builder into "catalog mode", then navigates to /builder/:id
//   3. the builder auto-selects the block and renders only its property panel
//      (no left palette / insertion bars in catalog mode)
//   4. the superadmin edits a prop and clicks "Save default", which PUTs
//      /api/admin/block-catalog/default-props and upserts
//      block_catalog.default_props for (block_type, industry)
//
// We use the `spacer` block because its property panel exposes deterministic
// preset buttons ("192px") that set `height` in one click — far more robust to
// drive than a range slider or a Tiptap rich-text surface. `spacer` is a code
// (BLOCK_REGISTRY) default for every industry, so before this test runs there
// is NO block_catalog row for (spacer, <industry>); the Save creates one, which
// is exactly what we assert. afterAll deletes those rows, reverting the catalog
// to its built-in default (the original state) so the global catalog is never
// permanently mutated.
//
// Both industries (dental + generic) are covered, plus the superadmin gate
// (a normal tenant admin is rejected by requireSuperadmin on both the
// scratch-page and default-props endpoints).
//
// Verification only — no production code is changed by this spec.

import { test, expect, type BrowserContext, type Page } from "./setup/pw";
import pg from "pg";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL is required for block-catalog-visual-editor.spec.ts",
  );
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

// The block we drive through the visual editor. `spacer` is a Layout block that
// ships as a code default for every industry — no DB override exists for it
// until this test's Save creates one.
const BLOCK_TYPE = "spacer";
// SpacerPanel preset that maps to a single click; the registry default is 64.
const TARGET_HEIGHT = 192;
// A synthetic block type used ONLY by the superadmin-gate test. The two
// visual-edit tests legitimately create block_catalog overrides for
// (spacer, <industry>), so the gate test can't assert "no spacer row exists"
// without coupling to their execution order. Using a throwaway type the
// visual-edit tests never touch keeps the gate's "no row was written" check
// deterministic — requireSuperadmin 403s before the handler runs, so this row
// can never be created.
const GATE_PROBE_TYPE = "__e2e_gate_probe";

const INDUSTRY_FILTER_LABEL: Record<"generic" | "dental", string> = {
  generic: "Generic B2B SaaS",
  dental: "Dental",
};

let superadmin: RoyalTenant;
let plainAdmin: RoyalTenant;

test.beforeAll(async ({ request }) => {
  await purgeStaleRoyalTenants(pool);

  // A superadmin session: createRoyalTenant writes appUserRole into BOTH the
  // session payload AND app_users.role, which is what requireSuperadmin /
  // isAppSuperadmin re-read from the DB on every call.
  superadmin = await createRoyalTenant(pool, { appUserRole: "superadmin" });
  // A normal tenant admin (default appUserRole "admin") for the gate check.
  plainAdmin = await createRoyalTenant(pool, { appUserRole: "admin" });

  // Make sure no stale DB override for `spacer` is lying around from a crashed
  // previous run — the assertions expect Save to *create* the row. Likewise
  // clear any stray gate-probe row (it should never exist, but be defensive).
  await pool
    .query(`DELETE FROM block_catalog WHERE block_type = ANY($1::text[]) AND industry IN ('generic','dental')`, [
      [BLOCK_TYPE, GATE_PROBE_TYPE],
    ])
    .catch(() => undefined);

  // Drop the in-process tenant-by-host cache so the freshly inserted tenants
  // resolve for host="localhost" (mirrors grid-pieces-palette-ui.spec.ts).
  await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

  // Warm the scratch-page path BEFORE the UI flow. The first POST runs
  // ensureSystemTenant() + the first write to a possibly-sleeping Neon dev
  // branch, which on a cold boot can take long enough that the UI test's
  // "navigate to /builder" wait times out. Pre-creating the (deterministic-slug)
  // scratch pages here makes the in-test open a fast ON CONFLICT upsert. It
  // only touches lp_pages on the system tenant (cleaned up in afterAll) — no
  // block_catalog row is created, so the Save assertions still see Save *create*
  // the override.
  const warmHeaders = {
    "Content-Type": "application/json",
    ...(await csrfHeaders(request, superadmin.sessionSid)),
  };
  for (const industry of ["generic", "dental"] as const) {
    await request
      .post("/api/admin/block-catalog/scratch-page", {
        headers: warmHeaders,
        data: { block_type: BLOCK_TYPE, industry, label: "Spacer", category: "Layout", props: {} },
      })
      .catch(() => undefined);
  }
});

test.afterAll(async () => {
  // Remove the DB overrides this spec created so the catalog reverts to its
  // built-in `spacer` default (the pre-test state). Also drop the scratch
  // pages seeded on the system tenant for each (industry) open.
  await pool
    .query(`DELETE FROM block_catalog WHERE block_type = ANY($1::text[]) AND industry IN ('generic','dental')`, [
      [BLOCK_TYPE, GATE_PROBE_TYPE],
    ])
    .catch(() => undefined);
  await pool
    .query(
      `DELETE FROM lp_pages WHERE slug IN ($1, $2)`,
      [`__catalog-generic-${BLOCK_TYPE}`, `__catalog-dental-${BLOCK_TYPE}`],
    )
    .catch(() => undefined);
  if (superadmin) await cleanupRoyalTenant(pool, superadmin);
  if (plainAdmin) await cleanupRoyalTenant(pool, plainAdmin);
  await pool.end();
});

async function setSessionCookie(
  context: BrowserContext,
  sid: string,
  baseURL: string,
): Promise<void> {
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "lp_sid",
      value: sid,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ]);
}

/**
 * Drive the full superadmin → catalog → "Edit visually" → builder → Save flow
 * for one industry and assert the persisted block_catalog.default_props.
 */
async function runVisualEditFlow(page: Page, industry: "generic" | "dental"): Promise<void> {
  // 1. Open the Block Catalog tab. SuperAdminPage initializes its tab from the
  //    URL hash, and the route renders outside AuthGate, so #catalog lands us
  //    directly on the catalog table.
  await page.goto("/superadmin#catalog", { waitUntil: "domcontentloaded" });

  // The catalog search input is the reliable "table mounted + data loaded"
  // signal (the table fetch is /api/admin/block-catalog, superadmin-gated).
  // 60s (not 30s): the very first test pays the on-demand Vite compile of the
  // /superadmin route chunk on cold boot, which alone can approach 30s.
  const search = page.getByPlaceholder("Search block type, label, category…");
  await expect(search).toBeVisible({ timeout: 60_000 });

  // 2. Narrow to a single row: industry filter button + search the block type.
  await page.getByRole("button", { name: INDUSTRY_FILTER_LABEL[industry], exact: true }).click();
  await search.fill(BLOCK_TYPE);

  // Exactly one row should remain — its block_type cell reads "spacer".
  const row = page.getByRole("row").filter({
    has: page.getByText(BLOCK_TYPE, { exact: true }),
  });
  await expect(row).toHaveCount(1, { timeout: 10_000 });

  // 3. Click "Edit visually" (the Eye button). This POSTs scratch-page and,
  //    on success, navigates to /builder/:id. Wait for the POST response
  //    explicitly so a slow scratch-page call doesn't race the URL assertion.
  const [scratchResp] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/block-catalog/scratch-page") &&
        r.request().method() === "POST",
      { timeout: 30_000 },
    ),
    row.getByTitle("Edit visually in the page builder").click(),
  ]);
  expect(scratchResp.status()).toBe(200);

  // 4. Builder catalog mode: the page-status-badge is hidden (gated on
  //    !catalogMode), so we wait on the auto-selected block's property panel —
  //    the SpacerPanel preset buttons — as the "builder ready" signal.
  await expect(page).toHaveURL(/\/builder\/\d+/, { timeout: 30_000 });
  const preset = page.getByRole("button", { name: `${TARGET_HEIGHT}px`, exact: true });
  await expect(preset).toBeVisible({ timeout: 30_000 });

  // 5. Edit the prop (sets height -> 192, marks the page dirty) and Save.
  await preset.click();
  const saveButton = page.getByTestId("save-button");
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  // The PUT goes to /api/admin/block-catalog/default-props; wait for the
  // response so the DB assertion below doesn't race the write.
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/api/admin/block-catalog/default-props") &&
        r.request().method() === "PUT",
      { timeout: 30_000 },
    ),
    saveButton.click(),
  ]);
  expect(resp.status()).toBe(200);

  // 6. Assert the override persisted for (spacer, <industry>).
  const { rows } = await pool.query<{ default_props: Record<string, unknown> }>(
    `SELECT default_props FROM block_catalog WHERE block_type = $1 AND industry = $2`,
    [BLOCK_TYPE, industry],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].default_props).toMatchObject({ height: TARGET_HEIGHT });
}

test.describe("Visual block-default editor (feature #1026)", () => {
  for (const industry of ["generic", "dental"] as const) {
    test(`superadmin edits ${BLOCK_TYPE} default visually and it persists — ${industry}`, async ({
      browser,
      baseURL,
    }) => {
      expect(baseURL).toBeTruthy();
      const ctx = await browser.newContext();
      await setSessionCookie(ctx, superadmin.sessionSid, baseURL!);
      const page = await ctx.newPage();
      try {
        await runVisualEditFlow(page, industry);
      } finally {
        await ctx.close();
      }
    });
  }

  test("superadmin gate: a normal tenant admin is rejected by both catalog endpoints", async ({
    request,
  }) => {
    // requireSuperadmin re-reads app_users.role on every call, so a tenant
    // admin (appUserRole "admin") is rejected with 403 even though the session
    // is otherwise valid. Both write endpoints behind the visual editor are
    // covered.
    const headers = {
      "Content-Type": "application/json",
      ...(await csrfHeaders(request, plainAdmin.sessionSid)),
    };

    // Use a throwaway probe block_type so the "no row was written" assertion
    // below is independent of the two visual-edit tests (which legitimately
    // create the spacer override rows).
    const scratch = await request.post("/api/admin/block-catalog/scratch-page", {
      headers,
      data: { block_type: GATE_PROBE_TYPE, industry: "generic" },
    });
    expect(scratch.status()).toBe(403);

    const save = await request.put("/api/admin/block-catalog/default-props", {
      headers,
      data: {
        block_type: GATE_PROBE_TYPE,
        industry: "generic",
        default_props: { height: TARGET_HEIGHT },
      },
    });
    expect(save.status()).toBe(403);

    // And the gate genuinely blocked the write — no override row was created
    // for the probe type (requireSuperadmin 403s before the handler runs).
    const { rows } = await pool.query(
      `SELECT 1 FROM block_catalog WHERE block_type = $1 AND industry = 'generic'`,
      [GATE_PROBE_TYPE],
    );
    expect(rows).toHaveLength(0);
  });
});
