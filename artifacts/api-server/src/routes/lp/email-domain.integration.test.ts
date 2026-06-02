/**
 * Integration test for the self-serve custom email-domain wizard (Task #771).
 *
 * The wizard lets an Enterprise tenant register + verify + remove their OWN
 * sending domain in Resend without an operator touching the Resend dashboard.
 * The safety-critical contract this pins:
 *
 *   - register (POST) → creates the domain in Resend, returns the DNS records
 *     the customer must publish, and PERSISTS {sendingDomain, customEmailDomainId}
 *     onto the tenant's brand config (read-merge-write — other fields untouched).
 *   - FAIL CLOSED: persisting alone never starts unverified sends. While the
 *     domain is `pending`, `resolveTenantSender` keeps routing through the Tier 1
 *     shared default; only once Resend reports `verified` does mail flip to the
 *     custom domain. Both halves are asserted with the SAME persisted config.
 *   - verify (POST /verify) re-fetches live status by id; once verified the
 *     state reports `active: true`.
 *   - remove (DELETE) deletes the Resend domain AND clears the config, reverting
 *     the tenant to the shared default.
 *   - the whole surface is Enterprise-gated: a non-Enterprise tenant gets 402.
 *
 * The Resend client is mocked by stubbing global `fetch` with a tiny in-memory
 * Resend simulator (POST/GET-by-id/GET-list/DELETE on api.resend.com). Routes
 * run IN-PROCESS via inject() — the vitest worker pool here can't bind a
 * listening port (app.listen never fires its callback). Everything else (auth,
 * plan lookup, config persistence) runs against the REAL Postgres pool, so a
 * real tenant seed is the only faithful way to exercise the gate + read/write.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import {
  _clearResendDomainStatusCache,
  type ResendDnsRecord,
} from "../../lib/resendDomainStatus";
import { resolveTenantSender, SHARED_SENDING_DOMAIN } from "../../lib/tenantSender";
import type { SalesBrandContext } from "../../lib/salesBrandContext";
import emailDomainRouter from "../../routes/lp/email-domain";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const ENT_SLUG = `it-emaildomain-ent-${SUFFIX}`;
const FREE_SLUG = `it-emaildomain-free-${SUFFIX}`;
const ENT_SID = `it-emaildomain-ent-${randomUUID()}`;
const FREE_SID = `it-emaildomain-free-${randomUUID()}`;
const CUSTOM_DOMAIN = `ent-${SUFFIX}.example.com`;

let entTenantId: number;
let freeTenantId: number;
let app: Express;

// ── Mock Resend client (global fetch) ──────────────────────────────────────
// A tiny in-memory simulator. `resendStatus` is mutable so a test can flip the
// domain from pending → verified and prove both the wizard state AND the
// resolver routing react to it.
const SAMPLE_RECORDS: ResendDnsRecord[] = [
  { record: "SPF", name: CUSTOM_DOMAIN, type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", ttl: "Auto", priority: 10, status: "pending" },
  { record: "DKIM", name: `resend._domainkey.${CUSTOM_DOMAIN}`, type: "TXT", value: "p=MIGf...", ttl: "Auto", status: "pending" },
];

let resendStatus = "pending";
const REGISTERED = new Map<string, { id: string; name: string }>();

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const u = new URL(url);
  if (u.host !== "api.resend.com") {
    throw new Error(`unexpected non-Resend fetch in test: ${method} ${url}`);
  }
  const byId = u.pathname.match(/^\/domains\/(.+)$/);

  if (u.pathname === "/domains" && method === "POST") {
    const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
    const name = (body.name ?? "").toLowerCase();
    const id = `dom-${SUFFIX}`;
    REGISTERED.set(id, { id, name });
    return jsonResponse({ id, name, status: "pending", records: SAMPLE_RECORDS }, 201);
  }
  if (u.pathname === "/domains" && method === "GET") {
    // List endpoint — used by the resolver's name-based status check.
    const data = [...REGISTERED.values()].map((d) => ({ name: d.name, status: resendStatus }));
    return jsonResponse({ data });
  }
  if (byId && method === "GET") {
    const id = decodeURIComponent(byId[1]);
    const d = REGISTERED.get(id);
    if (!d) return jsonResponse({ message: "Domain not found" }, 404);
    return jsonResponse({ id: d.id, name: d.name, status: resendStatus, records: SAMPLE_RECORDS });
  }
  if (byId && method === "DELETE") {
    const id = decodeURIComponent(byId[1]);
    REGISTERED.delete(id);
    return jsonResponse({ id, object: "domain", deleted: true });
  }
  throw new Error(`unhandled Resend call in test: ${method} ${url}`);
});

// ── Helpers ────────────────────────────────────────────────────────────────
function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    body: opts.body,
  });
}

/** Read the persisted email-domain fields straight off the brand-config row. */
async function readPersisted(tenantId: number): Promise<{ sendingDomain?: unknown; customEmailDomainId?: unknown }> {
  const r = await pool.query<{ config: { salesConsole?: Record<string, unknown> } }>(
    `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  return (r.rows[0]?.config?.salesConsole ?? {}) as { sendingDomain?: unknown; customEmailDomainId?: unknown };
}

/** A minimal brand context so the resolver doesn't query the DB for it. */
function ctxFor(tenantId: number, sendingDomain: string): SalesBrandContext {
  return {
    tenantId,
    brandName: "Acme Ent",
    tagline: "",
    taglines: [],
    defaultCtaUrl: "",
    chilipiperUrl: "",
    senderName: "Acme Ent",
    senderLocalPart: "sales",
    sendingDomain,
    brandedEmailSubdomain: "",
    replyTo: "",
    notificationsLocalPart: "notifications",
    emailSignature: "",
    emailFooter: "",
    salesIntroLine: "",
    briefBlurb: "",
    useBuiltInExemplars: false,
    customerNameRules: "",
    valuePropPairs: [],
  };
}

async function seedTenant(slug: string, plan: string, sid: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', $3, '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT EmailDomain ${slug}`, slug, plan],
  );
  const tenantId = t.rows[0].id;

  const sess: AuthUser = {
    userId: 0, // not used by these routes; getTenantId reads tenantId
    email: `admin-${slug}@example.com`,
    name: "Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true, // skips requireAuth host enforcement
    appUserRole: null, // NOT superadmin — so the plan gate actually applies
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, JSON.stringify(sess)],
  );
  return tenantId;
}

