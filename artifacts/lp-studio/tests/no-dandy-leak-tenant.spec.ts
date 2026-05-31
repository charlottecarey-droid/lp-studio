// Tenant-backed no-Dandy-leak end-to-end check.
//
// The sibling `no-dandy-leak.spec.ts` exercises an in-process generic-catalog
// fixture (DEFAULT_BRAND + the seed file in scripts/seed-block-catalog.cjs).
// It catches drift in the seed and in block components, but it does NOT
// exercise:
//   - the live `/api/block-catalog` round-trip (catalog merge with overrides)
//   - real tenant resolution (host → tenant → settings.industry='generic')
//   - lp_brand_settings overrides applied through getBrandStyleVars
//   - the saved-page render path through `/lp/:slug`
//
// This spec covers the missing surface: it stands up a real Royal-style
// generic-industry tenant in the dev DB, logs in as that tenant, opens the
// builder with every catalog block dropped on the canvas, and visits the
// public viewer for the same saved page. Both surfaces are scanned for
// Dandy-branded strings, asset URLs, and computed colours.
//
// The two assertions live inside a single `test()` so the (relatively
// expensive) tenant + page setup runs exactly once per spec invocation.
// Splitting the build/viewer phases into separate `test()`s tripped a known
// Playwright behaviour where `test.beforeAll` re-ran when a preceding test
// failed, leaving two Royal tenants colliding on `tenants.domain="localhost"`
// and breaking the second test's host-by-domain resolution.

import pg from "pg";
import { test, expect, type Page, type BrowserContext } from "./setup/pw";
import {
  createRoyalTenant,
  cleanupRoyalTenant,
  purgeStaleRoyalTenants,
  type RoyalTenant,
} from "./setup/royal-tenant";
import { csrfHeaders } from "./setup/csrf";

const { Pool } = pg;

interface ForbiddenPattern {
  label: string;
  pattern: RegExp;
}

// Same set as no-dandy-leak.spec.ts — keep these two lists in sync.
const FORBIDDEN_PATTERNS: ReadonlyArray<ForbiddenPattern> = [
  { label: "Dandy-branded URL paths (/dandy-…)", pattern: /\/dandy-[a-z0-9_-]/i },
  { label: "meetdandy domain references", pattern: /meetdandy/i },
  { label: "Dandy forest hex #003A30", pattern: /#003a30\b/i },
  { label: "Dandy forest rgb(0, 58, 48)", pattern: /rgb\(\s*0\s*,\s*58\s*,\s*48\s*\)/i },
  { label: "Dandy forest-deep hex #00231D", pattern: /#00231d\b/i },
  { label: "Dandy forest-deep rgb(0, 35, 29)", pattern: /rgb\(\s*0\s*,\s*35\s*,\s*29\s*\)/i },
  { label: "Dandy lime hex #C7E738", pattern: /#c7e738\b/i },
  { label: "Dandy lime rgb(199, 231, 56)", pattern: /rgb\(\s*199\s*,\s*231\s*,\s*56\s*\)/i },
];

interface CatalogRow {
  block_type: string;
  industry: string;
  label: string;
  category: string;
  default_props: Record<string, unknown> | null;
  is_enabled: boolean;
  sort_order: number;
}

interface CatalogPageBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

interface Violation {
  label: string;
  sample: string;
}

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "NEON_DATABASE_URL / DATABASE_URL must be set so the tenant fixture can " +
        "create a Royal-style tenant in the dev DB.",
    );
  }
  return url;
}

/**
 * Capture every text node, attribute value, and computed style under a root
 * selector into a single string surface. Used by both the builder canvas and
 * viewer scans so any leakage — visible copy, asset URL, or computed colour —
 * is observable.
 *
 * The walker excludes `<script>` / `<style>` / dev-only overlays so transient
 * dev chrome does not produce false positives or mask leaks.
 */
