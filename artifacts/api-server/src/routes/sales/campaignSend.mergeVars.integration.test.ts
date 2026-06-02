/**
 * Integration test for sales campaign merge-variable substitution at SEND time
 * (task #759 — "Verify sales campaign emails fill in contact names correctly
 * before sending").
 *
 * Task #653 covered the tenant *notification* send path (renderTenantEmail).
 * Sales campaigns are a different surface: the composer
 * (`sales-outreach.tsx`) offers the `CAMPAIGN_VARIABLES` catalog
 * (firstName, lastName, company, title) and the send route
 * (`POST /sales/campaigns/:id/send`) builds a per-contact `vars` map and runs
 * `replaceVars` over the subject + body before dispatching to Resend.
 *
 * Nothing automated proved that path substituted each token with the
 * recipient's REAL values per-recipient, so a regression could ship
 * "Hi {{firstName}}" to live prospects. These tests drive the actual route
 * in-process via inject(), seed two contacts at two different accounts with
 * distinct names/titles, and capture the Resend payload per recipient by
 * stubbing global.fetch.
 *
 * Asserted:
 *  1. Each of {{firstName}} {{lastName}} {{company}} {{title}} is replaced with
 *     THIS recipient's value (per-recipient, not the first contact for all).
 *  2. An unknown/missing token ({{bogus_token}}) fails safely — it is blanked,
 *     never leaked as a raw `{{...}}` tag to the inbox.
 *
 * Exercised against the REAL Postgres pool so requireAuth + requirePlanFeature
 * run their real lookups. Each run seeds + tears down its own growth tenant,
 * session, account, contact, campaign, template, and send rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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

const originalFetch = global.fetch;
const originalResendKey = process.env.RESEND_API_KEY;

interface ResendCapture {
  to: string;
  subject: string;
  html: string;
}
let resendCaptures: ResendCapture[] = [];

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);

  // The send path early-returns {ok:false} when RESEND_API_KEY is unset, so a
  // value MUST be present for the real fetch dispatch to run.
  process.env.RESEND_API_KEY = "re_test_campaign_send_mergevars";

  // Capture the per-recipient payload Resend would receive, then return a
  // success envelope. Any non-Resend fetch (brand context, sender resolution)
  // falls through to the real implementation untouched.
  global.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? "";
    if (typeof url === "string" && url.includes("api.resend.com/emails")) {
      try {
        const body = JSON.parse(String(init?.body ?? "{}"));
        resendCaptures.push({
          to: Array.isArray(body.to) ? body.to[0] : body.to,
          subject: body.subject ?? "",
          html: body.html ?? "",
        });
      } catch {
        /* ignore */
      }
      return new Response(JSON.stringify({ id: `resend_${randomUUID()}` }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return (originalFetch as any)(input, init);
  }) as any;
});