async function cleanupTenant(tenantId: number | undefined): Promise<void> {
  if (!tenantId) return;
  await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

let prevApiKey: string | undefined;

beforeAll(async () => {
  prevApiKey = process.env["RESEND_API_KEY"];
  process.env["RESEND_API_KEY"] = "re_test_key";
  vi.stubGlobal("fetch", fetchMock);

  entTenantId = await seedTenant(ENT_SLUG, "enterprise", ENT_SID);
  freeTenantId = await seedTenant(FREE_SLUG, "growth", FREE_SID);

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(emailDomainRouter);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  if (prevApiKey === undefined) delete process.env["RESEND_API_KEY"];
  else process.env["RESEND_API_KEY"] = prevApiKey;

  await cleanupTenant(entTenantId);
  await cleanupTenant(freeTenantId);
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1::text[])`, [[ENT_SID, FREE_SID]]).catch(() => {});
  _clearResendDomainStatusCache();
});

describe("custom email-domain wizard — register → records", () => {
  it("creates the Resend domain, returns DNS records, and persists the config", async () => {
    resendStatus = "pending";
    const res = await injectAs(ENT_SID, {
      method: "POST",
      url: "/lp/email-domain",
      body: { domain: CUSTOM_DOMAIN },
    });

    expect(res.status).toBe(201);
    expect((res.json as Record<string, any>).domain).toBe(CUSTOM_DOMAIN);
    expect(typeof (res.json as Record<string, any>).domainId).toBe("string");
    expect((res.json as Record<string, any>).domainId.length).toBeGreaterThan(0);
    expect((res.json as Record<string, any>).status).toBe("pending");
    expect((res.json as Record<string, any>).active).toBe(false);
    expect(Array.isArray((res.json as Record<string, any>).records)).toBe(true);
    expect((res.json as Record<string, any>).records.length).toBeGreaterThan(0);

    // The create call actually hit the mocked Resend API.
    expect(fetchMock).toHaveBeenCalled();

    // Config persisted onto salesConsole (read-merge-write).
    const persisted = await readPersisted(entTenantId);
    expect(persisted.sendingDomain).toBe(CUSTOM_DOMAIN);
    expect(persisted.customEmailDomainId).toBe((res.json as Record<string, any>).domainId);
  });
});

describe("custom email-domain wizard — fail closed until verified", () => {
  it("resolveTenantSender stays on the shared default while the domain is pending", async () => {
    resendStatus = "pending";
    _clearResendDomainStatusCache();

    const sender = await resolveTenantSender(entTenantId, "sales", {
      ctx: ctxFor(entTenantId, CUSTOM_DOMAIN),
    });

    expect(sender.usingCustomDomain).toBe(false);
    expect(sender.domain).toBe(SHARED_SENDING_DOMAIN);
    expect(sender.from).toContain(`@${SHARED_SENDING_DOMAIN}`);
  });
});

describe("custom email-domain wizard — verification status (poll by id)", () => {
  it("flips to verified/active once Resend reports verified", async () => {
    resendStatus = "verified";
    const res = await injectAs(ENT_SID, { method: "POST", url: "/lp/email-domain/verify" });

    expect(res.status).toBe(200);
    expect((res.json as Record<string, any>).status).toBe("verified");
    expect((res.json as Record<string, any>).active).toBe(true);
    expect((res.json as Record<string, any>).domain).toBe(CUSTOM_DOMAIN);
  });

  it("GET reflects the same live verified state", async () => {
    resendStatus = "verified";
    const res = await injectAs(ENT_SID, { method: "GET", url: "/lp/email-domain" });

    expect(res.status).toBe(200);
    expect((res.json as Record<string, any>).status).toBe("verified");
    expect((res.json as Record<string, any>).active).toBe(true);
  });

  it("resolveTenantSender routes through the custom domain once verified", async () => {
    resendStatus = "verified";
    _clearResendDomainStatusCache();

    const sender = await resolveTenantSender(entTenantId, "sales", {
      ctx: ctxFor(entTenantId, CUSTOM_DOMAIN),
    });

    expect(sender.usingCustomDomain).toBe(true);
    expect(sender.domain).toBe(CUSTOM_DOMAIN);
    expect(sender.from).toContain(`@${CUSTOM_DOMAIN}`);
  });
});

describe("custom email-domain wizard — remove path", () => {
  it("deletes the Resend domain, clears the config, and reverts to the shared default", async () => {
    const res = await injectAs(ENT_SID, { method: "DELETE", url: "/lp/email-domain" });

    expect(res.status).toBe(200);
    expect((res.json as Record<string, any>).domain).toBeNull();
    expect((res.json as Record<string, any>).domainId).toBeNull();
    expect((res.json as Record<string, any>).active).toBe(false);

    // Resend domain actually removed.
    expect(REGISTERED.size).toBe(0);

    // Config cleared.
    const persisted = await readPersisted(entTenantId);
    expect(persisted.sendingDomain).toBeUndefined();
    expect(persisted.customEmailDomainId).toBeUndefined();

    // Routing reverts to the shared default (no configured domain).
    _clearResendDomainStatusCache();
    const sender = await resolveTenantSender(entTenantId, "sales", {
      ctx: ctxFor(entTenantId, ""),
    });
    expect(sender.usingCustomDomain).toBe(false);
    expect(sender.domain).toBe(SHARED_SENDING_DOMAIN);
  });
});

describe("custom email-domain wizard — Enterprise gating", () => {
  it("returns 402 for a non-Enterprise tenant on every verb", async () => {
    const get = await injectAs(FREE_SID, { method: "GET", url: "/lp/email-domain" });
    expect(get.status).toBe(402);

    const post = await injectAs(FREE_SID, {
      method: "POST",
      url: "/lp/email-domain",
      body: { domain: "blocked.example.com" },
    });
    expect(post.status).toBe(402);

    const del = await injectAs(FREE_SID, { method: "DELETE", url: "/lp/email-domain" });
    expect(del.status).toBe(402);

    // Nothing was registered or persisted for the blocked tenant.
    const persisted = await readPersisted(freeTenantId);
    expect(persisted.sendingDomain).toBeUndefined();
  });
});
