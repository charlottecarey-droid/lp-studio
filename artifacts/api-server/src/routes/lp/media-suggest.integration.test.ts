/**
 * Integration test for POST /lp/media/suggest — the "Auto-fill from library"
 * endpoint that powers a product's content images in Brand Settings.
 *
 * Runs the REAL storage router against the REAL Postgres pool, injecting
 * requests IN-PROCESS (the vitest worker pool can't bind a port — see
 * test-utils/injectRequest). The full middleware chain runs (cookie-parser,
 * body parsing, requireAuth, the POST /lp/media/suggest handler + its DB read).
 *
 * Asserted contract:
 *   1. Returns tenant-scoped library image URLs whose title/tags overlap the
 *      product name + keywords, ranked by overlap, capped at 5.
 *   2. Never returns logos, OG images, or lp-hero-tagged rows.
 *   3. Honours the `exclude` list and only returns score>0 matches.
 *   4. Is tenant-scoped — another tenant's matching rows never leak.
 *
 * All rows created here are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import storageRouter from "../storage";

const SID = `it-suggest-${randomUUID()}`;
const UID = 999227701;

let app: Express;
let tenantId = 0;
let otherTenantId = 0;
const createdMediaIds: number[] = [];

function injectSid(opts: { method: string; url: string; sid?: string; body?: unknown }): Promise<InjectResponse> {
  const headers: Record<string, string> = {};
  if (opts.sid) headers["cookie"] = `${SESSION_COOKIE}=${opts.sid}`;
  return inject(app, { method: opts.method, url: opts.url, headers, body: opts.body });
}

function sessJson(u: Partial<AuthUser> & Pick<AuthUser, "userId">): string {
  const full: AuthUser = {
    email: "it-suggest@example.com",
    name: "IT Suggest",
    avatarUrl: null,
    tenantId: null,
    role: "viewer",
    permissions: {},
    isAdmin: false,
    appUserRole: null,
    ...u,
  };
  return JSON.stringify(full);
}

async function seedSession(sid: string, user: Partial<AuthUser> & Pick<AuthUser, "userId">): Promise<void> {
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sessJson(user)],
  );
}

async function seedMedia(tid: number, title: string, url: string, tags: string[]): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags)
     VALUES ($1, $2, $3, 'image', $4::jsonb) RETURNING id`,
    [tid, title, url, JSON.stringify(tags)],
  );
  const id = r.rows[0]!.id;
  createdMediaIds.push(id);
  return id;
}

async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [SID]).catch(() => {});
  for (const id of createdMediaIds) {
    await pool.query(`DELETE FROM lp_media WHERE id = $1`, [id]).catch(() => {});
  }
  for (const tid of [tenantId, otherTenantId]) {
    if (tid) await pool.query(`DELETE FROM tenants WHERE id = $1`, [tid]).catch(() => {});
  }
}

const U = (slug: string) => `/api/storage/objects/it-suggest-${slug}-${randomUUID().slice(0, 8)}.jpg`;
let crownByTag = "";
let crownByTitle = "";
let alignerUrl = "";
let logoUrl = "";
let heroUrl = "";
let ogUrl = "";
let otherTenantCrownUrl = "";

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT Suggest', $1, 'active') RETURNING id`,
    [`it-suggest-t-${randomUUID().slice(0, 8)}`],
  );
  tenantId = t.rows[0]!.id;
  const t2 = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status) VALUES ('IT Suggest Other', $1, 'active') RETURNING id`,
    [`it-suggest-t2-${randomUUID().slice(0, 8)}`],
  );
  otherTenantId = t2.rows[0]!.id;

  // Matches "Crowns" by tag (highest weight).
  crownByTag = U("crown-tag");
  await seedMedia(tenantId, "img-9f2a1", crownByTag, ["crowns", "dental"]);
  // Matches "Crowns" by title only (lower weight).
  crownByTitle = U("crown-title");
  await seedMedia(tenantId, "Same-day Crowns photo", crownByTitle, []);
  // Matches "Aligners" only — must NOT come back for a Crowns query.
  alignerUrl = U("aligner");
  await seedMedia(tenantId, "Clear aligners", alignerUrl, ["aligners"]);
  // Excluded purpose-tagged rows that also happen to mention crowns.
  logoUrl = U("logo");
  await seedMedia(tenantId, "Crowns brand logo", logoUrl, ["logo", "crowns"]);
  heroUrl = U("hero");
  await seedMedia(tenantId, "Crowns hero", heroUrl, ["lp-hero", "crowns"]);
  ogUrl = U("og");
  await seedMedia(tenantId, "Crowns og", ogUrl, ["og-image", "crowns"]);
  // Another tenant's crowns image — must never leak.
  otherTenantCrownUrl = U("other-crown");
  await seedMedia(otherTenantId, "Crowns other tenant", otherTenantCrownUrl, ["crowns"]);

  await seedSession(SID, { userId: UID, tenantId, role: "admin", isAdmin: true });

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", requireAuth, storageRouter);
});

afterAll(async () => {
  await cleanup();
});

describe("POST /lp/media/suggest", () => {
  it("401s without a session", async () => {
    const res = await injectSid({ method: "POST", url: "/api/lp/media/suggest", body: { query: "Crowns" } });
    expect(res.status).toBe(401);
  });

  it("returns tag/title-matched images, tag hits ranked first, never logos/og/hero", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/api/lp/media/suggest",
      sid: SID,
      body: { query: "Crowns", keywords: [], limit: 5 },
    });
    expect(res.status).toBe(200);
    const urls = (res.json as { urls: string[] }).urls;
    // Both crowns images come back; tag match ranks before title-only match.
    expect(urls).toContain(crownByTag);
    expect(urls).toContain(crownByTitle);
    expect(urls.indexOf(crownByTag)).toBeLessThan(urls.indexOf(crownByTitle));
    // Excluded purpose-tagged rows never appear, even though they mention crowns.
    expect(urls).not.toContain(logoUrl);
    expect(urls).not.toContain(heroUrl);
    expect(urls).not.toContain(ogUrl);
    // Unrelated product is not returned.
    expect(urls).not.toContain(alignerUrl);
    // Another tenant's identically-tagged row never leaks.
    expect(urls).not.toContain(otherTenantCrownUrl);
  });

  it("honours the exclude list", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/api/lp/media/suggest",
      sid: SID,
      body: { query: "Crowns", exclude: [crownByTag] },
    });
    expect(res.status).toBe(200);
    const urls = (res.json as { urls: string[] }).urls;
    expect(urls).not.toContain(crownByTag);
    expect(urls).toContain(crownByTitle);
  });

  it("returns an empty list when the query has no significant tokens", async () => {
    const res = await injectSid({
      method: "POST",
      url: "/api/lp/media/suggest",
      sid: SID,
      body: { query: "a to of", keywords: [] },
    });
    expect(res.status).toBe(200);
    expect((res.json as { urls: string[] }).urls).toEqual([]);
  });

  it("matches on keywords too, and caps the result at 5", async () => {
    // Seed 6 widget images so the cap is exercised.
    const widgetUrls: string[] = [];
    for (let i = 0; i < 6; i++) {
      const u = U(`widget-${i}`);
      widgetUrls.push(u);
      await seedMedia(tenantId, `widget ${i}`, u, ["widget"]);
    }
    const res = await injectSid({
      method: "POST",
      url: "/api/lp/media/suggest",
      sid: SID,
      body: { query: "Untitled", keywords: ["widget"], limit: 5 },
    });
    expect(res.status).toBe(200);
    const urls = (res.json as { urls: string[] }).urls;
    expect(urls.length).toBe(5);
    for (const u of urls) expect(widgetUrls).toContain(u);
  });
});
