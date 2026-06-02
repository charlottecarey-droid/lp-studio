/**
 * Integration test for the self-serve branded email-subdomain route
 * (Tier 2, Task #784).
 *
 * The route lets a Growth/Scale tenant auto-provision a branded sending
 * subdomain (mail.<slug>.lpstudio.ai) with ZERO operator and zero DNS work:
 * we register it in Resend AND publish the returned DNS records into our OWN
 * Cloudflare zone. The safety-critical contract this pins:
 *
 *   - provision (POST) → creates the domain in Resend, publishes its DNS
 *     records into Cloudflare, and PERSISTS {brandedEmailSubdomain, id,
 *     dnsRecordIds} (read-merge-write — other brand fields untouched).
 *   - FAIL CLOSED: persisting alone never starts unverified sends. While the
 *     subdomain is `pending`, `resolveTenantSender` keeps routing through the
 *     Tier 1 shared default; only once Resend reports `verified` does mail flip
 *     to the branded subdomain. Both halves asserted with the SAME config.
 *   - verify (POST /verify) re-fetches live status by id; once verified the
 *     state reports `active: true`.
 *   - remove (DELETE) deletes the Resend domain AND the Cloudflare records we
 *     created AND clears the config, reverting the tenant to the shared default.
 *   - the surface is gated on the brandedEmailSubdomain feature: a free/starter
 *     tenant gets 402 on every verb.
 *
 * Both the Resend client AND the Cloudflare client are mocked by stubbing
 * global `fetch` (api.resend.com + api.cloudflare.com). Routes run IN-PROCESS
 * via inject() — the vitest worker pool here can't bind a listening port.
 * Auth, plan lookup, and config persistence run against the REAL Postgres pool.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { _clearResendDomainStatusCache, type ResendDnsRecord } from "../../lib/resendDomainStatus";
import { resolveTenantSender, SHARED_SENDING_DOMAIN, deriveBrandedSubdomain } from "../../lib/tenantSender";
import type { SalesBrandContext } from "../../lib/salesBrandContext";
import brandedEmailSubdomainRouter from "../../routes/lp/branded-email-subdomain";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const GROWTH_SLUG = `it-brandedsub-growth-${SUFFIX}`;
const FREE_SLUG = `it-brandedsub-free-${SUFFIX}`;
const GROWTH_SID = `it-brandedsub-growth-${randomUUID()}`;
const FREE_SID = `it-brandedsub-free-${randomUUID()}`;

let growthTenantId: number;
let freeTenantId: number;
let expectedSubdomain: string;
let app: Express;

// ── Mock Resend + Cloudflare clients (global fetch) ────────────────────────
const SAMPLE_RECORDS: ResendDnsRecord[] = [
  { record: "SPF", name: "", type: "MX", value: "feedback-smtp.us-east-1.amazonses.com", ttl: "Auto", priority: 10, status: "pending" },
  { record: "DKIM", name: "", type: "TXT", value: "p=MIGfMA0...", ttl: "Auto", status: "pending" },
];

let resendStatus = "pending";
const RESEND_REGISTERED = new Map<string, { id: string; name: string }>();
const CF_RECORDS = new Map<string, { id: string; type: string; name: string; content: string }>();
let cfRecCounter = 0;

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
/** Cloudflare envelope shape ({success, errors, result}). */
function cfOk(result: unknown, status = 200): Response {
  return jsonResponse({ success: true, errors: [], messages: [], result }, status);
}

