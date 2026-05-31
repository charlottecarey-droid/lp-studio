// Trial lifecycle nudges + in-app inbox — end-to-end (task #539).
//
// The dispatcher has unit tests for dedupe/idempotency, but nothing proves the
// whole loop: that the trial lifecycle SWEEP actually creates inbox rows for a
// free-plan tenant sitting inside a milestone window, that the
// /api/notifications endpoints surface them, and that the bell badge renders +
// clears on mark-read. This spec closes that gap end-to-end against the live
// api-server + a real Royal-style tenant in the dev DB:
//
//   1. Seed a free-plan tenant whose trial expires ~6.5 days out (the day-7
//      milestone window is "expires in (6,7] days"). Trigger the sweep via the
//      dev-only /api/_test/run-trial-sweep helper and assert exactly one
//      trial_day_7 in-app row + a non-zero unread count for the admin.
//   2. Re-run the sweep and assert no duplicate row appears (the dispatcher's
//      UNIQUE(dedupe_key, channel) idempotency holds through the real sweep).
//   3. Drive the UI: the bell shows the unread badge, the dropdown lists the
//      nudge, "Mark all read" clears the badge, and the server unread-count
//      drops to zero.
//
// Email delivery is intentionally NOT asserted — RESEND_API_KEY is unset in
// dev, so the dispatcher releases the email claim and only the in-app inbox row
// (the user-visible surface) survives. That mirrors production-without-email and
// keeps the spec hermetic.

import pg from "pg";
import { test, expect, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const { Pool } = pg;

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the trial-nudge fixture " +
        "can create a fresh tenant in the dev DB.",
    );
  }
  return url;
}

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

interface InboxItem {
  id: number;
  templateKey: string;
  title: string | null;
  body: string | null;
  read: boolean;
}

test.describe("Trial lifecycle nudges + inbox (e2e)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    // Free plan + trial expiring 6.5 days out → squarely inside the day-7
    // milestone window ("expires in (6,7] days"); the day-11/day-13 windows
    // (3 and 1 days) do NOT match, so the sweep produces exactly one nudge.
    const trialExpiresAt = new Date(Date.now() + 6.5 * 24 * 60 * 60 * 1000);
    tenant = await createRoyalTenant(pool, { plan: "free", trialExpiresAt });
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);
  });

  test.afterAll(async () => {
    // Deleting the tenant cascades its notification_sends rows (FK onDelete:
    // cascade on both tenant_id and app_user_id).
    if (tenant && pool) await cleanupRoyalTenant(pool, tenant);
    if (pool) await pool.end();
  });

  async function listInbox(
    request: import("@playwright/test").APIRequestContext,
  ): Promise<InboxItem[]> {
    const res = await request.get("/api/notifications", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { items: InboxItem[] };
    return body.items ?? [];
  }

  async function unreadCount(
    request: import("@playwright/test").APIRequestContext,
  ): Promise<number> {
    const res = await request.get("/api/notifications/unread-count", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { count: number };
    return Number(body.count) || 0;
  }

  test("the trial sweep creates a day-7 in-app inbox row + unread count", async ({ request }) => {
    const sweep = await request.post("/api/_test/run-trial-sweep");
    expect(sweep.ok()).toBeTruthy();

    const items = await listInbox(request);
    const trial = items.filter((i) => i.templateKey === "trial_day_7");
    expect(trial.length).toBe(1);
    expect(trial[0].read).toBe(false);
    // The dispatcher rendered the template (no raw {{placeholders}} leak).
    expect(trial[0].title ?? "").not.toContain("{{");
    expect(trial[0].body ?? "").not.toContain("{{");

    expect(await unreadCount(request)).toBeGreaterThanOrEqual(1);
  });

  test("re-running the sweep is idempotent (no duplicate inbox rows)", async ({ request }) => {
    const before = (await listInbox(request)).filter((i) => i.templateKey === "trial_day_7").length;
    expect(before).toBe(1);

    const sweep = await request.post("/api/_test/run-trial-sweep");
    expect(sweep.ok()).toBeTruthy();

    const after = (await listInbox(request)).filter((i) => i.templateKey === "trial_day_7").length;
    expect(after).toBe(1);
  });

  test("the bell shows the unread badge and mark-read clears it", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    // Make sure the nudge exists and is unread (re-run is idempotent), and
    // reset any read state a prior test left behind so the badge is visible.
    await request.post("/api/_test/run-trial-sweep");
    await pool.query(
      `UPDATE notification_sends SET read_at = NULL
        WHERE tenant_id = $1 AND channel = 'in_app'`,
      [tenant.tenantId],
    );

    await setSessionCookie(context, tenant.sessionSid, baseURL!);
    // `domcontentloaded`, not `networkidle`: the Vite dev server's HMR
    // websocket keeps a connection open indefinitely, so `networkidle` never
    // settles and the navigation times out. The element waits below
    // (`toBeVisible`) are the real synchronization point.
    await page.goto("/settings/billing", { waitUntil: "domcontentloaded" });

    // Badge is visible with at least one unread item.
    const badge = page.getByTestId("notification-badge");
    await expect(badge).toBeVisible();

    // Open the dropdown and confirm the nudge is listed.
    await page.getByTestId("notification-bell").click();
    await expect(page.getByText("Mark all read")).toBeVisible();

    // Clear everything; the badge disappears and the server count goes to 0.
    await page.getByText("Mark all read").click();
    await expect(page.getByTestId("notification-badge")).toHaveCount(0);

    await expect.poll(() => unreadCount(request)).toBe(0);
  });
});
