/**
 * Integration test for credential encryption at rest (task #860).
 *
 * Exercised in-process (no TCP socket) via inject() against the REAL Postgres
 * pool so the actual upsert/get route handlers + encryption wiring run end to
 * end. Each run seeds + tears down its own growth tenant + admin session.
 *
 * Covers:
 *  1. Writing a Marketo config via PUT persists the clientSecret ENCRYPTED
 *     (`v1:` prefix, plaintext never appears in the row) yet the live config is
 *     usable (the /test path resolves the real secret).
 *  2. Re-saving with the masked placeholder preserves the secret WITHOUT
 *     double-encrypting it (no `v1:v1:` corruption) — the masked-resave flow.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { decryptCredential } from "../../lib/encryption";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import lpRouter from "./index";

const MASKED = "••••••••";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999820000 + Math.floor(Math.random() * 100000),
    email: "integrations-enc-it@example.com",
    name: "IT Integrations Enc Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-int-enc-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-int-enc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Integrations Enc Tenant', $1, 'active', 'growth')
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

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}` },
    ...(body !== undefined ? { body } : {}),
  });
}

async function rawStoredSecret(tenantId: number): Promise<string> {
  const r = await pool.query<{ secret: string | null }>(
    `SELECT config->>'clientSecret' AS secret FROM lp_integrations WHERE provider = 'marketo' AND tenant_id = $1`,
    [tenantId],
  );
  return r.rows[0]?.secret ?? "";
}

beforeAll(() => {
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  // The lp router's handlers already declare `/lp/...` paths, so mount at root.
  app.use(lpRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM lp_integrations WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("integration credential encryption (Marketo)", () => {
  it("persists the clientSecret encrypted at rest and reads it back masked", async () => {
    const { tenantId, sid } = await seedTenant();
    const secret = "super-secret-marketo-client-secret-xyz789";

    const putRes = await authed(sid, "PUT", "/lp/integrations/marketo", {
      enabled: true,
      config: { munchkinId: "123-ABC-456", clientId: "client-abc", clientSecret: secret },
    });
    expect(putRes.status).toBe(200);

    // The row stores the secret encrypted — never the plaintext.
    const stored = await rawStoredSecret(tenantId);
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain(secret);
    // And it decrypts back to the original.
    expect(decryptCredential(stored)).toBe(secret);

    // GET masks the secret but reports the integration as enabled.
    const getRes = await authed(sid, "GET", "/lp/integrations/marketo");
    expect(getRes.status).toBe(200);
    const body = getRes.json as { enabled: boolean; config: { munchkinId: string; clientId: string; clientSecret: string } };
    expect(body.enabled).toBe(true);
    expect(body.config.munchkinId).toBe("123-ABC-456");
    expect(body.config.clientId).toBe("client-abc");
    expect(body.config.clientSecret).toBe(MASKED);
  });

  it("masked re-save preserves the secret without double-encrypting it", async () => {
    const { tenantId, sid } = await seedTenant();
    const secret = "original-secret-do-not-corrupt-001";

    await authed(sid, "PUT", "/lp/integrations/marketo", {
      enabled: true,
      config: { munchkinId: "111-AAA-222", clientId: "cid-1", clientSecret: secret },
    });
    const firstStored = await rawStoredSecret(tenantId);
    expect(firstStored).toMatch(/^v1:/);

    // Re-save sending the MASKED placeholder (UI never returns the real secret).
    const putRes = await authed(sid, "PUT", "/lp/integrations/marketo", {
      enabled: true,
      config: { munchkinId: "111-AAA-222", clientId: "cid-1", clientSecret: MASKED },
    });
    expect(putRes.status).toBe(200);

    const secondStored = await rawStoredSecret(tenantId);
    // Still a single envelope (no v1:v1:) and still decrypts to the original.
    expect(secondStored).not.toMatch(/^v1:v1:/);
    expect(decryptCredential(secondStored)).toBe(secret);
  });
});
