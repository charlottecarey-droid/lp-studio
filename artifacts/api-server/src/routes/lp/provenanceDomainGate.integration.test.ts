/**
 * Integration test for the domain-gated "Sent by" provenance footer (task #633).
 *
 * The footer is a "you're still on our shared domain" signal. It must render
 * ONLY when BOTH are true:
 *   1. the page is a personalized microsite (accountId present), and
 *   2. the page is served on the tenant's default shared host
 *      (`<slug>.lpstudio.ai`), NOT on the tenant's own custom domain.
 *
 * It is no longer plan-gated — the decision comes purely from the active host
 * at render time. We exercise both server callsites in-process via inject():
 *   - GET /lp/page/:slug      (live path — gated on the visitor's request host)
 *   - GET /lp/preview/:slug   (preview/prerender path — gated on the tenant's
 *                              canonical published host, not the admin host)
 *
 * Two real tenants are seeded against the real Postgres pool so the shared
 * host→tenant resolution (findTenantByHost / getActiveHostsForTenant) runs for
 * real:
 *   - Tenant A: NO custom domain  → canonical published host is the shared
 *     subdomain → footer shows on the shared host.
 *   - Tenant B: HAS a custom domain → canonical published host is the custom
 *     domain → footer hidden there, but STILL shown when the same microsite is
 *     visited on its shared subdomain (proves host-gating, not tenant-gating).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import {
  pool,
  db,
  tenantsTable,
  salesAccountsTable,
  lpPagesTable,
  lpPageReviewsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { inject } from "../../test-utils/injectRequest";
import { WILDCARD_BASE_HOSTS, invalidateTenantHostCache } from "../../lib/tenantHosts";
import trackingRouter from "./tracking";

const TS = Date.now();
const BASE = WILDCARD_BASE_HOSTS[0] ?? "lpstudio.ai";

const SLUG_A = `itprov-shared-${TS}`;
const SLUG_B = `itprov-custom-${TS}`;
const CUSTOM_DOMAIN_B = `${SLUG_B}.example.com`;

const PAGE_A_MICROSITE = `itprovms-a-${TS}`;
const PAGE_A_PLAIN = `itprovplain-a-${TS}`;
const PAGE_B_MICROSITE = `itprovms-b-${TS}`;

let tenantAId: number;
let tenantBId: number;
let tokenA = "";
let tokenB = "";
let app: Express;

type Provenance = { tenantName: string; accountName: string | null } | null;
const provOf = (json: unknown): Provenance =>
  (json as { provenance?: Provenance })?.provenance ?? null;

function livePage(slug: string, host: string): Promise<{ status: number; json: unknown }> {
  return inject(app, {
    method: "GET",
    url: `/lp/page/${slug}`,
    headers: { "x-forwarded-host": host },
  });
}

function previewPage(slug: string, token: string): Promise<{ status: number; json: unknown }> {
  return inject(app, {
    method: "GET",
    url: `/lp/preview/${slug}?reviewToken=${token}`,
  });
}

async function cleanup(): Promise<void> {
  for (const id of [tenantAId, tenantBId]) {
    if (!id) continue;
    await pool.query(`DELETE FROM lp_page_reviews WHERE page_id IN (SELECT id FROM lp_pages WHERE tenant_id = $1)`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_page_visits WHERE page_id IN (SELECT id FROM lp_pages WHERE tenant_id = $1)`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
}

beforeAll(async () => {
  const [tA] = await db
    .insert(tenantsTable)
    .values({ name: "IT Prov Shared", slug: SLUG_A, status: "active" })
    .returning({ id: tenantsTable.id });
  tenantAId = tA.id;

  const [tB] = await db
    .insert(tenantsTable)
    .values({ name: "IT Prov Custom", slug: SLUG_B, status: "active", domain: CUSTOM_DOMAIN_B })
    .returning({ id: tenantsTable.id });
  tenantBId = tB.id;

  const [accA] = await db
    .insert(salesAccountsTable)
    .values({ tenantId: tenantAId, name: "Acme A", displayName: "Acme A Display" })
    .returning({ id: salesAccountsTable.id });
  const [accB] = await db
    .insert(salesAccountsTable)
    .values({ tenantId: tenantBId, name: "Acme B" })
    .returning({ id: salesAccountsTable.id });

  const [pageAMicrosite] = await db
    .insert(lpPagesTable)
    .values({ tenantId: tenantAId, title: "MS A", slug: PAGE_A_MICROSITE, status: "published", blocks: [], accountId: accA.id })
    .returning({ id: lpPagesTable.id });
  await db
    .insert(lpPagesTable)
    .values({ tenantId: tenantAId, title: "Plain A", slug: PAGE_A_PLAIN, status: "published", blocks: [], accountId: null });
  const [pageBMicrosite] = await db
    .insert(lpPagesTable)
    .values({ tenantId: tenantBId, title: "MS B", slug: PAGE_B_MICROSITE, status: "published", blocks: [], accountId: accB.id })
    .returning({ id: lpPagesTable.id });

  tokenA = randomBytes(16).toString("hex");
  tokenB = randomBytes(16).toString("hex");
  await db.insert(lpPageReviewsTable).values({ pageId: pageAMicrosite.id, token: tokenA, status: "pending" });
  await db.insert(lpPageReviewsTable).values({ pageId: pageBMicrosite.id, token: tokenB, status: "pending" });

  // New tenants must be visible to the host→tenant resolver caches.
  invalidateTenantHostCache();

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(trackingRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("live path — GET /lp/page/:slug (gated on visitor host)", () => {
  it("shows the footer for a microsite on the default shared host", async () => {
    const res = await livePage(PAGE_A_MICROSITE, `${SLUG_A}.${BASE}`);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toEqual({ tenantName: "IT Prov Shared", accountName: "Acme A Display" });
  });

  it("hides the footer for a regular landing page (no target account) on the shared host", async () => {
    const res = await livePage(PAGE_A_PLAIN, `${SLUG_A}.${BASE}`);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toBeNull();
  });

  it("hides the footer for a microsite served on the tenant's own custom domain", async () => {
    const res = await livePage(PAGE_B_MICROSITE, CUSTOM_DOMAIN_B);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toBeNull();
  });

  it("still shows the footer for the SAME microsite on its shared subdomain (host-gated, not tenant-gated)", async () => {
    const res = await livePage(PAGE_B_MICROSITE, `${SLUG_B}.${BASE}`);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toEqual({ tenantName: "IT Prov Custom", accountName: "Acme B" });
  });
});

describe("preview/prerender path — GET /lp/preview/:slug (gated on canonical published host)", () => {
  it("shows the footer when the tenant has no custom domain (canonical = shared subdomain)", async () => {
    const res = await previewPage(PAGE_A_MICROSITE, tokenA);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toEqual({ tenantName: "IT Prov Shared", accountName: "Acme A Display" });
  });

  it("hides the footer when the tenant has a custom domain (canonical = custom domain)", async () => {
    const res = await previewPage(PAGE_B_MICROSITE, tokenB);
    expect(res.status).toBe(200);
    expect(provOf(res.json)).toBeNull();
  });
});
