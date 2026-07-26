/**
 * Integration test for form-lead Marketo sync against the UNIFIED store
 * (settings consolidation Phase 2).
 *
 * syncLeadToMarketo used to read the retired lp_integrations 'marketo'
 * provider; it now loads credentials from marketo_connections via
 * marketoService.getFormSyncCredentials. These are the load-bearing semantics:
 *
 *  1. A connected row syncs — EVEN when sync_enabled = false. That flag gates
 *     the bidirectional Sales Console sync (poller + write-backs); migrated
 *     tenants (0119) land with sync_enabled = false and their form leads must
 *     keep flowing.
 *  2. The stored REST/identity endpoints are used verbatim (not re-derived
 *     from the Munchkin ID), and the clientSecret decrypts from its at-rest
 *     envelope before the token call.
 *  3. Per-form field mappings still apply to the outbound payload.
 *  4. A disconnected row does NOT sync (disconnect = master off).
 *  5. perFormEnabled === false short-circuits before any credential read.
 *
 * Real Postgres for the connection row; global fetch is intercepted so no
 * Marketo host is ever contacted (same approach as marketo-service.http.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import { pool } from "@workspace/db";
import { encryptCredential } from "../../lib/encryption";
import { syncLeadToMarketo } from "./integrations";
import type { LeadPayload } from "../../lib/notifications";

const createdTenantIds: number[] = [];
const realFetch = global.fetch;

interface CapturedCall {
  url: string;
  body: unknown;
}
let calls: CapturedCall[] = [];

function mockMarketoFetch() {
  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: `tok-${calls.length}`, expires_in: 3600 }), { status: 200 });
    }
    if (url.includes("/v1/leads.json")) {
      return new Response(
        JSON.stringify({ success: true, result: [{ id: 42, status: "created" }] }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

async function seedTenant(): Promise<number> {
  const slug = `it-mkto-fsync-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Marketo FormSync Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  createdTenantIds.push(r.rows[0].id);
  return r.rows[0].id;
}

async function seedConnection(
  tenantId: number,
  opts: { status: string; syncEnabled: boolean; clientId: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO marketo_connections
       (tenant_id, munchkin_id, rest_endpoint, identity_endpoint, client_id, client_secret, status, sync_enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId,
      `999-FS-${tenantId}`,
      // Deliberately NOT munchkin-derived, so hitting these proves the stored
      // endpoints are used rather than re-derived from the Munchkin ID.
      `https://custom-rest-${tenantId}.example.com/rest`,
      `https://custom-identity-${tenantId}.example.com/identity`,
      opts.clientId,
      encryptCredential("fs-client-secret"),
      opts.status,
      opts.syncEnabled,
    ],
  );
}

function leadPayload(): LeadPayload {
  return {
    leadId: 1,
    pageId: 1,
    pageSlug: "fs-test",
    pageTitle: "FS Test",
    fields: { "Email Address": "lead@example.com", "Full Name": "Pat Lead" },
    submittedAt: new Date().toISOString(),
  } as LeadPayload;
}

beforeAll(() => {
  mockMarketoFetch();
});

beforeEach(() => {
  calls = [];
});

afterAll(async () => {
  global.fetch = realFetch;
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM marketo_connections WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("syncLeadToMarketo (unified marketo_connections store)", () => {
  it("syncs a connected row through its stored endpoints even when sync_enabled=false, applying per-form mappings", async () => {
    const tenantId = await seedTenant();
    // sync_enabled=false = the post-0119 shape of every migrated tenant.
    await seedConnection(tenantId, { status: "connected", syncEnabled: false, clientId: `cid-a-${tenantId}` });

    await syncLeadToMarketo(
      leadPayload(),
      { "Email Address": "email", "Full Name": "firstName" },
      undefined,
      tenantId,
    );

    const tokenCall = calls.find(c => c.url.includes("/oauth/token"));
    const leadCall = calls.find(c => c.url.includes("/v1/leads.json"));
    expect(tokenCall).toBeDefined();
    expect(leadCall).toBeDefined();
    // Stored endpoints, not munchkin-derived ones.
    expect(tokenCall!.url).toContain(`https://custom-identity-${tenantId}.example.com/identity/oauth/token`);
    // Secret decrypted from its envelope before the token call.
    expect(tokenCall!.url).toContain("client_secret=fs-client-secret");
    expect(leadCall!.url).toBe(`https://custom-rest-${tenantId}.example.com/rest/v1/leads.json`);
    // Per-form mappings applied.
    const body = leadCall!.body as { action: string; input: Array<Record<string, unknown>> };
    expect(body.action).toBe("createOrUpdate");
    expect(body.input[0]).toEqual({ email: "lead@example.com", firstName: "Pat Lead" });
  });

  it("does not sync when the connection is disconnected", async () => {
    const tenantId = await seedTenant();
    await seedConnection(tenantId, { status: "disconnected", syncEnabled: true, clientId: `cid-b-${tenantId}` });

    await syncLeadToMarketo(leadPayload(), undefined, undefined, tenantId);
    expect(calls).toHaveLength(0);
  });

  it("does not sync when there is no connection at all", async () => {
    const tenantId = await seedTenant();
    await syncLeadToMarketo(leadPayload(), undefined, undefined, tenantId);
    expect(calls).toHaveLength(0);
  });

  it("per-form opt-out short-circuits before any network call", async () => {
    const tenantId = await seedTenant();
    await seedConnection(tenantId, { status: "connected", syncEnabled: true, clientId: `cid-c-${tenantId}` });

    await syncLeadToMarketo(leadPayload(), undefined, false, tenantId);
    expect(calls).toHaveLength(0);
  });
});
