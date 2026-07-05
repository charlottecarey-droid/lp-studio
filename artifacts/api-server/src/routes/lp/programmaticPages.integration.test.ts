/**
 * Integration tests for the programmatic-pages routes (July 2026 fix).
 *
 * Pins three contracts:
 *   1. GET /lp/programmatic/dtr-rules/:pageId hides internal `__` keys
 *      (e.g. __linkedFormStyle written by the editor into the same jsonb)
 *      and detects {{tokens}} used in blocks but never declared.
 *   2. PUT /lp/programmatic/dtr-rules/:pageId preserves existing `__` keys —
 *      the client rebuilds the map from visible rules only, and saving a
 *      variable must never wipe editor state (this was a live data-loss bug).
 *   3. POST /lp/programmatic/bulk-generate merges the template's defaults
 *      under each row's per-page values.
 *
 * Exercised in-process via inject() against the REAL Postgres pool (mirrors
 * the sales-route integration suites).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, optionalAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import programmaticRouter from "./programmatic-pages";

const RUN = randomUUID().slice(0, 8);
const TENANT_SLUG = `it-progpages-${RUN}`;
const SID = `it-progpages-${RUN}`;

let tenantId: number;
let pageId: number;
let app: Express;

function injectSid(opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body: opts.body,
  });
}

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
  }
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  if (tenantId) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT ProgPages Tenant', $1, 'active') RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  const user: AuthUser = {
    userId: 999300001,
    email: `progpages-it-${RUN}@example.com`,
    name: "IT",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, JSON.stringify(user)],
  );

  // Template page: one declared variable + one internal key in pageVariables,
  // plus a block using an UNDECLARED {{city}} token (must be "detected").
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, is_template, page_variables)
     VALUES ($1, 'IT ProgPages Template', $2, $3, 'draft', true, $4)
     RETURNING id`,
    [
      tenantId,
      `it-progpages-tpl-${RUN}`,
      JSON.stringify([{ id: "b1", type: "hero", props: { headline: "Hi {{company}}, welcome to {{city}}" } }]),
      JSON.stringify({ company: "Acme", __linkedFormStyle: "pill" }),
    ],
  );
  pageId = p.rows[0].id;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(optionalAuth);
  app.use(programmaticRouter);
});

afterAll(async () => {
  if (!dbAvailable) return;
  await cleanup();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("GET /lp/programmatic/dtr-rules/:pageId", () => {
  it("hides internal __ keys and detects undeclared block tokens", async () => {
    const res = await injectSid({ method: "GET", url: `/lp/programmatic/dtr-rules/${pageId}` });
    expect(res.status).toBe(200);
    const rules = (res.json as { rules: Array<{ variable: string; source: string; defaultValue: string }> }).rules;
    const byName = Object.fromEntries(rules.map(r => [r.variable, r]));
    expect(byName["__linkedFormStyle"]).toBeUndefined();
    expect(byName["company"]).toMatchObject({ source: "page_variable", defaultValue: "Acme" });
    expect(byName["city"]).toMatchObject({ source: "detected_in_blocks" });
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("PUT /lp/programmatic/dtr-rules/:pageId", () => {
  it("preserves internal __ keys when the client saves visible variables only", async () => {
    const res = await injectSid({
      method: "PUT",
      url: `/lp/programmatic/dtr-rules/${pageId}`,
      body: { variables: { company: "Globex", city: "Austin" } },
    });
    expect(res.status).toBe(200);

    const { rows } = await pool.query<{ page_variables: Record<string, string> }>(
      `SELECT page_variables FROM lp_pages WHERE id = $1`,
      [pageId],
    );
    expect(rows[0].page_variables).toEqual({
      __linkedFormStyle: "pill",
      company: "Globex",
      city: "Austin",
    });
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /lp/programmatic/bulk-generate", () => {
  it("merges template defaults under per-row values", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/lp/programmatic/bulk-generate",
      body: {
        templateId: pageId,
        rows: [
          { slug: `it-progpages-a-${RUN}`, variables: { company: "RowCo" } },
          { slug: `it-progpages-b-${RUN}`, variables: {} },
        ],
      },
    });
    expect(res.status).toBe(200);
    const body = res.json as { pagesGenerated: number; created: Array<{ id: number; slug: string }> };
    expect(body.pagesGenerated).toBe(2);

    const { rows } = await pool.query<{ slug: string; page_variables: Record<string, string> }>(
      `SELECT slug, page_variables FROM lp_pages WHERE id = ANY($1::int[]) ORDER BY slug`,
      [body.created.map(c => c.id)],
    );
    const a = rows.find(r => r.slug === `it-progpages-a-${RUN}`);
    const b = rows.find(r => r.slug === `it-progpages-b-${RUN}`);
    // Row value wins over template default; untouched keys inherit.
    expect(a?.page_variables.company).toBe("RowCo");
    expect(a?.page_variables.city).toBe("Austin");
    // Row with no overrides inherits every template default.
    expect(b?.page_variables.company).toBe("Globex");
    expect(b?.page_variables.city).toBe("Austin");
  });
});