const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const u = new URL(url);

  // ── Resend ──
  if (u.host === "api.resend.com") {
    const byId = u.pathname.match(/^\/domains\/(.+)$/);
    if (u.pathname === "/domains" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
      const name = (body.name ?? "").toLowerCase();
      const id = `dom-${SUFFIX}`;
      RESEND_REGISTERED.set(id, { id, name });
      // Records carry the subdomain in their names, like the real API.
      const records = SAMPLE_RECORDS.map((r) => ({ ...r, name: r.type === "MX" ? name : `resend._domainkey.${name}` }));
      return jsonResponse({ id, name, status: "pending", records }, 201);
    }
    if (u.pathname === "/domains" && method === "GET") {
      // List endpoint — used by the resolver's name-based status check.
      const data = [...RESEND_REGISTERED.values()].map((d) => ({ name: d.name, status: resendStatus }));
      return jsonResponse({ data });
    }
    if (byId && method === "GET") {
      const id = decodeURIComponent(byId[1]);
      const d = RESEND_REGISTERED.get(id);
      if (!d) return jsonResponse({ message: "Domain not found" }, 404);
      return jsonResponse({ id: d.id, name: d.name, status: resendStatus, records: SAMPLE_RECORDS });
    }
    if (byId && method === "DELETE") {
      RESEND_REGISTERED.delete(decodeURIComponent(byId[1]));
      return jsonResponse({ id: decodeURIComponent(byId[1]), object: "domain", deleted: true });
    }
    throw new Error(`unhandled Resend call: ${method} ${url}`);
  }

  // ── Cloudflare ──
  if (u.host === "api.cloudflare.com") {
    const recById = u.pathname.match(/\/dns_records\/(.+)$/);
    if (u.pathname.endsWith("/dns_records") && method === "GET") {
      // findDnsRecords — return matching tracked records (none on first run).
      const name = (u.searchParams.get("name") ?? "").toLowerCase();
      const type = (u.searchParams.get("type") ?? "").toUpperCase();
      const matches = [...CF_RECORDS.values()].filter(
        (r) => r.name.toLowerCase() === name && (!type || r.type === type),
      );
      return cfOk(matches);
    }
    if (u.pathname.endsWith("/dns_records") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { type: string; name: string; content: string };
      const id = `cf-rec-${++cfRecCounter}`;
      const rec = { id, type: body.type, name: body.name, content: body.content };
      CF_RECORDS.set(id, rec);
      return cfOk(rec, 200);
    }
    if (recById && method === "DELETE") {
      const id = recById[1];
      CF_RECORDS.delete(id);
      return cfOk({ id });
    }
    throw new Error(`unhandled Cloudflare call: ${method} ${url}`);
  }

  throw new Error(`unexpected fetch in test: ${method} ${url}`);
});

// ── Helpers ────────────────────────────────────────────────────────────────
function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, { method: opts.method, url: opts.url, headers: { cookie: `${SESSION_COOKIE}=${sid}` }, body: opts.body });
}

