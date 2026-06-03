/**
 * Integration test for sales campaign merge-variable substitution at PREVIEW
 * time (task #829 — "Confirm the campaign email preview shows each contact's
 * real details").
 *
 * Task #759 proved the SEND path (POST /sales/campaigns/:id/send) substitutes
 * firstName/lastName/company/title per recipient and blanks unknown tokens.
 * The PREVIEW path (POST /sales/campaigns/:id/preview) builds its OWN separate
 * `vars` map (campaigns.ts ~line 1001) and is what operators look at before
 * hitting send — but nothing automated proved it personalizes the same way. A
 * regression there would let someone approve a "Hi {{firstName}}" email that
 * looks fine in preview but isn't actually filled in.
 *
 * These tests drive the real route in-process via inject(), seed a real
 * contact at a real account, and assert the rendered subject/html carry that
 * contact's REAL values — not the "Sarah Johnson / Acme Dental" sample shape
 * the route falls back to when no contact is resolvable.
 *
 * Asserted:
 *  1. Each of {{firstName}} {{lastName}} {{company}} {{title}} renders the
 *     seeded recipient's real value; the response reports `isSample:false` and
 *     echoes the contact. An unknown token ({{bogus_token}}) is reported in
 *     `unresolvedTokens` and blanked — never leaked as a raw `{{...}}` tag.
 *  2. A contact missing a field ({{title}} with no title set) surfaces in
 *     `emptyTokens` and renders blank — again no leaked tag.
 *
 * Exercised against the REAL Postgres pool so requireAuth + requirePermission
 * run their real lookups. Each run seeds + tears down its own growth tenant,
 * session, account, contact, campaign and template rows.
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

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_email_sends WHERE contact_id IN (SELECT id FROM sales_contacts WHERE tenant_id = $1)`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_email_campaigns WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_email_templates WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_hotlinks WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999829000 + Math.floor(Math.random() * 100000),
    email: "campaign-preview-it@example.com",
    name: "IT Campaign Preview Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-camppreview-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-camppreview-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Campaign Preview Tenant', $1, 'active', 'growth')
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

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

describe("Sales campaign preview-time merge variables (task #829)", () => {
  it("renders the seeded recipient's real firstName/lastName/company/title and blanks unknown tokens", async () => {
    const { tenantId, sid } = await seedTenant();

    const acmeId = await seedAccount(tenantId, "Acme Dental");
    const contactRes = await pool.query<{ id: number }>(
      `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, title, status)
       VALUES ($1, $2, 'Jordan', 'Rivera', 'jordan@acmedental.com', 'Practice Manager', 'active') RETURNING id`,
      [tenantId, acmeId],
    );
    const jordanId = contactRes.rows[0].id;

    // Plain-text template using all four CAMPAIGN_VARIABLES tokens (composer's
    // camelCase form — normalizeTokenKey maps them onto the route's snake_case
    // vars map) PLUS an unknown token that must fail safely.
    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[IT] preview merge-var",
      subject: "Hi {{firstName}} at {{company}}",
      bodyText:
        "Dear {{firstName}} {{lastName}},\nAs {{title}} at {{company}}, you'll love this.\nRef: {{bogus_token}}",
      bodyHtml: "",
      format: "plain",
      category: "general",
    });
    expect(tplRes.status).toBe(201);
    const tpl = tplRes.json as { id: number };

    const campRes = await authed(sid, "POST", "/sales/campaigns", {
      name: "IT preview merge-var campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [jordanId] },
    });
    expect(campRes.status).toBe(201);
    const camp = campRes.json as { id: number };

    const previewRes = await authed(sid, "POST", `/sales/campaigns/${camp.id}/preview`, {});
    expect(previewRes.status).toBe(200);
    const preview = previewRes.json as {
      subject: string;
      html: string;
      contact: { id: number; firstName: string; lastName: string; company: string } | null;
      unresolvedTokens: string[];
      emptyTokens: string[];
      isSample: boolean;
    };

    // This is the REAL contact, not the "Sarah Johnson" sample fallback.
    expect(preview.isSample).toBe(false);
    expect(preview.contact).not.toBeNull();
    expect(preview.contact!.id).toBe(jordanId);

    // Subject + body carry Jordan's real values.
    expect(preview.subject).toBe("Hi Jordan at Acme Dental");
    expect(preview.html).toContain("Dear Jordan Rivera,");
    expect(preview.html).toContain("As Practice Manager at Acme Dental,");

    // Unknown token reported AND blanked — never leaked as a raw tag.
    expect(preview.unresolvedTokens).toContain("bogus_token");
    expect(preview.html).toContain("Ref: ");
    expect(preview.subject).not.toContain("{{");
    expect(preview.html).not.toContain("{{");
  });

  it("surfaces a missing contact field in emptyTokens and renders it blank (no leaked tag)", async () => {
    const { tenantId, sid } = await seedTenant();

    // Contact with NO title set — {{title}} must resolve to empty AND be
    // reported in emptyTokens so the operator notices before sending.
    const accId = await seedAccount(tenantId, "Quiet Clinic");
    const r = await pool.query<{ id: number }>(
      `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
       VALUES ($1, $2, 'Casey', 'Nolan', 'casey@quietclinic.com', 'active') RETURNING id`,
      [tenantId, accId],
    );
    const caseyId = r.rows[0].id;

    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[IT] preview missing-title",
      subject: "Hello {{first_name}}",
      bodyText: "You are our {{title}} contact. Thanks {{first_name}}.",
      bodyHtml: "",
      format: "plain",
      category: "general",
    });
    const tpl = tplRes.json as { id: number };

    const campRes = await authed(sid, "POST", "/sales/campaigns", {
      name: "IT preview missing-title campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [caseyId] },
    });
    const camp = campRes.json as { id: number };

    const previewRes = await authed(sid, "POST", `/sales/campaigns/${camp.id}/preview`, {});
    expect(previewRes.status).toBe(200);
    const preview = previewRes.json as {
      subject: string;
      html: string;
      emptyTokens: string[];
      isSample: boolean;
    };

    expect(preview.isSample).toBe(false);
    // Real first_name still rendered…
    expect(preview.subject).toBe("Hello Casey");
    expect(preview.html).toContain("Thanks Casey.");
    // …missing title surfaces in emptyTokens and renders blank ("our  contact").
    expect(preview.emptyTokens).toContain("title");
    expect(preview.html).toContain("You are our  contact.");
    expect(preview.html).not.toContain("{{");
  });
});
