// Modal layout regression guard.
//
// A previous fix corrected the shared Dialog component
// (src/components/ui/dialog.tsx) so the "Create New Page" modal could no
// longer be clipped off the left edge or overflow the screen — a wide child
// (e.g. a <select> sized to its longest option, or long mono URLs) used to
// blow the centred dialog past its max-width and push its content off-screen.
// There was no automated test guarding that behaviour, so a future change to
// the Dialog primitive (or a new wide child inside a modal) could silently
// reintroduce it.
//
// This spec stands up a real generic-industry tenant (the same Royal-style
// fixture the no-Dandy-leak spec uses), logs in via a session cookie, opens
// the authenticated /pages gallery, and opens the larger modals reachable
// there — the "Create New Page" modal (Template + AI tabs, which contain the
// wide <select>s and the scrolling template grid) and the "Brief" modal. For
// each it asserts the geometric invariants the dialog fix established:
//
//   1. no horizontal clipping/overflow — scrollWidth never exceeds clientWidth
//   2. the left edge stays within the viewport (not pushed off-screen)
//   3. the right edge stays within the viewport
//   4. the height is capped to the viewport (max-height honoured)
//
// The checks run at a normal desktop width AND a narrow width, because the
// original "cut off on the left" symptom only appeared once the dialog's
// intrinsic content width exceeded the available viewport — exactly what a
// narrow viewport reproduces.

import pg from "pg";
import { test, expect, type Page, type BrowserContext } from "./setup/pw";
import { createRoyalTenant, cleanupRoyalTenant, purgeStaleRoyalTenants, type RoyalTenant } from "./setup/royal-tenant";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the modal-layout guard can " +
        "create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

async function setSessionCookie(context: BrowserContext, sid: string, baseURL: string): Promise<void> {
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

interface DialogMetrics {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  rectLeft: number;
  rectRight: number;
  rectTop: number;
  rectBottom: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Measure the open dialog and assert the layout invariants the Dialog fix
 * established. `label` identifies which modal/tab/viewport produced a failure.
 *
 * A 1px tolerance absorbs sub-pixel rounding in the browser's layout engine
 * (scrollWidth/clientWidth and getBoundingClientRect can disagree by <1px on
 * fractional-scale layouts) without letting a real multi-pixel clip slip by.
 */
async function assertDialogLayout(page: Page, label: string): Promise<void> {
  const dialog = page.getByRole("dialog");
  await expect(dialog, `${label}: dialog should be visible`).toBeVisible({ timeout: 30_000 });

  // The dialog plays an entrance animation (zoom-in + slide-from-top, ~200ms).
  // Measuring mid-animation reports a scaled/offset bounding box (a false
  // "off-screen" or "clipped" reading), so wait for every running animation on
  // the dialog and its subtree to finish before sampling the resting geometry.
  await dialog.evaluate(async (el) => {
    const anims = (el as HTMLElement).getAnimations({ subtree: true });
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
  });

  const metrics = await dialog.evaluate((el): DialogMetrics => {
    const rect = el.getBoundingClientRect();
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      rectLeft: rect.left,
      rectRight: rect.right,
      rectTop: rect.top,
      rectBottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  const TOL = 1;

  // 1. No horizontal clipping/overflow: content never wider than the box.
  expect(
    metrics.scrollWidth,
    `${label}: dialog scrollWidth (${metrics.scrollWidth}) exceeds clientWidth ` +
      `(${metrics.clientWidth}) — content is clipped/overflowing horizontally`,
  ).toBeLessThanOrEqual(metrics.clientWidth + TOL);

  // 2. Left edge within the viewport (the original "cut off on the left" bug).
  expect(
    metrics.rectLeft,
    `${label}: dialog left edge (${metrics.rectLeft}px) is off-screen (< 0)`,
  ).toBeGreaterThanOrEqual(-TOL);

  // 3. Right edge within the viewport.
  expect(
    metrics.rectRight,
    `${label}: dialog right edge (${metrics.rectRight}px) is past the viewport ` +
      `(${metrics.viewportWidth}px)`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + TOL);

  // 4. Height capped to the viewport (max-height honoured; tall modals scroll
  //    internally rather than overflowing the screen).
  expect(
    metrics.rectBottom - metrics.rectTop,
    `${label}: dialog height (${Math.round(metrics.rectBottom - metrics.rectTop)}px) ` +
      `exceeds the viewport height (${metrics.viewportHeight}px) — it should be capped`,
  ).toBeLessThanOrEqual(metrics.viewportHeight + TOL);

  // The top edge must also stay on-screen so a viewport-capped dialog can't be
  // pushed partly above the fold.
  expect(
    metrics.rectTop,
    `${label}: dialog top edge (${metrics.rectTop}px) is off-screen (< 0)`,
  ).toBeGreaterThanOrEqual(-TOL);
}

const DESKTOP = { width: 1280, height: 720 } as const;
// A narrow desktop width — wide enough to keep the SaaS shell out of its
// mobile layout, narrow enough to squeeze the dialog so any intrinsic
// content-width overflow surfaces as a clip.
const NARROW = { width: 420, height: 720 } as const;

test.describe("Modal layout guard — gallery modals never clip or overflow", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
    // The api-server caches tenants by host for 60s; invalidate so the freshly
    // inserted tenants.domain="localhost" row resolves for this session.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    if (tenant && pool) {
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) {
      await pool.end();
    }
  });

  test("the Create New Page modal (Template + AI tabs) and Brief modal stay within the viewport", async ({
    page,
    context,
    baseURL,
  }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    for (const viewport of [DESKTOP, NARROW]) {
      await page.setViewportSize(viewport);
      const vp = `${viewport.width}x${viewport.height}`;

      await page.goto("/pages", { waitUntil: "domcontentloaded" });

      // ── Create New Page modal — opens on the Template tab by default.
      await page.getByRole("button", { name: "New Page" }).click();
      await expect(
        page.getByRole("heading", { name: "Create New Page" }),
      ).toBeVisible({ timeout: 30_000 });
      await assertDialogLayout(page, `Create New Page / Template tab @ ${vp}`);

      // ── AI Generate tab — carries the wide "Starting Point" <select> and
      //    the prompt textarea, the controls most likely to force overflow.
      await page.getByRole("button", { name: "AI Generate" }).click();
      await expect(page.getByText("Describe your landing page")).toBeVisible();
      await assertDialogLayout(page, `Create New Page / AI tab @ ${vp}`);

      // Close the create modal before opening the Brief modal so only one
      // dialog is mounted at a time (getByRole("dialog") stays unambiguous).
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });

      // ── Brief modal — the other large gallery modal.
      await page.getByRole("button", { name: "Brief" }).click();
      await assertDialogLayout(page, `Brief modal @ ${vp}`);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
    }
  });
});