async function captureSurface(page: Page, rootSelector: string): Promise<string> {
  return page.evaluate((sel) => {
    const SKIP_SELECTORS = [
      "script",
      "style",
      "noscript",
      // Replit dev-only runtime-error overlay
      "[data-replit-runtime-error-overlay]",
      "#runtime-errors-modal",
    ];
    const root = document.querySelector(sel);
    if (!root) return "";
    const parts: string[] = [];
    parts.push((root as HTMLElement).innerText ?? "");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const el = node as Element;
        for (const skip of SKIP_SELECTORS) {
          if (el.matches?.(skip) || el.closest?.(skip)) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node instanceof Element) {
        for (const attr of Array.from(node.attributes)) {
          parts.push(`${attr.name}="${attr.value}"`);
        }
        const cs = window.getComputedStyle(node);
        parts.push(`bg=${cs.backgroundColor}`);
        parts.push(`color=${cs.color}`);
        parts.push(`bdr=${cs.borderColor}`);
        parts.push(`fill=${cs.fill}`);
        parts.push(`stroke=${cs.stroke}`);
        parts.push(`bgImg=${cs.backgroundImage}`);
      }
      node = walker.nextNode();
    }
    return parts.join("\n");
  }, rootSelector);
}

function scanForLeaks(surface: string): Violation[] {
  const violations: Violation[] = [];
  for (const { label, pattern } of FORBIDDEN_PATTERNS) {
    // Collect every distinct match so a single fix doesn't mask others, but
    // cap per-pattern so error messages stay readable.
    const seen = new Set<string>();
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(surface)) !== null) {
      const sample = m[0];
      if (seen.has(sample)) continue;
      seen.add(sample);
      violations.push({ label, sample });
      if (seen.size >= 5) break;
    }
  }
  // Treat a "© Dandy …" footer line as its own violation so it surfaces
  // distinctly from generic colour leaks.
  for (const line of surface.split(/\n+/).map((l) => l.trim())) {
    if (/©|copyright/i.test(line) && /dandy/i.test(line)) {
      violations.push({ label: 'Copyright contains "Dandy"', sample: line });
    }
  }
  return violations;
}

function formatViolations(violations: Violation[]): string {
  return violations
    .map((v) => `  • ${v.label} → matched: ${JSON.stringify(v.sample)}`)
    .join("\n");
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
      // Match the api-server's 7-day session lifetime upper bound.
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  ]);
}

/**
 * Wait for `selector` and surface a useful diagnostic on timeout. The default
 * Playwright TimeoutError just says "selector not found" — without any of the
 * page state it's nearly impossible to tell whether auth, the lazy chunk, or
 * an API call regressed.
 */
