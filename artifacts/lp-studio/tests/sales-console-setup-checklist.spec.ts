// Sales Console setup-checklist contract (task #333).
//
// The Setup status card on Brand Settings → Sales Console is the source
// of truth tenants rely on to know whether outbound sending is configured.
// It composes two signals:
//   1. A live, local checklist computed from the in-memory draft config.
//   2. A "Saved status on the server" summary fetched once from
//      GET /api/sales/brand-context (summarizeSalesBrandSetup).
// If either drifts from what's actually persisted on
// lp_brand_settings.config.salesConsole, tenants could believe sending is
// configured when it isn't — or vice versa.
//
// This spec exercises a fresh tenant end-to-end:
//   • Empty checklist on a tenant with no salesConsole config (0/5 done,
//     no green checkmarks, server-summary line lists every missing field).
//   • Fill in sender identity (name / local part / domain / reply-to) and
//     a value-prop pair, click Save Changes in the Sales Console tab.
//   • Reload the page so both the local config (from PUT /api/lp/brand
//     round-trip) AND the server summary (from /api/sales/brand-context)
//     come from persisted state — assert every checklist row flips green
//     and the saved-status line reports "all essentials saved".
//
// Second test: the QuickCampaignWizard's "not fully configured" warning
// links to `/brand#sales-console-setup`. Lock that link target down
// (changing it silently would strand tenants on the Brand Settings tab
// instead of the Sales Console one), and prove the URL actually lands the
// user on the Sales Console tab with the Setup status card visible.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { test, expect, type BrowserContext } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { assertApiHealthy } from "./setup/api-health";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture " +
        "can create a Royal-style tenant in the dev DB.",
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