afterAll(async () => {
  global.fetch = originalFetch;
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;

  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM sales_email_sends WHERE contact_id IN (SELECT id FROM sales_contacts WHERE tenant_id = $1)`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [id]).catch(() => {});
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
    userId: 999759000 + Math.floor(Math.random() * 100000),
    email: "campaign-send-it@example.com",
    name: "IT Campaign Send Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-campsend-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-campsend-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Campaign Send Tenant', $1, 'active', 'growth')
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

async function seedContact(
  tenantId: number,
  accountId: number,
  c: { firstName: string; lastName: string; email: string; title: string },
): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, title, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id`,
    [tenantId, accountId, c.firstName, c.lastName, c.email, c.title],
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

describe("Sales campaign send-time merge variables (task #759)", () => {
  it("substitutes firstName/lastName/company/title per-recipient and blanks unknown tokens", async () => {
    resendCaptures = [];
    const { tenantId, sid } = await seedTenant();

    // Two recipients at two DIFFERENT accounts so a per-recipient bug (e.g.
    // reusing the first contact's values for everyone) is detectable.
    const acmeId = await seedAccount(tenantId, "Acme Dental");
    const brightId = await seedAccount(tenantId, "Bright Smiles");
    const jordanId = await seedContact(tenantId, acmeId, {
      firstName: "Jordan",
      lastName: "Rivera",
      email: "jordan@acmedental.com",
      title: "Practice Manager",
    });
    const morganId = await seedContact(tenantId, brightId, {
      firstName: "Morgan",
      lastName: "Lee",
      email: "morgan@brightsmiles.com",
      title: "Office Director",
    });

    // A plain-text template using ALL four CAMPAIGN_VARIABLES tokens (in the
    // composer's camelCase form) PLUS an unknown token that must fail safely.
    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[IT] merge-var send",
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
      name: "IT merge-var send campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [jordanId, morganId] },
    });
    expect(campRes.status).toBe(201);
    const camp = campRes.json as { id: number };

    const sendRes = await authed(sid, "POST", `/sales/campaigns/${camp.id}/send`, {});
    expect(sendRes.status).toBe(200);
    const sendJson = sendRes.json as { sent: number; failed: number };
    expect(sendJson.sent).toBe(2);
    expect(sendJson.failed).toBe(0);

    expect(resendCaptures).toHaveLength(2);
    const byTo = new Map(resendCaptures.map((c) => [c.to, c]));

    const jordan = byTo.get("jordan@acmedental.com");
    expect(jordan).toBeDefined();
    expect(jordan!.subject).toBe("Hi Jordan at Acme Dental");
    expect(jordan!.html).toContain("Dear Jordan Rivera,");
    expect(jordan!.html).toContain("As Practice Manager at Acme Dental,");
    // Unknown token blanked — never leaked as a raw tag.
    expect(jordan!.html).toContain("Ref: ");
    expect(jordan!.subject).not.toContain("{{");
    expect(jordan!.html).not.toContain("{{");
    // Per-recipient: Jordan's email must NOT contain the other contact's data.
    expect(jordan!.html).not.toContain("Morgan");
    expect(jordan!.html).not.toContain("Bright Smiles");

    const morgan = byTo.get("morgan@brightsmiles.com");
    expect(morgan).toBeDefined();
    expect(morgan!.subject).toBe("Hi Morgan at Bright Smiles");
    expect(morgan!.html).toContain("Dear Morgan Lee,");
    expect(morgan!.html).toContain("As Office Director at Bright Smiles,");
    expect(morgan!.subject).not.toContain("{{");
    expect(morgan!.html).not.toContain("{{");
    expect(morgan!.html).not.toContain("Jordan");
    expect(morgan!.html).not.toContain("Acme Dental");
  });

  it("blanks a token whose value is missing for the recipient (no leaked tag)", async () => {
    resendCaptures = [];
    const { tenantId, sid } = await seedTenant();

    // Contact with NO title set — {{title}} must resolve to empty, not a tag.
    const accId = await seedAccount(tenantId, "Quiet Clinic");
    const r = await pool.query<{ id: number }>(
      `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, status)
       VALUES ($1, $2, 'Casey', 'Nolan', 'casey@quietclinic.com', 'active') RETURNING id`,
      [tenantId, accId],
    );
    const caseyId = r.rows[0].id;

    const tplRes = await authed(sid, "POST", "/sales/templates", {
      name: "[IT] missing-title send",
      subject: "Hello {{firstName}}",
      bodyText: "You are our {{title}} contact. Thanks {{firstName}}.",
      bodyHtml: "",
      format: "plain",
      category: "general",
    });
    const tpl = tplRes.json as { id: number };

    const campRes = await authed(sid, "POST", "/sales/campaigns", {
      name: "IT missing-title campaign",
      templateId: tpl.id,
      status: "draft",
      metadata: { contactIds: [caseyId] },
    });
    const camp = campRes.json as { id: number };

    const sendRes = await authed(sid, "POST", `/sales/campaigns/${camp.id}/send`, {});
    expect(sendRes.status).toBe(200);
    expect((sendRes.json as { sent: number }).sent).toBe(1);

    expect(resendCaptures).toHaveLength(1);
    const cap = resendCaptures[0];
    expect(cap.to).toBe("casey@quietclinic.com");
    expect(cap.subject).toBe("Hello Casey");
    // {{title}} blanked → "our  contact" (double space), never a raw tag.
    expect(cap.html).toContain("You are our  contact.");
    expect(cap.html).toContain("Thanks Casey.");
    expect(cap.html).not.toContain("{{");
  });
});