async function waitForSelectorWithDiagnostics(
  page: Page,
  selector: string,
  timeoutMs: number,
  surface: string,
): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
  } catch (err) {
    let bodyText = "";
    let title = "";
    try {
      title = await page.title();
      bodyText = (await page.locator("body").innerText({ timeout: 2_000 })).slice(0, 800);
    } catch {
      /* fall through */
    }
    throw new Error(
      `Timed out waiting for "${selector}" on ${surface} (${timeoutMs}ms).\n` +
        `Page title: ${JSON.stringify(title)}\n` +
        `Body text snapshot:\n${bodyText}\n` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

test.describe("Royal-tenant no-Dandy-leak end-to-end", () => {
  let pool: pg.Pool;
  let tenant: RoyalTenant;
  let pageId: number;
  let pageSlug: string;
  let catalog: CatalogRow[];

  test.beforeAll(async ({ request }) => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    // Drop any orphan Royal-test rows from a previous crashed run so we never
    // collide on tenants.domain="localhost".
    await purgeStaleRoyalTenants(pool);
    tenant = await createRoyalTenant(pool);

    // The api-server caches tenants by host for 60s. By the time this spec
    // runs (after 50+ earlier specs warm the cache), a freshly-inserted
    // tenants.domain="localhost" row is invisible to findTenantByHost — which
    // makes the public viewer below resolve to no tenant and 404. Other
    // tenant-seeding specs (draft-preview-gating, chili-piper-handoff, …)
    // already invalidate via this dev-only endpoint; do the same here.
    await request.post("/api/_test/invalidate-host-cache").catch(() => undefined);

    // Smoke-check the live API path: read /api/block-catalog as the seeded
    // tenant. This both warms the api-server and gives us the exact set of
    // blocks the tenant's builder will see.
    const catalogRes = await request.get("/api/block-catalog", {
      headers: { Cookie: `lp_sid=${tenant.sessionSid}` },
    });
    expect(
      catalogRes.ok(),
      `block-catalog read failed: ${catalogRes.status()} ${await catalogRes.text()}`,
    ).toBe(true);
    catalog = (await catalogRes.json()) as CatalogRow[];
    expect(catalog.length, "tenant catalog returned no rows").toBeGreaterThan(0);
    expect(
      catalog.every((r) => r.industry === "generic"),
      `non-generic rows leaked into the tenant catalog: ${
        catalog.filter((r) => r.industry !== "generic").map((r) => r.block_type).join(", ")
      }`,
    ).toBe(true);

    // Create a page for this tenant via the live API. POST exercises the same
    // auth + tenant-scoping path the builder UI uses for "New Page".
    pageSlug = `royal-leak-page-${Date.now().toString(36)}`;
    const createRes = await request.post("/api/lp/pages", {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        title: "Royal Leak Test",
        slug: pageSlug,
        blocks: [],
        status: "draft",
      },
    });
    expect(
      createRes.ok(),
      `page create failed: ${createRes.status()} ${await createRes.text()}`,
    ).toBe(true);
    const pageRow = (await createRes.json()) as { id: number; slug: string };
    pageId = pageRow.id;

    // Pre-populate the page with one block per catalog row using the
    // catalog-resolved default props. Doing the seeding via PUT lets us
    // verify the rendered surface for every catalog block in a single page
    // load — the alternative (clicking each "+" button in turn) is slower
    // and inherently flaky. Functionally identical: BuilderEditor.addBlock
    // builds the same `{id, type, props}` shape from catalog defaults.
    let nextId = 1;
    const blocks: CatalogPageBlock[] = catalog
      .filter((row) => row.is_enabled)
      .map((row) => ({
        id: `royal-${nextId++}`,
        type: row.block_type,
        props: (row.default_props ?? {}) as Record<string, unknown>,
      }));

    const updateRes = await request.put(`/api/lp/pages/${pageId}`, {
      headers: {
        ...(await csrfHeaders(request, tenant.sessionSid)),
        "Content-Type": "application/json",
      },
      data: {
        blocks,
        status: "published",
      },
    });
    expect(
      updateRes.ok(),
      `page update failed: ${updateRes.status()} ${await updateRes.text()}`,
    ).toBe(true);
  });

  test.afterAll(async () => {
    if (tenant && pool) {
      await cleanupRoyalTenant(pool, tenant);
    }
    if (pool) {
      await pool.end();
    }
  });

  test("builder + viewer render the live catalog without leaking Dandy", async ({ page, context, baseURL }) => {
    expect(baseURL, "playwright baseURL must be configured").toBeTruthy();
    await setSessionCookie(context, tenant.sessionSid, baseURL!);

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // ────────────────────────────────────────────────────────────────────
    // Phase 1 — builder canvas
    // ────────────────────────────────────────────────────────────────────
    const builderUrl = `/builder/${pageId}`;
    const builderResponse = await page.goto(builderUrl, { waitUntil: "domcontentloaded" });
    expect(builderResponse, `navigation to ${builderUrl} returned no response`).not.toBeNull();
    expect(builderResponse!.status(), `unexpected status for ${builderUrl}`).toBeLessThan(400);

    // BuilderEditor wraps the rendered canvas in `<div data-lp-page>` once
    // the page + brand fetches have resolved. We deliberately wait on this
    // (instead of a chrome selector like the tab list) because it is
    // emitted only after BlockRenderer mounts, which is exactly the surface
    // we want to scan.
    await waitForSelectorWithDiagnostics(page, "[data-lp-page]", 60_000, builderUrl);

    // Give blocks (with images / fonts / animations) a moment to settle so
    // computed styles reflect the final brand palette, not transient values.
    await page.waitForLoadState("networkidle").catch(() => undefined);

    // ── Sanity: the canvas actually mounted block content. The canvas has
    //          many DOM children (one per block). If it's near-empty,
    //          BlockRenderer is bailing out and a leak scan would be
    //          meaningless.
    const canvasChildren = await page.locator("[data-lp-page] *").count();
    expect(
      canvasChildren,
      `builder canvas rendered too few elements (${canvasChildren}); blocks likely failed to mount`,
    ).toBeGreaterThan(50);

    // ── Sanity: the BlockLibrary palette actually surfaces catalog rows.
    //          A broken catalog fetch would otherwise hide leaks under the
    //          guise of "no buttons therefore nothing to leak".
    const libraryButtons = await page.locator("aside button").count();
    expect(
      libraryButtons,
      "BlockLibrary rendered no buttons — the catalog fetch likely failed",
    ).toBeGreaterThan(0);

    // ── Primary assertion: no Dandy leakage in the canvas surface.
    const canvasSurface = await captureSurface(page, "[data-lp-page]");
    const canvasViolations = scanForLeaks(canvasSurface);
    if (canvasViolations.length > 0) {
      throw new Error(
        `Dandy leakage detected in the builder canvas for tenant ` +
          `"${tenant.slug}" (industry=generic, ${catalog.length} blocks):\n` +
          `${formatViolations(canvasViolations)}\n\n` +
          `Fix the catalog seed in scripts/seed-block-catalog.cjs and/or the ` +
          `offending block component.`,
      );
    }

    // NOTE: We deliberately do NOT scan the surrounding builder chrome
    // (header, palette panel, side panels). The LP-Studio editor *is* a
    // Dandy product, and its shell intentionally renders in Dandy brand
    // colours. The leak rule we care about is whether *tenant-authored*
    // surfaces — the canvas above and the public viewer below — bleed
    // Dandy palette / copy into what the tenant's customers see.

    // ────────────────────────────────────────────────────────────────────
    // Phase 2 — public viewer for the saved page
    // ────────────────────────────────────────────────────────────────────
    const viewerUrl = `/lp/${pageSlug}`;
    const viewerResponse = await page.goto(viewerUrl, { waitUntil: "domcontentloaded" });
    expect(viewerResponse, `navigation to ${viewerUrl} returned no response`).not.toBeNull();
    expect(viewerResponse!.status(), `unexpected status for ${viewerUrl}`).toBeLessThan(400);

    // LandingPageViewer emits the same `<div ... data-lp-page>` wrapper
    // around the rendered blocks once `/api/lp/page/:slug` resolves. The
    // slug lookup itself is host-scoped, which is why we register
    // tenants.domain="localhost" in the fixture so the api-server's
    // host-by-domain resolver returns this tenant.
    await waitForSelectorWithDiagnostics(page, "[data-lp-page]", 60_000, viewerUrl);
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const renderedChildren = await page.locator("[data-lp-page] *").count();
    expect(
      renderedChildren,
      `viewer rendered too few elements (${renderedChildren}); the saved blocks likely failed to mount`,
    ).toBeGreaterThan(50);

    const viewerSurface = await captureSurface(page, "[data-lp-page]");
    const viewerViolations = scanForLeaks(viewerSurface);
    if (viewerViolations.length > 0) {
      throw new Error(
        `Dandy leakage detected in the public viewer for tenant ` +
          `"${tenant.slug}" at ${viewerUrl}:\n${formatViolations(viewerViolations)}`,
      );
    }

    // Whole-page sweep — catches leaks anywhere in the document (e.g. <html>
    // background, document title) outside the lp-page wrapper.
    const viewerBodySurface = await captureSurface(page, "body");
    const viewerBodyViolations = scanForLeaks(viewerBodySurface);
    if (viewerBodyViolations.length > 0) {
      throw new Error(
        `Dandy leakage detected in the viewer document for tenant ` +
          `"${tenant.slug}" at ${viewerUrl}:\n${formatViolations(viewerBodyViolations)}`,
      );
    }

    // Surface uncaught page errors at the very end so leak failures aren't
    // hidden behind a noisy crash. We deliberately ignore errors that are
    // already covered by the leak scan itself.
    expect(
      pageErrors,
      `uncaught page errors during builder/viewer render:\n  ${pageErrors.join("\n  ")}`,
    ).toEqual([]);
  });
});