test.describe("Sales Console setup checklist (task #333)", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async () => {
    await assertApiHealthy();
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
    // The Royal fixture seeds NEUTRAL_BRAND_CONFIG which has no
    // `salesConsole` key, so the tenant starts with an empty checklist —
    // exactly the state we want to exercise.
  });

  test.afterAll(async () => {
    if (!pool) return;
    try {
      if (tenant) await cleanupRoyalTenant(pool, tenant);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  test("empty checklist on a fresh tenant flips entirely green after saving sender identity + a value-prop pair", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    const page = await ctx.newPage();
    try {
      // ── 1. Land directly on the Sales Console tab via the hash router. ──
      await page.goto("/brand#sales-console", { waitUntil: "domcontentloaded" });

      // Wait for the Setup status card to render — it sits inside the
      // sales-console TabsContent and only mounts once the brand fetch
      // resolves. We key off the card's stable id (#sales-console-setup)
      // so we don't have to scrape transient loading states.
      const setupCard = page.locator("#sales-console-setup");
      await expect(setupCard).toBeVisible({ timeout: 30_000 });
      await expect(setupCard.getByText("Setup status", { exact: true })).toBeVisible();

      // ── 2. Initial state: 0/5 done, no green "Done" labels, every row
      //      shows a "Set it →" jump link. The server summary line should
      //      list every missing field (sender name, sender local part,
      //      sending domain, reply-to, value-prop pairs). ──
      await expect(setupCard.getByText("0 / 5", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(setupCard.getByText("Done", { exact: true })).toHaveCount(0);
      await expect(setupCard.getByRole("button", { name: /Set it/ })).toHaveCount(5);

      // The server-summary line is the second source of truth (it comes
      // straight from summarizeSalesBrandSetup on the server). On an empty
      // tenant it should enumerate all five missing items, NOT report
      // "all essentials saved".
      const savedLine = setupCard.locator("text=/Saved status on the server:/");
      await expect(savedLine).toBeVisible({ timeout: 15_000 });
      await expect(savedLine).toContainText("sender name");
      await expect(savedLine).toContainText("sender local part");
      await expect(savedLine).toContainText("sending domain");
      await expect(savedLine).toContainText("reply-to");
      await expect(savedLine).toContainText("value-prop pairs");
      await expect(savedLine).not.toContainText("all essentials saved");

      // ── 3. Fill in sender identity + add a value-prop pair. ─────────────
      // The sender-identity card uses <Label> + <Input> pairs without
      // explicit htmlFor/id wiring, so we target by the label text and
      // then walk to the sibling Input — this mirrors how a screen-reader
      // user would navigate the form.
      const senderCard = page.locator("#sales-console-sender-identity");
      await senderCard.scrollIntoViewIfNeeded();

      const fillByLabel = async (label: string, value: string) => {
        // The <Label> renders as a plain <label> with no `for=`; the
        // input is its next-sibling <input>. Grab the input directly via
        // the label's parent container.
        const field = senderCard
          .locator("div.space-y-1\\.5", { has: page.getByText(label, { exact: true }) })
          .first()
          .locator("input");
        await expect(field).toBeVisible();
        await field.fill(value);
      };
      await fillByLabel("Sender display name", "Royal Test Brand");
      await fillByLabel("Sender local part", "hello");
      await fillByLabel("Sending domain", "send.royal-test.example");
      await fillByLabel("Reply-to address", "replies@royal-test.example");

      // Value-prop pair: click "Add pair", fill the theme (which is the
      // field that summarizeSalesBrandSetup actually counts — pairs with
      // empty themes are filtered out server-side).
      const valuePropCard = page.locator("#sales-console-value-prop-pairs");
      await valuePropCard.scrollIntoViewIfNeeded();
      await valuePropCard.getByRole("button", { name: /Add pair/ }).click();
      const themeInput = valuePropCard
        .locator("div.space-y-1\\.5", { has: page.getByText("Theme", { exact: true }) })
        .first()
        .locator("input");
      await expect(themeInput).toBeVisible();
      await themeInput.fill("Margin protection for finance leaders");

      // ── 4. Live (local) checklist should already reflect the edits even
      //      before we hit Save — it computes off the draft config. ──
      await expect(setupCard.getByText("5 / 5", { exact: true })).toBeVisible({ timeout: 10_000 });

      // ── 5. Save. The Sales Console tab's sticky save bar has its own
      //      "Save Changes" button bound to handleSave(). ──
      // There are multiple "Save Changes" buttons across tabs but only the
      // sales-console TabsContent is mounted on this tab, so the click
      // resolves uniquely. Wait for the PUT /api/lp/brand round-trip
      // before reloading so the persisted config is what comes back.
      const savePromise = page.waitForResponse(
        r => /\/api\/lp\/brand(\?|$)/.test(r.url()) && r.request().method() === "PUT" && r.ok(),
        { timeout: 20_000 },
      );
      await page.getByRole("button", { name: /Save Changes/ }).click();
      await savePromise;

      // ── 6. Reload so the local config AND the server summary both come
      //      from persisted state, not from the in-memory draft. This is
      //      the assertion that actually proves "the checklist reflects
      //      what's saved". ──
      await page.goto("/brand#sales-console", { waitUntil: "domcontentloaded" });
      await expect(setupCard).toBeVisible({ timeout: 30_000 });

      // All five rows must now show green "Done" labels (no "Set it →"
      // jump links remain) and the counter must read 5 / 5.
      await expect(setupCard.getByText("5 / 5", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(setupCard.getByText("Done", { exact: true })).toHaveCount(5);
      await expect(setupCard.getByRole("button", { name: /Set it/ })).toHaveCount(0);

      // The amber "Sends are blocked until …" banner must be gone.
      await expect(
        setupCard.getByText(/Sends are blocked until/),
      ).toHaveCount(0);

      // Server-summary line must now report "all essentials saved" — that
      // string is only rendered when every checklist field on the server
      // side is present (summarizeSalesBrandSetup → no missing items).
      const savedLineAfter = setupCard.locator("text=/Saved status on the server:/");
      await expect(savedLineAfter).toContainText("all essentials saved", { timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });

  test("QuickCampaignWizard warning links to /brand#sales-console-setup and the URL lands on the Sales Console tab", async ({ browser, baseURL }) => {
    expect(baseURL).toBeTruthy();

    // ── 1. Lock down the link target in the wizard source. If a refactor
    //      changes the href, this assertion fails loudly instead of
    //      silently sending tenants to the wrong tab. ──
    const wizardPath = resolve(
      __dirname,
      "../src/components/QuickCampaignWizard.tsx",
    );
    const wizardSrc = readFileSync(wizardPath, "utf8");
    expect(
      wizardSrc,
      "QuickCampaignWizard must link its 'not fully configured' warning to /brand#sales-console-setup so the tenant lands directly on the Sales Console tab with the Setup status card scrolled into view",
    ).toContain('href="/brand#sales-console-setup"');

    // ── 2. Following that link must put the user on the Sales Console
    //      tab with the Setup status card mounted. The tab/hash sync logic
    //      lives in BrandSettings: hashes starting with "sales-console"
    //      select the "sales-console" tab on first mount. ──
    const ctx = await browser.newContext();
    await setSessionCookie(ctx, tenant.sessionSid, baseURL!);
    const page = await ctx.newPage();
    try {
      await page.goto("/brand#sales-console-setup", { waitUntil: "domcontentloaded" });

      // The Sales Console tab trigger should be the selected one. Radix
      // surfaces selection via aria-selected on the role=tab element.
      const tabTrigger = page.getByRole("tab", { name: "Sales Console", exact: true });
      await expect(tabTrigger).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });

      // The Setup status card itself must be mounted and visible — that's
      // the deep-link target the wizard sends users to.
      const setupCard = page.locator("#sales-console-setup");
      await expect(setupCard).toBeVisible({ timeout: 30_000 });
      await expect(setupCard.getByText("Setup status", { exact: true })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
