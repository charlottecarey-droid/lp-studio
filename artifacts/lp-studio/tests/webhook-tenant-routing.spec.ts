// Tenant-aware webhook routing (task #147).
//
// What we want to prove
// ─────────────────────
// The three public webhook endpoints (/webhooks/rb2b, /webhooks/apollo,
// /webhooks/letterdrop) used to hardcode tenant_id=1 (Dandy) for every
// inserted signal. As of #147 the URL embeds a per-tenant secret so the
// handler can resolve the correct tenant. This spec asserts:
//
//   • A POST with a known secret returns 201 and writes a sales_signals row
//     scoped to the secret's tenant — NOT to Dandy (#1).
//   • A POST with an unknown secret returns 404 with no body so an attacker
//     can't probe which integrations a tenant has wired up.
//   • All three integrations (rb2b/apollo/letterdrop) follow the same rule.
//
// We deliberately exercise the live API server so the regex allowlist in
// routes/index.ts (`/^\/webhooks\//`), the route mount, and the DB query
// path are all in scope.

import pg from "pg";
import { randomBytes } from "node:crypto";
import { test, expect, request as pwRequest } from "@playwright/test";

const { Pool } = pg;

interface WebhookTenant {
  tenantId: number;
  slug: string;
  secrets: Record<"rb2b" | "apollo" | "letterdrop", string>;
}

function getDatabaseUrl(): string {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("NEON_DATABASE_URL / DATABASE_URL must be set");
  return url;
}

async function createWebhookTenant(pool: pg.Pool): Promise<WebhookTenant> {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const slug = `webhook-test-${suffix}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Use a non-localhost domain so this fixture can never collide with
    // royal-tenant.ts (which registers tenants.domain="localhost").
    const tenantRes = await client.query<{ id: number }>(
      `INSERT INTO tenants (name, slug, domain, plan, status, settings, onboarding_completed_at)
       VALUES ($1, $2, $3, 'trial', 'active', '{"industry":"generic"}'::jsonb, now())
       RETURNING id`,
      [`Webhook Test Tenant ${suffix}`, slug, `${slug}.example.test`],
    );
    const tenantId = tenantRes.rows[0].id;

    const secrets = {
      rb2b: randomBytes(24).toString("base64url"),
      apollo: randomBytes(24).toString("base64url"),
      letterdrop: randomBytes(24).toString("base64url"),
    } as const;

    for (const integration of ["rb2b", "apollo", "letterdrop"] as const) {
      await client.query(
        `INSERT INTO tenant_webhook_secrets (tenant_id, integration, secret)
         VALUES ($1, $2, $3)`,
        [tenantId, integration, secrets[integration]],
      );
    }

    await client.query("COMMIT");
    return { tenantId, slug, secrets };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function cleanupWebhookTenant(pool: pg.Pool, t: WebhookTenant): Promise<void> {
  const client = await pool.connect();
  try {
    // tenant_webhook_secrets cascades on tenant_id, but we're explicit. The
    // signals we inserted carry tenant_id but no FK to tenants(id), so we
    // delete them by tenant_id explicitly.
    await client.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM tenant_webhook_secrets WHERE tenant_id = $1`, [t.tenantId]);
    await client.query(`DELETE FROM tenants WHERE id = $1`, [t.tenantId]);
  } finally {
    client.release();
  }
}

async function purgeStaleWebhookTenants(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM tenants WHERE slug LIKE 'webhook-test-%'`,
    );
    for (const row of rows) {
      await client.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM tenant_webhook_secrets WHERE tenant_id = $1`, [row.id]);
      await client.query(`DELETE FROM tenants WHERE id = $1`, [row.id]);
    }
  } finally {
    client.release();
  }
}

