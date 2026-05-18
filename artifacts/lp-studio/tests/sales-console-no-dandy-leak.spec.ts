// Fresh-tenant Sales Console no-leak end-to-end check (task #332).
//
// Task #318 made the Sales Console multi-tenant. This spec verifies, for a
// brand-new generic-industry tenant with no Dandy-specific config, that the
// Sales Console screens do not bleed Dandy-branded copy ("Dandy", "DSO",
// "dental lab") into the user-visible surface.
//
// What this spec asserts:
//   - For a curated set of "should-be-clean" Sales Console routes
//     (/sales, /sales/signals, /sales/microsites, /sales/campaign-pages,
//     /sales/sfdc), the rendered `<body>` text contains none of the
//     forbidden literal strings.
//   - The shell chrome (sidebar + page header) on every visited route is
//     also clean.
//
// What this spec deliberately does NOT yet assert (tracked as follow-up
// tech_debt tasks — see commit message for task IDs):
//   - /sales/campaigns       — hardcoded Dandy email banner/logo URLs, the
//                              "@ent.meetdandy.com" sender suffix
//   - /sales/campaign-pages  — "@ent.meetdandy.com" sender suffix
//   - /sales/marketplace     — depends on seeded templates; covered by
//                              the catalog-isolation work
//   (Task #342 de-Dandified /sales/one-pager and /sales/roi-calculator —
//    they are now part of ROUTES below.)
//
// Once those screens are de-branded they should be added to ROUTES below.
//
// Task #341 added /sales/accounts, /sales/contacts and /sales/guide to ROUTES
// after the Dandy/DSO copy in those screens was removed.

import pg from "pg";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";

const { Pool } = pg;

interface ForbiddenPattern {
  label: string;
  // Matches against the visible body text of each Sales Console route.
  pattern: RegExp;
}

// Word-boundary literals so partial words ("dso-corporate" embedded in a CSS
// class) don't trigger. We're checking *visible copy* a tenant's user would
// read, not internal identifiers.
const FORBIDDEN_PATTERNS: ReadonlyArray<ForbiddenPattern> = [
  { label: '"Dandy" brand name', pattern: /\bDandy\b/i },
  { label: '"DSO" acronym', pattern: /\bDSO\b/ },
  { label: '"dental lab" phrase', pattern: /\bdental\s+lab\b/i },
  { label: "meetdandy.com domain", pattern: /meetdandy\.com/i },
];

// Sales Console routes that should render with zero Dandy-branded copy on a
// fresh generic tenant. Keep this list in sync with App.tsx routes that have
// been cleaned up; add more routes here as they're de-branded.
const ROUTES: ReadonlyArray<{ path: string; label: string }> = [
  { path: "/sales", label: "Sales dashboard" },
  { path: "/sales/signals", label: "Signals" },
  { path: "/sales/microsites", label: "Microsites" },
  { path: "/sales/sfdc", label: "Salesforce settings" },
  { path: "/sales/campaign-pages", label: "Campaign pages list" },
  { path: "/sales/accounts", label: "Accounts" },
  { path: "/sales/contacts", label: "Contacts" },
  { path: "/sales/guide", label: "Sales Console guide" },
  { path: "/sales/one-pager", label: "One-Pager Generator" },
  { path: "/sales/roi-calculator", label: "ROI Calculator" },
];

interface Violation {
  label: string;
  sample: string;
  context: string;
}

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create a fresh tenant in the dev DB.",
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

/**
 * Capture the visible text content under `<body>`, excluding script/style
 * nodes and dev-only overlays. We deliberately use innerText (not innerHTML)
 * so the assertion targets what a real user would read — internal URLs,
 * CSS class names, and data attributes are not part of the "leak" surface
 * the task is concerned with.
 */
async function captureBodyText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const body = document.body;
    if (!body) return "";
    // Strip dev overlays that aren't part of the tenant surface.
    const SKIP = body.querySelectorAll(
      "[data-replit-runtime-error-overlay], #runtime-errors-modal, script, style, noscript",
    );
    const clones: { el: Element; placeholder: Comment }[] = [];
    for (const el of Array.from(SKIP)) {
      const placeholder = document.createComment("skipped");
      el.parentNode?.replaceChild(placeholder, el);
      clones.push({ el, placeholder });
    }
    const text = (body as HTMLElement).innerText ?? "";
    // Restore so the page DOM is unchanged for any subsequent assertions.
    for (const { el, placeholder } of clones) {
      placeholder.parentNode?.replaceChild(el, placeholder);
    }
    return text;
  });
}

function scanForLeaks(label: string, surface: string): Violation[] {
  const violations: Violation[] = [];
  for (const { label: patternLabel, pattern } of FORBIDDEN_PATTERNS) {
    const re = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
    );
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(surface)) !== null) {
      const sample = m[0];
      if (seen.has(sample.toLowerCase())) continue;
      seen.add(sample.toLowerCase());
      const start = Math.max(0, m.index - 40);
      const end = Math.min(surface.length, m.index + sample.length + 40);
      const context = surface.slice(start, end).replace(/\s+/g, " ").trim();
      violations.push({
        label: `${label}: ${patternLabel}`,
        sample,
        context,
      });
      if (seen.size >= 3) break;
    }
  }
  return violations;
}

function formatViolations(violations: Violation[]): string {
  return violations
    .map(
      (v) =>
        `  • ${v.label} → ${JSON.stringify(v.sample)}\n      …${v.context}…`,
    )
    .join("\n");
}

test.describe("Sales Console fresh-tenant no-Dandy-leak", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);
    // Same host-cache invalidation dance as no-dandy-leak-tenant.spec.ts.
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

  test("Sales Console routes render no Dandy/DSO/dental-lab copy for a fresh tenant", async ({
    page,
    context,
    baseURL,
  }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    const allViolations: Violation[] = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    for (const route of ROUTES) {
      const resp = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(resp, `navigation to ${route.path} returned no response`).not.toBeNull();
      expect(
        resp!.status(),
        `unexpected status for ${route.path}`,
      ).toBeLessThan(400);

      // Give lazy-loaded chunks + initial data fetches a chance to settle so
      // the scan sees the populated page, not the loading skeleton.
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => undefined);
      // Wait for at least one heading to appear so we know the route's
      // top-level component mounted (vs. AuthGate redirecting us elsewhere).
      await page
        .waitForSelector("h1, h2", { timeout: 30_000 })
        .catch(() => undefined);

      const text = await captureBodyText(page);
      const violations = scanForLeaks(route.label, text);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      throw new Error(
        `Dandy/DSO/dental-lab leakage detected in the Sales Console for a ` +
          `fresh tenant (slug="${tenant.slug}", industry=generic):\n` +
          `${formatViolations(allViolations)}\n\n` +
          `These strings should not appear in any tenant-facing copy. Either ` +
          `make the offending UI strings tenant-configurable (brand_settings) ` +
          `or move them into a Dandy-only conditional.`,
      );
    }

    expect(
      pageErrors,
      `uncaught page errors during Sales Console scan:\n  ${pageErrors.join("\n  ")}`,
    ).toEqual([]);
  });
});
