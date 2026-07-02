/**
 * Integration test for the branded email-subdomain DNS drift reconcile poller
 * (Task #794).
 *
 * The poller periodically re-derives each provisioned tenant's required Resend
 * records and re-publishes any that have drifted out of our Cloudflare zone.
 * This test pins the two pieces the per-tenant reconcile routine's own test
 * (branded-email-subdomain.integration.test.ts) doesn't cover:
 *
 *   - the scan SQL selects ACTIVE tenants that have a brandedEmailSubdomainId,
 *   - a full sweep repairs drift for such a tenant (a record deleted
 *     out-of-band is re-created) and is idempotent on a second pass.
 *
 * Resend + Cloudflare are mocked via global `fetch`. Unknown Resend domain ids
 * (i.e. any OTHER real tenant the global sweep happens to visit) resolve to a
 * 404 → the reconcile fails closed and touches nothing, so the sweep is safe to
 * run against the shared DB. Config persistence runs against the real Postgres.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { runBrandedSubdomainReconcile, startBrandedSubdomainReconcilePoller } from "./brandedSubdomainReconcilePoller";

const SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const SLUG = `it-brandedsub-poll-${SUFFIX}`;
const DOMAIN_ID = `dom-poll-${SUFFIX}`;
const SUBDOMAIN = `mail.${SLUG}.lpstudio.ai`;

let tenantId: number;

// Required Resend records for the subdomain (name carries the subdomain, like
// the real API). Content is what must be live in Cloudflare.
const REQUIRED = [
  { type: "MX", name: SUBDOMAIN, value: "feedback-smtp.us-east-1.amazonses.com", ttl: "Auto", priority: 10, status: "verified" },
  { type: "TXT", name: `resend._domainkey.${SUBDOMAIN}`, value: "p=MIGfMA0POLL", ttl: "Auto", status: "verified" },
];

// Live Cloudflare records, keyed by id. Pre-seeded to match REQUIRED.
const CF_RECORDS = new Map<string, { id: string; type: string; name: string; content: string }>();
let cfRecCounter = 0;

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
function cfOk(result: unknown, status = 200): Response {
  return jsonResponse({ success: true, errors: [], messages: [], result }, status);
}

const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const u = new URL(url);

  if (u.host === "api.resend.com") {
    const byId = u.pathname.match(/^\/domains\/(.+)$/);
    if (byId && method === "GET") {
      const id = decodeURIComponent(byId[1]);
      // Only OUR seeded domain id resolves — any other tenant the sweep visits
      // gets a 404 and is safely skipped (fail closed).
      if (id !== DOMAIN_ID) return jsonResponse({ message: "Domain not found" }, 404);
      return jsonResponse({ id, name: SUBDOMAIN, status: "verified", records: REQUIRED });
    }
    throw new Error(`unhandled Resend call: ${method} ${url}`);
  }

  if (u.host === "api.cloudflare.com") {
    const recById = u.pathname.match(/\/dns_records\/(.+)$/);
    if (u.pathname.endsWith("/dns_records") && method === "GET") {
      const name = (u.searchParams.get("name") ?? "").toLowerCase();
      const type = (u.searchParams.get("type") ?? "").toUpperCase();
      const matches = [...CF_RECORDS.values()].filter(
        (r) => r.name.toLowerCase() === name && (!type || r.type === type),
      );
      return cfOk(matches);
    }
    if (u.pathname.endsWith("/dns_records") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { type: string; name: string; content: string };
      const id = `cf-poll-${++cfRecCounter}`;
      CF_RECORDS.set(id, { id, type: body.type, name: body.name, content: body.content });
      return cfOk({ id }, 200);
    }
    if (recById && method === "DELETE") {
      CF_RECORDS.delete(recById[1]);
      return cfOk({ id: recById[1] });
    }
    throw new Error(`unhandled Cloudflare call: ${method} ${url}`);
  }

  throw new Error(`unexpected fetch in test: ${method} ${url}`);
});

async function readPersistedIds(): Promise<string[]> {
  const r = await pool.query<{ ids: string[] | null }>(
    `SELECT config->'salesConsole'->'brandedEmailSubdomainDnsRecordIds' AS ids
       FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  const raw = r.rows[0]?.ids;
  return Array.isArray(raw) ? (raw as string[]) : [];
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

  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [`IT BrandedSub Poll ${SLUG}`, SLUG],
  );
  tenantId = t.rows[0].id;

  // Seed a provisioned tenant whose CF records are live + tracked.
  const initialIds: string[] = [];
  for (const rec of REQUIRED) {
    const id = `cf-poll-${++cfRecCounter}`;
    CF_RECORDS.set(id, { id, type: rec.type, name: rec.name, content: rec.value });
    initialIds.push(id);
  }
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config)
     VALUES ($1, $2::jsonb)`,
    [
      tenantId,
      JSON.stringify({
        salesConsole: {
          brandedEmailSubdomain: SUBDOMAIN,
          brandedEmailSubdomainId: DOMAIN_ID,
          brandedEmailSubdomainDnsRecordIds: initialIds,
        },
      }),
    ],
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  const restore = (k: string, v: string | undefined) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
  restore("RESEND_API_KEY", prevApiKey);
  restore("CLOUDFLARE_API_TOKEN", prevCfToken);
  restore("CLOUDFLARE_ZONE_ID", prevCfZone);

  await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("branded subdomain reconcile poller", () => {
  it("does not start outside production (gated)", () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(startBrandedSubdomainReconcilePoller()).toBeNull();
  });

  it("a sweep repairs a record deleted out-of-band for a provisioned tenant", async () => {
    // Drift: delete the live DKIM/TXT record.
    const txt = [...CF_RECORDS.values()].find((r) => r.type === "TXT" && r.name === `resend._domainkey.${SUBDOMAIN}`);
    expect(txt).toBeDefined();
    CF_RECORDS.delete(txt!.id);

    await runBrandedSubdomainReconcile();

    // The missing record was re-published — both required records live again.
    const live = [...CF_RECORDS.values()].filter((r) => r.name.endsWith(SUBDOMAIN));
    expect(live.length).toBe(REQUIRED.length);

    // Persisted id set refreshed to the repaired records, no duplicates.
    const ids = await readPersistedIds();
    expect(ids.length).toBe(REQUIRED.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is idempotent — a second sweep changes nothing", async () => {
    const before = CF_RECORDS.size;
    const idsBefore = await readPersistedIds();
    await runBrandedSubdomainReconcile();
    expect(CF_RECORDS.size).toBe(before);
    expect(await readPersistedIds()).toEqual(idsBefore);
  });
});