/** A minimal brand context with the branded subdomain set, no custom domain. */
function ctxForBranded(tenantId: number, brandedEmailSubdomain: string): SalesBrandContext {
  return {
    tenantId,
    brandName: "Acme Growth",
    tagline: "",
    taglines: [],
    defaultCtaUrl: "",
    chilipiperUrl: "",
    senderName: "Acme Growth",
    senderLocalPart: "",
    sendingDomain: "",
    brandedEmailSubdomain,
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

async function readPersisted(tenantId: number): Promise<Record<string, unknown>> {
  const r = await pool.query<{ config: { salesConsole?: Record<string, unknown> } }>(
    `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  return (r.rows[0]?.config?.salesConsole ?? {}) as Record<string, unknown>;
}

async function seedTenant(slug: string, plan: string, sid: string): Promise<number> {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', $3, '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT BrandedSub ${slug}`, slug, plan],
  );
  const tenantId = t.rows[0].id;
  const sess: AuthUser = {
    userId: 0,
    email: `admin-${slug}@example.com`,
    name: "Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
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
let prevCfToken: string | undefined;
let prevCfZone: string | undefined;

beforeAll(async () => {
  prevApiKey = process.env["RESEND_API_KEY"];
  prevCfToken = process.env["CLOUDFLARE_API_TOKEN"];
  prevCfZone = process.env["CLOUDFLARE_ZONE_ID"];
  process.env["RESEND_API_KEY"] = "re_test_key";
  process.env["CLOUDFLARE_API_TOKEN"] = "cf_test_token";
  process.env["CLOUDFLARE_ZONE_ID"] = "zone_test_id";
  vi.stubGlobal("fetch", fetchMock);

  growthTenantId = await seedTenant(GROWTH_SLUG, "growth", GROWTH_SID);
  freeTenantId = await seedTenant(FREE_SLUG, "free", FREE_SID);
  expectedSubdomain = deriveBrandedSubdomain(GROWTH_SLUG, growthTenantId);

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use(brandedEmailSubdomainRouter);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const restore = (k: string, v: string | undefined) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
  restore("RESEND_API_KEY", prevApiKey);
  restore("CLOUDFLARE_API_TOKEN", prevCfToken);
  restore("CLOUDFLARE_ZONE_ID", prevCfZone);

  await cleanupTenant(growthTenantId);
  await cleanupTenant(freeTenantId);
  await pool.query(`DELETE FROM app_sessions WHERE sid = ANY($1::text[])`, [[GROWTH_SID, FREE_SID]]).catch(() => {});
  _clearResendDomainStatusCache();
});

describe("branded email subdomain — derive + provision", () => {
  it("GET derives the subdomain before provisioning", async () => {
    const res = await injectAs(GROWTH_SID, { method: "GET", url: "/lp/branded-email-subdomain" });
    expect(res.status).toBe(200);
    const body = res.json as Record<string, any>;
    expect(body.subdomain).toBe(expectedSubdomain);
    expect(body.provisioned).toBe(false);
    expect(body.active).toBe(false);
  });

  it("POST creates the Resend domain, publishes CF DNS, and persists the config", async () => {
    resendStatus = "pending";
    const res = await injectAs(GROWTH_SID, { method: "POST", url: "/lp/branded-email-subdomain" });

    expect(res.status).toBe(201);
    const body = res.json as Record<string, any>;
    expect(body.subdomain).toBe(expectedSubdomain);
    expect(typeof body.domainId).toBe("string");
    expect(body.status).toBe("pending");
    expect(body.active).toBe(false);
    expect(body.provisioned).toBe(true);

    // DNS was published into Cloudflare (one record per Resend record).
    expect(CF_RECORDS.size).toBe(SAMPLE_RECORDS.length);

    // Config persisted onto salesConsole (read-merge-write).
    const persisted = await readPersisted(growthTenantId);
    expect(persisted.brandedEmailSubdomain).toBe(expectedSubdomain);
    expect(persisted.brandedEmailSubdomainId).toBe(body.domainId);
    expect(Array.isArray(persisted.brandedEmailSubdomainDnsRecordIds)).toBe(true);
    expect((persisted.brandedEmailSubdomainDnsRecordIds as string[]).length).toBe(SAMPLE_RECORDS.length);
  });
});

describe("branded email subdomain — fail closed until verified", () => {
  it("resolveTenantSender stays on the shared default while pending", async () => {
    resendStatus = "pending";
    _clearResendDomainStatusCache();
    const sender = await resolveTenantSender(growthTenantId, "sales", {
      ctx: ctxForBranded(growthTenantId, expectedSubdomain),
    });
    expect(sender.usingCustomDomain).toBe(false);
    expect(sender.domain).toBe(SHARED_SENDING_DOMAIN);
  });
});

describe("branded email subdomain — verification (poll by id)", () => {
  it("POST /verify flips to verified/active once Resend reports verified", async () => {
    resendStatus = "verified";
    const res = await injectAs(GROWTH_SID, { method: "POST", url: "/lp/branded-email-subdomain/verify" });
    expect(res.status).toBe(200);
    const body = res.json as Record<string, any>;
    expect(body.status).toBe("verified");
    expect(body.active).toBe(true);
    expect(body.subdomain).toBe(expectedSubdomain);
  });

  it("resolveTenantSender routes through the branded subdomain once verified", async () => {
    resendStatus = "verified";
    _clearResendDomainStatusCache();
    const sender = await resolveTenantSender(growthTenantId, "sales", {
      ctx: ctxForBranded(growthTenantId, expectedSubdomain),
    });
    expect(sender.usingCustomDomain).toBe(true);
    expect(sender.domain).toBe(expectedSubdomain);
    expect(sender.from).toContain(`@${expectedSubdomain}`);
  });
});

describe("branded email subdomain — remove path", () => {
  it("deletes the Resend domain + CF records, clears config, reverts to shared default", async () => {
    const res = await injectAs(GROWTH_SID, { method: "DELETE", url: "/lp/branded-email-subdomain" });
    expect(res.status).toBe(200);
    const body = res.json as Record<string, any>;
    expect(body.provisioned).toBe(false);
    expect(body.active).toBe(false);

    expect(RESEND_REGISTERED.size).toBe(0);
    expect(CF_RECORDS.size).toBe(0);

    const persisted = await readPersisted(growthTenantId);
    expect(persisted.brandedEmailSubdomain).toBeUndefined();
    expect(persisted.brandedEmailSubdomainId).toBeUndefined();
    expect(persisted.brandedEmailSubdomainDnsRecordIds).toBeUndefined();

    _clearResendDomainStatusCache();
    const sender = await resolveTenantSender(growthTenantId, "sales", {
      ctx: ctxForBranded(growthTenantId, ""),
    });
    expect(sender.usingCustomDomain).toBe(false);
    expect(sender.domain).toBe(SHARED_SENDING_DOMAIN);
  });
});

describe("branded email subdomain — plan gating", () => {
  it("returns 402 for a free tenant on every verb", async () => {
    const get = await injectAs(FREE_SID, { method: "GET", url: "/lp/branded-email-subdomain" });
    expect(get.status).toBe(402);
    const post = await injectAs(FREE_SID, { method: "POST", url: "/lp/branded-email-subdomain" });
    expect(post.status).toBe(402);
    const del = await injectAs(FREE_SID, { method: "DELETE", url: "/lp/branded-email-subdomain" });
    expect(del.status).toBe(402);

    const persisted = await readPersisted(freeTenantId);
    expect(persisted.brandedEmailSubdomain).toBeUndefined();
  });
});
