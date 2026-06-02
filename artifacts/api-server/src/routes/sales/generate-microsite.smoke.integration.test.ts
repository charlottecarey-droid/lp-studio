/**
 * Critical-path smoke test for the AI microsite generator
 * (POST /sales/accounts/:accountId/generate-microsite). Pre-launch audit S7.
 *
 * Goal: catch a "this whole feature is broken" regression — route unmounted,
 * 500, or cross-tenant leak — NOT exhaustive AI-output quality.
 *
 * The OpenAI client is mocked (vi.mock("openai")) to return a deterministic
 * block array, so the suite is fast, free, and offline. Everything else runs
 * for real: in-process inject() against the REAL Postgres pool, real
 * requireAuth, real DB reads/writes (account + brand lookup, draft page
 * insert). Each test seeds + tears down its own growth tenant, session, brand
 * settings, account, and any generated pages.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

// Deterministic AI response, mutated per test so a generated page can echo the
// seeded account name. vi.hoisted lets the (hoisted) vi.mock factory read it.
const aiState = vi.hoisted(() => ({
  response: { title: "Generated Microsite", slug: "generated-microsite", blocks: [] as unknown[] },
}));

vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify(aiState.response) } }],
        }),
      },
    };
  },
}));

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999820000 + Math.floor(Math.random() * 100000),
    email: "ms-smoke-it@example.com",
    name: "IT Microsite Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-ms-smoke-${randomUUID()}`, sess: JSON.stringify(user) };
}

/** Seed a growth tenant + admin session + a brand row carrying one segment. */
async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Microsite Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  // The route resolves the requested segmentId against this tenant's OWN
  // brand.segments — an unknown id fails closed with a 400, so we must seed one.
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config)
     VALUES ($1, $2::jsonb)`,
    [tenantId, JSON.stringify({ brandName: "IT Brand", segments: [{ id: "general", name: "General Buyers" }] })],
  );

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

beforeAll(() => {
  // getOpenAIClient() returns null without a key (→ 503). The OpenAI ctor is
  // mocked above, so the actual value is irrelevant — it just has to be present.
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Microsite generation smoke", () => {
  it("creates a draft sales page for the tenant with non-empty blocks referencing the account", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Acme Robotics ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    aiState.response = {
      title: `${accountName} — Why Switch`,
      slug: "why-switch",
      blocks: [
        { type: "hero", props: { headline: `Built for ${accountName}`, subheadline: "Tailored to you" } },
        { type: "benefits-grid", props: { items: [{ icon: "Zap", title: "Fast", description: "Quick wins" }] } },
        { type: "bottom-cta", props: { headline: "Ready?", ctaText: "Book a demo" } },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      page: { id: number; tenantId: number; status: string; mode: string; accountId: number };
      blocks: Array<{ type: string; props: Record<string, unknown> }>;
    };

    // A real draft page was persisted, scoped to THIS tenant + account.
    expect(body.page.id).toBeGreaterThan(0);
    expect(body.page.status).toBe("draft");
    expect(body.page.mode).toBe("sales");
    expect(body.page.accountId).toBe(accountId);

    const dbRow = await pool.query<{ tenant_id: number; status: string; account_id: number; blocks: unknown }>(
      `SELECT tenant_id, status, account_id, blocks FROM lp_pages WHERE id = $1`,
      [body.page.id],
    );
    expect(dbRow.rows[0].tenant_id).toBe(tenantId);
    expect(dbRow.rows[0].status).toBe("draft");
    expect(dbRow.rows[0].account_id).toBe(accountId);

    // Non-empty blocks that reference the account.
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks.length).toBeGreaterThan(0);
    expect(JSON.stringify(body.blocks)).toContain(accountName);
  });

  it("refuses cross-tenant generation: tenant B cannot generate against tenant A's account", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const accountA = await seedAccount(a.tenantId, "Tenant A Secret Co");

    aiState.response = {
      title: "Should never persist",
      slug: "should-never-persist",
      blocks: [{ type: "hero", props: { headline: "x" } }],
    };

    const res = await authed(b.sid, "POST", `/sales/accounts/${accountA}/generate-microsite`, {
      segmentId: "general",
    });

    // Account is invisible to tenant B → 404, never a 200 with a generated page.
    expect(res.status).toBe(404);
    expect(res.status).not.toBe(200);

    // And nothing leaked into B's pages.
    const leaked = await pool.query(
      `SELECT id FROM lp_pages WHERE tenant_id = $1 AND account_id = $2`,
      [b.tenantId, accountA],
    );
    expect(leaked.rows).toHaveLength(0);
  });

  it("returns 404 for a non-existent account", async () => {
    const { sid } = await seedTenant();
    const res = await authed(sid, "POST", `/sales/accounts/2000000001/generate-microsite`, {
      segmentId: "general",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the segmentId is unknown to the tenant's brand", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountId = await seedAccount(tenantId, "Bad Segment Co");
    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "does-not-exist",
    });
    expect(res.status).toBe(400);
  });
});
