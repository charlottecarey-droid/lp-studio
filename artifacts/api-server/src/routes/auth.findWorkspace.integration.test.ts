/**
 * Integration test for the public workspace finder (GET /api/auth/find-workspace).
 *
 * Runs the REAL auth router against the REAL Postgres pool. Requests are
 * injected into the express app IN-PROCESS (no TCP socket): the vitest worker
 * pool in this environment never fires `app.listen`'s callback, so a real
 * port + fetch would hang forever. The injection still exercises the full
 * middleware chain (cookie-parser, body parsing) and the route handler.
 *
 * Asserted contract (task: typo-tolerant workspace finder):
 *   1. Exact slug match → { found: true, host, url } (unchanged behavior).
 *   2. Exact, unambiguous name match → { found: true }.
 *   3. Hostname/URL paste → wildcard slug extraction → { found: true }.
 *   4. Near-miss typo → { found: false, suggestions: [...] } with the close
 *      workspace surfaced (name + canonical url/host).
 *   5. Near-miss abbreviation / extra word → suggestion surfaced.
 *   6. Below-threshold (unrelated) query → { found: false } with NO suggestions.
 *   7. Ambiguous near-miss (many close matches) → suggestions capped (≤3).
 *   8. Tenant-locked host → 404 (finder is off on tenant hosts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { inject, type InjectResponse } from "../test-utils/injectRequest";
import { invalidateTenantHostCache } from "../lib/tenantHosts";
import authRouter from "./auth";

const WILDCARD_BASE = "lpstudio.ai";
const RAND = randomBytes(4).toString("hex"); // 8 hex chars, unique per run

// Slugs/names are suffixed with RAND so they can't collide with real dev rows
// and so the full-table fuzzy scan only ever matches our seeded tenants.
const SLUG_ACME = `twacme${RAND}`;
const NAME_SOLO = `TW Solo ${RAND}`;
const SLUG_SOLO = `twsolo${RAND}`;
const SLUG_HOSTEX = `twhostex${RAND}`;
const SLUG_UMBRELLA = `twumbrella${RAND}`;
const NAME_GLOBEX = `TW Globex ${RAND}`;
const SLUG_GLOBEX = `tw-globex-${RAND}`;
const LOCKED_DOMAIN = `tw-locked-${RAND}.test`;
const SLUG_LOCKED = `twlocked${RAND}`;
// Four tenants that all share a near-identical query to prove the cap.
const AMBIG_TOKEN = `initech${RAND}`;
const AMBIG_NAME = `TW ${AMBIG_TOKEN}`;
const AMBIG_SLUGS = [1, 2, 3, 4].map(i => `tw-${AMBIG_TOKEN}-${i}`);

let app: Express;
const seededSlugs: string[] = [];

async function seedTenant(opts: { slug: string; name: string; domain?: string }): Promise<void> {
  await pool.query(
    `INSERT INTO tenants (name, slug, domain, status) VALUES ($1, $2, $3, 'active')`,
    [opts.name, opts.slug, opts.domain ?? null],
  );
  seededSlugs.push(opts.slug);
}

function get(url: string, host?: string): Promise<InjectResponse> {
  return inject(app, { method: "GET", url, headers: host ? { host } : undefined });
}

function find(q: string, host?: string): Promise<InjectResponse> {
  return get(`/api/auth/find-workspace?q=${encodeURIComponent(q)}`, host);
}

interface FinderBody {
  found?: boolean;
  host?: string;
  url?: string;
  suggestions?: Array<{ name: string; host: string; url: string }>;
  error?: string;
}

beforeAll(async () => {
  await pool.query(`DELETE FROM tenants WHERE slug LIKE $1`, [`tw%${RAND}%`]).catch(() => {});

  await seedTenant({ slug: SLUG_ACME, name: `TW Acme ${RAND}` });
  await seedTenant({ slug: SLUG_SOLO, name: NAME_SOLO });
  await seedTenant({ slug: SLUG_HOSTEX, name: `TW Hostex ${RAND}` });
  await seedTenant({ slug: SLUG_UMBRELLA, name: `TW Umbrella ${RAND}` });
  await seedTenant({ slug: SLUG_GLOBEX, name: NAME_GLOBEX });
  await seedTenant({ slug: SLUG_LOCKED, name: `TW Locked ${RAND}`, domain: LOCKED_DOMAIN });
  for (const s of AMBIG_SLUGS) await seedTenant({ slug: s, name: AMBIG_NAME });

  // Make the freshly-inserted rows visible to findTenantByHost (the tenant
  // resolver caches for 60s) so the tenant-locked 404 test sees LOCKED_DOMAIN.
  invalidateTenantHostCache();

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", authRouter);
});

afterAll(async () => {
  if (seededSlugs.length) {
    await pool.query(`DELETE FROM tenants WHERE slug = ANY($1::text[])`, [seededSlugs]).catch(() => {});
  }
  invalidateTenantHostCache();
});

describe("GET /api/auth/find-workspace", () => {
  it("resolves an exact slug match to the canonical host", async () => {
    const res = await find(SLUG_ACME);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(true);
    expect(body.host).toBe(`${SLUG_ACME}.${WILDCARD_BASE}`);
    expect(body.url).toBe(`https://${SLUG_ACME}.${WILDCARD_BASE}`);
    expect(body.suggestions).toBeUndefined();
  });

  it("resolves an exact, unambiguous name match", async () => {
    const res = await find(NAME_SOLO);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(true);
    expect(body.host).toBe(`${SLUG_SOLO}.${WILDCARD_BASE}`);
  });

  it("extracts the slug from a pasted wildcard host", async () => {
    const res = await find(`${SLUG_HOSTEX}.${WILDCARD_BASE}`);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(true);
    expect(body.host).toBe(`${SLUG_HOSTEX}.${WILDCARD_BASE}`);
  });

  it("offers a suggestion for a near-miss typo", async () => {
    // One extra character vs the real slug — a classic typo.
    const typo = SLUG_UMBRELLA.replace("umbrella", "umbrellla");
    const res = await find(typo);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(false);
    expect(body.suggestions?.some(s => s.host === `${SLUG_UMBRELLA}.${WILDCARD_BASE}`)).toBe(true);
    const hit = body.suggestions?.find(s => s.host === `${SLUG_UMBRELLA}.${WILDCARD_BASE}`);
    expect(hit?.url).toBe(`https://${SLUG_UMBRELLA}.${WILDCARD_BASE}`);
    expect(typeof hit?.name).toBe("string");
  });

  it("offers a suggestion when the query adds an extra word", async () => {
    const res = await find(`TW Globex ${RAND} Corp`);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(false);
    expect(body.suggestions?.some(s => s.host === `${SLUG_GLOBEX}.${WILDCARD_BASE}`)).toBe(true);
  });

  it("returns no suggestions for an unrelated query", async () => {
    const res = await find(`qzwxmkvjpt${RAND}zz`);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(false);
    expect(body.suggestions).toBeUndefined();
  });

  it("returns no suggestions for a too-short query", async () => {
    const res = await find("ac");
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(false);
    expect(body.suggestions).toBeUndefined();
  });

  it("caps the number of suggestions for an ambiguous near-miss", async () => {
    // The query matches all four AMBIG tenants (shared name → ambiguous exact
    // name match falls through to suggestions), but the result is capped.
    const res = await find(`TW ${AMBIG_TOKEN}`);
    expect(res.status).toBe(200);
    const body = res.json as FinderBody;
    expect(body.found).toBe(false);
    expect(body.suggestions?.length).toBeGreaterThan(0);
    expect(body.suggestions?.length).toBeLessThanOrEqual(3);
    // Every suggestion must be one of our seeded ambiguous tenants.
    const allowed = new Set(AMBIG_SLUGS.map(s => `${s}.${WILDCARD_BASE}`));
    for (const s of body.suggestions ?? []) expect(allowed.has(s.host)).toBe(true);
  });

  it("returns 404 (no finder) on a tenant-locked host", async () => {
    const res = await find(SLUG_ACME, LOCKED_DOMAIN);
    expect(res.status).toBe(404);
    const body = res.json as FinderBody;
    expect(body.error).toBe("Not found");
    expect(body.found).toBeUndefined();
  });
});
