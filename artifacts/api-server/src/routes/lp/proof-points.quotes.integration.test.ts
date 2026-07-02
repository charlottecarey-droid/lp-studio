/**
 * Integration coverage for Strict Facts QUOTE handling (proof-point quotes +
 * per-page trusted fact forms).
 *
 * Exercises the REAL route handlers via the in-process `inject()` helper
 * (`app.listen` hangs in the vitest worker pool) against a HERMETIC, throwaway
 * Postgres built from the drizzle schema via `drizzle-kit push`. Must NOT run
 * against prod Neon — we stand up our own ephemeral cluster and repoint the db
 * env BEFORE the first `@workspace/db` import.
 *
 * Asserted:
 *   1. POST /lp/proof-points persists a fact_kind='quote' row with attribution;
 *      GET round-trips it; PUT preserves attribution.
 *   2. A page whose testimonial matches that approved quote proof point is NOT
 *      flagged by /fact-flags/sync (the approved-quote path).
 *   3. An UNapproved quote IS flagged, but the same quote stored in
 *      lp_pages.trusted_fact_forms is suppressed (the url-sourced trust path).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, type EphemeralPg } from "../../test-utils/ephemeralPg";
import { detectFacts } from "../../lib/factFlags/detect";

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-ppq-${randomUUID()}`;
let tenantId: number;

const APPROVED_QUOTE = "Dandy completely transformed how our practice handles same-day crowns.";
const UNAPPROVED_QUOTE = "Switching to Dandy cut our remake rate to almost nothing overnight.";

function quoteBlock(quote: string, author: string) {
  return { id: `tm-${randomUUID().slice(0, 6)}`, type: "testimonial", props: { quote, author, company: "Bright Smiles Dental" } };
}

function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

function injectAs(opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body: opts.body,
  });
}

async function seedSession(sid: string, tid: number | null, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId, email: `it-${userId}@example.test`, name: "IT", avatarUrl: null,
    tenantId: tid, role: "admin", permissions: {}, isAdmin: true, appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

async function seedTenant(): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT PPQuotes ${uniq}`, `it-ppq-${uniq}`],
  );
  return t.rows[0].id;
}

async function seedPage(tid: number, blocks: unknown[], trustedFactForms: string[] = []): Promise<number> {
  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, status, blocks, trusted_fact_forms)
     VALUES ($1, $2, $3, 'draft', $4::jsonb, $5::jsonb) RETURNING id`,
    [tid, `PPQ Page ${uniq}`, `ppq-page-${uniq}`, JSON.stringify(blocks), JSON.stringify(trustedFactForms)],
  );
  return p.rows[0].id;
}

beforeAll(async () => {
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx", ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  pgMod = await import("@workspace/db");
  const requireAuth = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuth.SESSION_COOKIE;
  const factFlagsRouter = (await import("./fact-flags")).default;
  const proofPointsRouter = (await import("./proof-points")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(factFlagsRouter);
  app.use(proofPointsRouter);

  tenantId = await seedTenant();
  await seedSession(SID, tenantId, 990002301);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface ProofPointRow {
  id: number;
  value: string;
  label: string;
  fact_kind: string;
  attribution_name: string;
  attribution_title: string;
  attribution_company: string;
}
interface SyncResponse { flags: { id: number; factKind: string }[]; pendingCount: number; created: number }

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Strict Facts — proof-point quotes + trusted fact forms", () => {
  it("POST persists a quote proof point with attribution; GET round-trips; PUT preserves attribution", async () => {
    const created = await injectAs({
      method: "POST",
      url: "/lp/proof-points",
      body: {
        fact_kind: "quote",
        value: APPROVED_QUOTE,
        label: "customer testimonial",
        attribution_name: "Dr. Jane Lopez",
        attribution_title: "Owner",
        attribution_company: "Bright Smiles Dental",
        approved_for_ai: true,
      },
    });
    expect(created.status).toBe(200);
    const row = created.json as ProofPointRow;
    expect(row.fact_kind).toBe("quote");
    expect(row.attribution_name).toBe("Dr. Jane Lopez");

    const list = await injectAs({ method: "GET", url: "/lp/proof-points" });
    const rows = list.json as ProofPointRow[];
    const found = rows.find((r) => r.id === row.id);
    expect(found?.fact_kind).toBe("quote");
    expect(found?.attribution_company).toBe("Bright Smiles Dental");

    // A PUT that omits attribution-edit intent must NOT wipe attribution: the
    // client always sends the full draft, so re-send the same fields.
    const updated = await injectAs({
      method: "PUT",
      url: `/lp/proof-points/${row.id}`,
      body: {
        fact_kind: "quote",
        value: APPROVED_QUOTE,
        label: "customer testimonial",
        attribution_name: "Dr. Jane Lopez",
        attribution_title: "Owner",
        attribution_company: "Bright Smiles Dental",
      },
    });
    expect(updated.status).toBe(200);
    expect((updated.json as ProofPointRow).attribution_name).toBe("Dr. Jane Lopez");
  });

  it("does NOT flag a page testimonial that matches an approved quote proof point", async () => {
    // The approved quote proof point was created in the previous test.
    const pageId = await seedPage(tenantId, [quoteBlock(APPROVED_QUOTE, "Dr. Jane Lopez")]);
    const res = await injectAs({ method: "POST", url: `/lp/pages/${pageId}/fact-flags/sync` });
    expect(res.status).toBe(200);
    const body = res.json as SyncResponse;
    const quoteFlags = body.flags.filter((f) => f.factKind === "quote");
    expect(quoteFlags.length).toBe(0);
  });

  it("flags an unapproved quote, but suppresses it when stored in trusted_fact_forms", async () => {
    // Baseline: an unapproved quote is flagged.
    const blocks = [quoteBlock(UNAPPROVED_QUOTE, "Anonymous")];
    const flaggedPage = await seedPage(tenantId, blocks);
    const flagged = await injectAs({ method: "POST", url: `/lp/pages/${flaggedPage}/fact-flags/sync` });
    const flaggedBody = flagged.json as SyncResponse;
    expect(flaggedBody.flags.some((f) => f.factKind === "quote")).toBe(true);

    // Same quote, but persisted as a trusted (url-sourced) fact form for the
    // page → suppressed. Derive the normalized form exactly as the detector
    // does, so the trust key matches.
    const trustedForms = detectFacts(blocks)
      .filter((f) => f.factKind === "quote")
      .map((f) => f.normalizedForm);
    expect(trustedForms.length).toBeGreaterThan(0);

    const trustedPage = await seedPage(tenantId, blocks, trustedForms);
    const trusted = await injectAs({ method: "POST", url: `/lp/pages/${trustedPage}/fact-flags/sync` });
    const trustedBody = trusted.json as SyncResponse;
    expect(trustedBody.flags.some((f) => f.factKind === "quote")).toBe(false);
  });
});