test.describe("tenant-aware webhook routing", () => {
  let pool: pg.Pool;
  let tenant: WebhookTenant;
  // Dedicated request context so we can hit the api-server directly on
  // API_PORT instead of the Vite dev-server proxy. The webhook routes are
  // mounted under `/api` (see api-server `app.ts`).
  let apiBaseURL: string;

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: getDatabaseUrl(), max: 4 });
    await purgeStaleWebhookTenants(pool);
    tenant = await createWebhookTenant(pool);
    const apiPort = process.env.E2E_API_PORT ?? "4319";
    apiBaseURL = `http://127.0.0.1:${apiPort}`;
  });

  test.afterAll(async () => {
    if (tenant && pool) await cleanupWebhookTenant(pool, tenant);
    if (pool) await pool.end();
  });

  test("known rb2b secret routes signal to the correct tenant", async () => {
    const ctx = await pwRequest.newContext({ baseURL: apiBaseURL });
    try {
      const res = await ctx.post(`/api/webhooks/rb2b/${tenant.secrets.rb2b}`, {
        data: {
          properties: {
            firstName: "Smoke",
            lastName: "Test",
            companyName: "WebhookCo",
            companyDomain: "webhookco.example",
            linkedInUrl: `https://www.linkedin.com/in/smoke-${tenant.tenantId}`,
            email: `smoke-${tenant.tenantId}@webhookco.example`,
            pageUrl: "https://example.test/lp/some-page",
          },
        },
      });
      expect(res.status(), `body: ${await res.text()}`).toBe(201);
    } finally {
      await ctx.dispose();
    }

    // Verify the signal landed on the right tenant — NOT Dandy (#1).
    const { rows } = await pool.query<{ tenant_id: number; source: string }>(
      `SELECT tenant_id, source FROM sales_signals
        WHERE tenant_id = $1 AND source = 'rb2b'
        ORDER BY id DESC
        LIMIT 1`,
      [tenant.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(tenant.tenantId);
    expect(rows[0].tenant_id).not.toBe(1);
  });

  test("known apollo + letterdrop secrets route to the correct tenant", async () => {
    const ctx = await pwRequest.newContext({ baseURL: apiBaseURL });
    try {
      const apolloRes = await ctx.post(`/api/webhooks/apollo/${tenant.secrets.apollo}`, {
        data: {
          organization: { name: "WebhookCo", domain: "webhookco.example" },
          visitor: { ip: "1.2.3.4", page_url: "https://example.test/lp/some-page" },
        },
      });
      expect(apolloRes.status(), `body: ${await apolloRes.text()}`).toBe(201);

      const ldRes = await ctx.post(`/api/webhooks/letterdrop/${tenant.secrets.letterdrop}`, {
        data: {
          name: "Smoke Test",
          email: `smoke-ld-${tenant.tenantId}@webhookco.example`,
          domain: "webhookco.example",
        },
      });
      expect(ldRes.status(), `body: ${await ldRes.text()}`).toBe(201);
    } finally {
      await ctx.dispose();
    }

    const { rows } = await pool.query<{ source: string; tenant_id: number }>(
      `SELECT source, tenant_id FROM sales_signals
        WHERE tenant_id = $1 AND source IN ('apollo', 'letterdrop')`,
      [tenant.tenantId],
    );
    const sources = rows.map((r) => r.source).sort();
    expect(sources).toEqual(["apollo", "letterdrop"]);
    for (const r of rows) expect(r.tenant_id).toBe(tenant.tenantId);
  });

  test("account/contact match is tenant-scoped — never cross-links to another tenant", async () => {
    // Seed an account + contact on a SECOND tenant whose company domain and
    // contact email exactly match what we're about to POST to *this*
    // tenant's RB2B webhook. If findAccountByDomain / findContact were not
    // tenant-scoped, the resulting signal would carry the foreign tenant's
    // accountId / contactId — exactly the leak this task is meant to fix.
    const otherSuffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
    const sharedDomain = "sharedco.example";
    const sharedEmail = `lead-${otherSuffix}@${sharedDomain}`;
    const sharedLinkedIn = `https://www.linkedin.com/in/lead-${otherSuffix}`;
    const client = await pool.connect();
    let otherTenantId = 0;
    let otherAccountId = 0;
    let otherContactId = 0;
    try {
      await client.query("BEGIN");
      const t = await client.query<{ id: number }>(
        `INSERT INTO tenants (name, slug, domain, plan, status, settings, onboarding_completed_at)
         VALUES ($1, $2, $3, 'trial', 'active', '{"industry":"generic"}'::jsonb, now())
         RETURNING id`,
        [`Webhook Other ${otherSuffix}`, `webhook-test-other-${otherSuffix}`, `${otherSuffix}.example.test`],
      );
      otherTenantId = t.rows[0].id;
      const a = await client.query<{ id: number }>(
        `INSERT INTO sales_accounts (tenant_id, name, domain, status)
         VALUES ($1, 'Foreign Co', $2, 'prospect') RETURNING id`,
        [otherTenantId, sharedDomain],
      );
      otherAccountId = a.rows[0].id;
      const c = await client.query<{ id: number }>(
        `INSERT INTO sales_contacts (tenant_id, account_id, first_name, last_name, email, linkedin_url)
         VALUES ($1, $2, 'Foreign', 'Lead', $3, $4) RETURNING id`,
        [otherTenantId, otherAccountId, sharedEmail, sharedLinkedIn],
      );
      otherContactId = c.rows[0].id;
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    try {
      const ctx = await pwRequest.newContext({ baseURL: apiBaseURL });
      try {
        const res = await ctx.post(`/api/webhooks/rb2b/${tenant.secrets.rb2b}`, {
          data: {
            properties: {
              firstName: "Isolation",
              lastName: "Probe",
              companyDomain: sharedDomain,
              email: sharedEmail,
              linkedInUrl: sharedLinkedIn,
              pageUrl: "https://example.test/lp/some-page",
            },
          },
        });
        expect(res.status(), `body: ${await res.text()}`).toBe(201);
      } finally {
        await ctx.dispose();
      }

      // The newest rb2b signal on *this* tenant must carry NULL account/contact
      // (no matching rows in this tenant's sales tables) — never the foreign
      // tenant's IDs.
      const { rows } = await pool.query<{
        tenant_id: number;
        account_id: number | null;
        contact_id: number | null;
      }>(
        `SELECT tenant_id, account_id, contact_id
           FROM sales_signals
          WHERE tenant_id = $1 AND source = 'rb2b'
            AND metadata::jsonb ->> 'firstName' = 'Isolation'
          ORDER BY id DESC
          LIMIT 1`,
        [tenant.tenantId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe(tenant.tenantId);
      expect(rows[0].account_id).toBeNull();
      expect(rows[0].contact_id).toBeNull();
      // And the foreign tenant must not have received any signal at all.
      const { rows: foreignSignals } = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM sales_signals WHERE tenant_id = $1`,
        [otherTenantId],
      );
      expect(foreignSignals[0].count).toBe("0");
    } finally {
      const cleanup = await pool.connect();
      try {
        await cleanup.query(`DELETE FROM sales_signals WHERE tenant_id = $1`, [otherTenantId]);
        await cleanup.query(`DELETE FROM sales_contacts WHERE tenant_id = $1`, [otherTenantId]);
        await cleanup.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [otherTenantId]);
        await cleanup.query(`DELETE FROM tenants WHERE id = $1`, [otherTenantId]);
      } finally {
        cleanup.release();
      }
    }
  });

  test("unknown webhook secret returns 404 with no body for every integration", async () => {
    const bogusSecret = randomBytes(24).toString("base64url");
    const ctx = await pwRequest.newContext({ baseURL: apiBaseURL });
    try {
      for (const integration of ["rb2b", "apollo", "letterdrop"] as const) {
        const res = await ctx.post(`/api/webhooks/${integration}/${bogusSecret}`, {
          data: { properties: { firstName: "Should", lastName: "Reject" } },
        });
        expect(res.status(), `${integration} should 404 on unknown secret`).toBe(404);
        // No body — protects against integration-presence enumeration.
        expect((await res.text()).length).toBe(0);
      }
    } finally {
      await ctx.dispose();
    }

    // No signal should have leaked into Dandy (#1) — i.e. we did not silently
    // fall back to the old hardcoded tenant.
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM sales_signals
        WHERE tenant_id = 1
          AND created_at > now() - interval '30 seconds'
          AND metadata::jsonb ->> 'firstName' = 'Should'`,
    );
    expect(rows[0].count).toBe("0");
  });
});
