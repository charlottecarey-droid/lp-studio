/**
 * Integration test for the Quick Campaigns wizard backend (task #800).
 *
 * The wizard creates a hidden backing template (POST /sales/templates) and a
 * draft campaign (POST /sales/campaigns) when moving from the Email step to
 * Preview, then renders the email via POST /sales/campaigns/:id/preview.
 *
 * Two regressions are covered:
 *  1. `sales_email_templates` / `sales_email_campaigns` were missing the
 *     `tenant_id` column the schema + routes reference, so every INSERT/SELECT
 *     threw Postgres 42703 → "Failed to create template" / campaign 500s.
 *     Migration 0067 adds the column; these tests prove create/list/preview
 *     now succeed AND stay tenant-isolated.
 *  2. Plain-text campaigns rendered `{{microsite_url}}` as inert text. The
 *     preview/send paths now linkify URLs into clickable <a> tags, matching
 *     the styled path.
 *
 * Exercised in-process (no TCP socket) via inject(), against the REAL Postgres
 * pool so requireAuth + requirePlanFeature run their real lookups. Each run
 * seeds + tears down its own growth tenants, sessions, and sales rows.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999800000 + Math.floor(Math.random() * 100000),
    email: "quick-campaign-it@example.com",
    name: "IT Quick Campaign Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-quickcamp-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-quickcamp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  // growth plan grants the salesConsole feature so the gated campaigns router
  // is reachable.
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Quick Campaign Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  // Mirror the real mount: requireAuth guards /sales/*, then the sales router.
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Quick Campaigns wizard backend (task #800)", () => {
  it("creates a template + draft campaign and lists the template (no 42703)", async () => {
    const { sid } = await seedTenant();

    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[Quick Campaign] IT styled",
      subject: "Hi {{first_name}}",
      bodyHtml: '<p><a href="{{microsite_url}}">View</a></p>',
      bodyText: "",
      format: "html",
      category: "quick_campaign",
    });
    expect(tplRes.status).toBe(201);
    const tpl = tplRes.json as any;
    expect(tpl.id).toBeTypeOf("number");

    const listRes = await authed(sid, "GET", "/sales/templates");
    expect(listRes.status).toBe(200);
    const list = listRes.json as Array<{ id: number }>;
    expect(list.some((t) => t.id === tpl.id)).toBe(true);

    const campRes = await authed(sid, "POST", "/sales/campaigns", {
      name: "IT Quick Campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [] },
    });
    expect(campRes.status).toBe(201);
    const camp = campRes.json as any;
    expect(camp.id).toBeTypeOf("number");

    const getCamp = await authed(sid, "GET", `/sales/campaigns/${camp.id}`);
    expect(getCamp.status).toBe(200);
  });

  it("isolates templates + campaigns per tenant", async () => {
    const a = await seedTenant();
    const b = await seedTenant();

    const tplRes = await authed(a.sid, "POST", "/sales/templates", {
      name: "[Quick Campaign] tenant A only",
      subject: "Secret A",
      bodyText: "Body for A",
      format: "plain",
      category: "quick_campaign",
    });
    const tplA = tplRes.json as any;
    const campRes = await authed(a.sid, "POST", "/sales/campaigns", {
      name: "Campaign A only",
      templateId: tplA.id,
      status: "draft",
      metadata: { contactIds: [] },
    });
    const campA = campRes.json as any;

    // Tenant B's template list must not include tenant A's template.
    const bTemplates = (await authed(b.sid, "GET", "/sales/templates")).json as Array<{ id: number }>;
    expect(bTemplates.some((t) => t.id === tplA.id)).toBe(false);

    // Tenant B's campaign list must not include tenant A's campaign, and a
    // direct GET by id must 404.
    const bCampaigns = (await authed(b.sid, "GET", "/sales/campaigns")).json as Array<{ id: number }>;
    expect(bCampaigns.some((c) => c.id === campA.id)).toBe(false);
    expect((await authed(b.sid, "GET", `/sales/campaigns/${campA.id}`)).status).toBe(404);
  });

  it("linkifies URLs in a plain-text campaign preview instead of leaving inert text", async () => {
    const { sid } = await seedTenant();

    // A plain-text body whose URL stands in for the resolved {{microsite_url}}.
    // Before the fix the preview emitted this URL as bare text; it must now be
    // wrapped in a clickable, safely-attributed anchor. Trailing punctuation
    // must stay OUTSIDE the anchor.
    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[Quick Campaign] IT plain",
      subject: "Hi {{first_name}}",
      bodyText: "View your personalized page: https://acme.lpstudio.ai/p/demo123.\nThanks!",
      bodyHtml: "",
      format: "plain",
      category: "quick_campaign",
    });
    const tpl = tplRes.json as any;

    const campRes = await authed(sid, "POST", "/sales/campaigns", {
      name: "IT Plain Campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [] },
    });
    const camp = campRes.json as any;

    const previewRes = await authed(sid, "POST", `/sales/campaigns/${camp.id}/preview`, {});
    expect(previewRes.status).toBe(200);
    const preview = previewRes.json as any;
    // The URL is now a real anchor (target=_blank, rel hardened)…
    expect(preview.html).toContain(
      '<a href="https://acme.lpstudio.ai/p/demo123" target="_blank" rel="noopener noreferrer">https://acme.lpstudio.ai/p/demo123</a>',
    );
    // …and the trailing period stays outside the link.
    expect(preview.html).toContain("/p/demo123</a>.");
  });
});
