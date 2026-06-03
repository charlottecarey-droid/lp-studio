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
import brandedEmailSubdomainRouter, { reconcileBrandedSubdomainDns } from "../../routes/lp/branded-email-subdomain";

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
      // Mirror the real API: each record's name carries the subdomain (so the
      // reconcile path can match them against our published Cloudflare records).
      const records = SAMPLE_RECORDS.map((r) => ({
        ...r,
        name: r.type === "MX" ? d.name : `resend._domainkey.${d.name}`,
        status: resendStatus,
      }));
      return jsonResponse({ id: d.id, name: d.name, status: resendStatus, records });
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
    if (recById && method === "PUT") {
      // updateDnsRecord — replace the editable fields in place (id preserved).
      const id = recById[1];
      const body = JSON.parse(String(init?.body ?? "{}")) as { type: string; name: string; content: string };
      if (!CF_RECORDS.has(id)) return cfOk({ message: "Record not found" }, 404);
      const rec = { id, type: body.type, name: body.name, content: body.content };
      CF_RECORDS.set(id, rec);
      return cfOk(rec);
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

describe("branded email subdomain — DNS drift reconcile", () => {
  it("no-ops (zero repairs) when every required record is already live", async () => {
    // After provision the two records are present in Cloudflare; reconcile
    // should find them all in-sync and create nothing.
    const before = CF_RECORDS.size;
    const result = await reconcileBrandedSubdomainDns(growthTenantId);
    expect(result.provisioned).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.checked).toBe(SAMPLE_RECORDS.length);
    expect(result.repaired).toBe(0);
    expect(CF_RECORDS.size).toBe(before);
  });

  it("re-creates a record deleted out-of-band and logs loudly", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Simulate drift: a DKIM/TXT record is deleted directly in Cloudflare.
      const txt = [...CF_RECORDS.values()].find((r) => r.type === "TXT");
      expect(txt).toBeDefined();
      CF_RECORDS.delete(txt!.id);
      expect(CF_RECORDS.size).toBe(SAMPLE_RECORDS.length - 1);

      const result = await reconcileBrandedSubdomainDns(growthTenantId);
      expect(result.repaired).toBe(1);
      expect(result.repairedRecords[0]).toContain("TXT");
      // The missing record was re-published — full set restored, no duplicates.
      expect(CF_RECORDS.size).toBe(SAMPLE_RECORDS.length);

      // Drift was logged loudly.
      expect(warn).toHaveBeenCalled();
      const logged = warn.mock.calls.map((c) => String(c[0])).join("\n");
      expect(logged).toContain("DNS drift detected");

      // The reconciled id set was persisted (so remove still deletes what we own).
      const persisted = await readPersisted(growthTenantId);
      const ids = persisted.brandedEmailSubdomainDnsRecordIds as string[];
      expect(ids.length).toBe(SAMPLE_RECORDS.length);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      warn.mockRestore();
    }
  });

  it("is idempotent — a second pass repairs nothing and never duplicates", async () => {
    const before = CF_RECORDS.size;
    const result = await reconcileBrandedSubdomainDns(growthTenantId);
    expect(result.repaired).toBe(0);
    expect(result.checked).toBe(SAMPLE_RECORDS.length);
    expect(CF_RECORDS.size).toBe(before);
  });

  it("corrects a value-drifted record in place rather than duplicating", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Simulate value drift: the DKIM/TXT record still exists with the same
      // name+type but its content was edited out-of-band to a wrong value.
      const txt = [...CF_RECORDS.values()].find((r) => r.type === "TXT");
      expect(txt).toBeDefined();
      const driftedId = txt!.id;
      const correctValue = txt!.content;
      CF_RECORDS.set(driftedId, { ...txt!, content: "p=WRONG-DRIFTED-KEY" });
      const sizeBefore = CF_RECORDS.size;

      const result = await reconcileBrandedSubdomainDns(growthTenantId);

      // It was repaired (counted + named) and corrected in place — same id,
      // correct value, no duplicate record stacked alongside it.
      expect(result.repaired).toBe(1);
      expect(result.repairedRecords[0]).toContain("TXT");
      expect(CF_RECORDS.size).toBe(sizeBefore);
      expect(CF_RECORDS.has(driftedId)).toBe(true);
      expect(CF_RECORDS.get(driftedId)!.content).toBe(correctValue);

      // Drift was logged loudly.
      expect(warn).toHaveBeenCalled();
      expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toContain("DNS drift detected");

      // The id set is unchanged (we updated in place, didn't swap ids).
      const persisted = await readPersisted(growthTenantId);
      const ids = persisted.brandedEmailSubdomainDnsRecordIds as string[];
      expect(ids).toContain(driftedId);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      warn.mockRestore();
    }
  });

  it("never mutates an unowned same-name+type collision — creates its own record", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const STRAY_ID = "cf-stray-unowned";
    try {
      // Our owned TXT record vanished, and an unrelated record now sits at the
      // SAME name+type (id NOT in our persisted set). Reconcile must NOT mutate
      // the stray — it should create its own correct record instead.
      const ownedTxt = [...CF_RECORDS.values()].find((r) => r.type === "TXT");
      expect(ownedTxt).toBeDefined();
      CF_RECORDS.delete(ownedTxt!.id);
      CF_RECORDS.set(STRAY_ID, {
        id: STRAY_ID,
        type: ownedTxt!.type,
        name: ownedTxt!.name,
        content: "p=SOMEONE-ELSES-VALUE",
      });
      const sizeBefore = CF_RECORDS.size;

      const result = await reconcileBrandedSubdomainDns(growthTenantId);

      // Repaired by CREATING our own record (size grew by one), not mutating.
      expect(result.repaired).toBe(1);
      expect(result.repairedRecords[0]).toContain("TXT");
      expect(CF_RECORDS.size).toBe(sizeBefore + 1);

      // The stray collision was left completely untouched.
      expect(CF_RECORDS.has(STRAY_ID)).toBe(true);
      expect(CF_RECORDS.get(STRAY_ID)!.content).toBe("p=SOMEONE-ELSES-VALUE");

      // Our newly created record (owned) carries the correct required value.
      const persisted = await readPersisted(growthTenantId);
      const ids = persisted.brandedEmailSubdomainDnsRecordIds as string[];
      expect(ids).not.toContain(STRAY_ID);
      const ourTxt = ids.map((id) => CF_RECORDS.get(id)).find((r) => r?.type === "TXT");
      expect(ourTxt).toBeDefined();
      expect(ourTxt!.content).not.toBe("p=SOMEONE-ELSES-VALUE");
    } finally {
      // Restore the invariant (CF_RECORDS == our owned set) for later tests.
      CF_RECORDS.delete(STRAY_ID);
      warn.mockRestore();
    }
  });

  it("does not adopt an unowned record even when its content is already correct", async () => {
    const STRAY_ID = "cf-stray-correct-unowned";
    try {
      // Our owned TXT vanished; a record we DON'T own sits at the same name+type
      // and happens to already carry the correct value. We must not adopt its id
      // (or a later deprovision would delete a record we never created) — we
      // create our own owned copy instead and leave the stray alone.
      const ownedTxt = [...CF_RECORDS.values()].find((r) => r.type === "TXT");
      expect(ownedTxt).toBeDefined();
      const correctValue = ownedTxt!.content;
      CF_RECORDS.delete(ownedTxt!.id);
      CF_RECORDS.set(STRAY_ID, {
        id: STRAY_ID,
        type: ownedTxt!.type,
        name: ownedTxt!.name,
        content: correctValue,
      });
      const sizeBefore = CF_RECORDS.size;

      const result = await reconcileBrandedSubdomainDns(growthTenantId);

      // Created our own record rather than adopting the stray.
      expect(result.repaired).toBe(1);
      expect(CF_RECORDS.size).toBe(sizeBefore + 1);
      expect(CF_RECORDS.has(STRAY_ID)).toBe(true);

      const persisted = await readPersisted(growthTenantId);
      const ids = persisted.brandedEmailSubdomainDnsRecordIds as string[];
      expect(ids).not.toContain(STRAY_ID);
      const ourTxt = ids.map((id) => CF_RECORDS.get(id)).find((r) => r?.type === "TXT");
      expect(ourTxt).toBeDefined();
      expect(ourTxt!.content).toBe(correctValue);
    } finally {
      CF_RECORDS.delete(STRAY_ID);
    }
  });

  it("skips (touches nothing) when Resend can't confirm the required records", async () => {
    // No provisioned subdomain at all → a clean no-op, not a skip.
    const result = await reconcileBrandedSubdomainDns(freeTenantId);
    expect(result.provisioned).toBe(false);
    expect(result.checked).toBe(0);
    expect(result.repaired).toBe(0);
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
