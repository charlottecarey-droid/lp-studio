/**
 * Integration test for hotlink attribution on the dwell beacon
 * (POST /lp/track/dwell with an optional `hlToken`).
 *
 * The viewer forwards the raw ?hl= token with each dwell flush; the server
 * re-resolves it (never trusting a client-sent numeric id) and stamps
 * lp_page_visits.hotlink_id ONLY when the hotlink actually points at the
 * page being reported. COALESCE semantics: the first attribution wins — a
 * replay with a different token can't re-attribute the session.
 *
 * Covers:
 *  1. Valid token for the visited page → dwell merged AND hotlink_id stamped.
 *  2. Token whose hotlink points at a DIFFERENT page → dwell merged, no stamp.
 *  3. Replay with a second (also valid) token → original attribution kept.
 *
 * Exercised in-process via inject() against the REAL Postgres pool.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import trackingRouter from "./tracking";

let app: Express;
const createdTenantIds: number[] = [];
const createdPageIds: number[] = [];

async function seedTenantAndPage(): Promise<{ tenantId: number; pageId: number }> {
  const slug = `it-dwellhl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Dwell Hotlink Tenant', $1, 'active', 'growth') RETURNING id`,
    [slug],
  );
  createdTenantIds.push(t.rows[0].id);
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, mode)
     VALUES ($1, 'IT Dwell Hotlink Page', $2, 'published', 'sales') RETURNING id`,
    [t.rows[0].id, `${slug}-page`],
  );
  createdPageIds.push(p.rows[0].id);
  return { tenantId: t.rows[0].id, pageId: p.rows[0].id };
}

async function seedHotlink(tenantId: number, pageId: number): Promise<{ id: number; token: string }> {
  const token = `it-hl-${randomUUID()}`.slice(0, 32);
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_hotlinks (tenant_id, token, page_id) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, token, pageId],
  );
  return { id: r.rows[0].id, token };
}

async function seedVisit(pageId: number, sessionId: string): Promise<void> {
  await pool.query(
    `INSERT INTO lp_page_visits (page_id, session_id) VALUES ($1, $2)`,
    [pageId, sessionId],
  );
}

async function readVisit(pageId: number, sessionId: string): Promise<{ dwell_seconds: number | null; hotlink_id: number | null }> {
  const r = await pool.query<{ dwell_seconds: number | null; hotlink_id: number | null }>(
    `SELECT dwell_seconds, hotlink_id FROM lp_page_visits WHERE page_id = $1 AND session_id = $2`,
    [pageId, sessionId],
  );
  return r.rows[0];
}

function postDwell(body: Record<string, unknown>) {
  return inject(app, { method: "POST", url: "/lp/track/dwell", body });
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(trackingRouter);
});

afterAll(async () => {
  // Visits + hotlinks cascade off lp_pages; pages cascade off tenants, but
  // delete pages first anyway so partial teardown never strands rows.
  for (const id of createdPageIds) {
    await pool.query(`DELETE FROM lp_pages WHERE id = $1`, [id]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("POST /lp/track/dwell hotlink attribution", () => {
  it("stamps hotlink_id when the token's hotlink points at the reported page", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    const hl = await seedHotlink(tenantId, pageId);
    const sessionId = `it-sess-${randomUUID()}`;
    await seedVisit(pageId, sessionId);

    const res = await postDwell({ pageId, sessionId, seconds: 12, hlToken: hl.token });
    expect(res.status).toBe(200);

    const visit = await readVisit(pageId, sessionId);
    expect(visit.dwell_seconds).toBe(12);
    expect(visit.hotlink_id).toBe(hl.id);
  });

  it("does NOT stamp a token whose hotlink points at a different page", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    const { pageId: otherPageId } = await seedTenantAndPage();
    const foreign = await seedHotlink(tenantId, otherPageId);
    const sessionId = `it-sess-${randomUUID()}`;
    await seedVisit(pageId, sessionId);

    const res = await postDwell({ pageId, sessionId, seconds: 8, hlToken: foreign.token });
    expect(res.status).toBe(200);

    const visit = await readVisit(pageId, sessionId);
    expect(visit.dwell_seconds).toBe(8); // dwell still merged
    expect(visit.hotlink_id).toBeNull(); // attribution refused
  });

  it("keeps the first attribution when a replay carries a different token", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    const first = await seedHotlink(tenantId, pageId);
    const second = await seedHotlink(tenantId, pageId);
    const sessionId = `it-sess-${randomUUID()}`;
    await seedVisit(pageId, sessionId);

    await postDwell({ pageId, sessionId, seconds: 5, hlToken: first.token });
    const replay = await postDwell({ pageId, sessionId, seconds: 20, hlToken: second.token });
    expect(replay.status).toBe(200);

    const visit = await readVisit(pageId, sessionId);
    expect(visit.dwell_seconds).toBe(20); // MAX-merge still applies
    expect(visit.hotlink_id).toBe(first.id); // COALESCE keeps the original
  });
});
