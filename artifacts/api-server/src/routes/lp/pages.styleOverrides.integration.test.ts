/**
 * Auto style-from-URL (July 2026) — integration coverage for the POST
 * /lp/pages `styleOverrides` pass-through.
 *
 * Exercises the REAL route handler via the in-process `inject()` helper
 * against a hermetic throwaway Postgres (same harness as
 * factFlags.integration.test.ts). Pins the sanitization contract:
 *   - mixed valid + forbidden keys → only whitelisted visual keys persist
 *   - garbage shapes (string / array / identity-only object) → 201 with a
 *     NULL style_overrides column, never a 400
 *   - omitted entirely → NULL column (the pre-existing default)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, pgBinariesAvailable, type EphemeralPg } from "../../test-utils/ephemeralPg";

// Hermetic suite — builds its own throwaway cluster from the local Postgres
// binaries, so gate on those (NOT the Neon TCP probe). Probed at module scope
// because the top-level beforeAll runs even when the describe is skipped.
const localPg = pgBinariesAvailable();

type Pg = typeof import("@workspace/db");
let pgMod: Pg;
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID = `it-pso-${randomUUID()}`;
let tenantId: number;

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

function createPage(body: Record<string, unknown>): Promise<InjectResponse> {
  const uniq = randomUUID().slice(0, 8);
  return inject(app, {
    method: "POST",
    url: "/lp/pages",
    headers: { cookie: `${SESSION_COOKIE}=${SID}` },
    body: {
      title: `Style Overrides ${uniq}`,
      slug: `it-pso-${uniq}`,
      blocks: [{ id: "hero", type: "hero", props: { headline: "Hello" } }],
      status: "draft",
      ...body,
    },
  });
}

async function readStyleOverrides(pageId: number): Promise<unknown> {
  const { pool } = pgMod;
  const r = await pool.query<{ style_overrides: unknown }>(
    `SELECT style_overrides FROM lp_pages WHERE id = $1`,
    [pageId],
  );
  return r.rows[0].style_overrides;
}

beforeAll(async () => {
  if (!localPg) return;
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
  const pagesRouter = (await import("./pages")).default;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth.optionalAuth);
  app.use(pagesRouter);

  const { pool } = pgMod;
  const uniq = randomUUID().slice(0, 8);
  const t = await pool.query<{ id: number }>(
    // plan=growth so the free-plan page cap can't 402 the creates under test.
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT StyleOverrides ${uniq}`, `it-pso-${uniq}`],
  );
  tenantId = t.rows[0].id;

  const sess = JSON.stringify({
    userId: 990001301, email: "it-pso@example.test", name: "IT", avatarUrl: null,
    tenantId, role: "admin", permissions: {}, isAdmin: true, appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [SID, sess],
  );
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

// Hermetic: needs the LOCAL Postgres binaries (initdb/pg_ctl), not the Neon
// pool — skipped when they aren't installed (see pgBinariesAvailable above).
describe.skipIf(!localPg)("POST /lp/pages styleOverrides sanitization", () => {
  it("persists only whitelisted visual keys from a mixed payload", async () => {
    const res = await createPage({
      styleOverrides: {
        primaryColor: "#112233",
        cardRadius: "soft",
        buttonRadius: "pill",
        layoutDensity: "spacious",
        // forbidden — identity/copy/asset proposals must never persist
        brandName: "Acme",
        logoUrl: "https://acme.example/logo.svg",
        copyInstructions: "Write casually.",
        voiceProfile: { profile: {} },
      },
    });
    expect(res.status).toBe(201);
    const page = res.json as { id: number };
    expect(await readStyleOverrides(page.id)).toEqual({
      primaryColor: "#112233",
      cardRadius: "soft",
      buttonRadius: "pill",
      layoutDensity: "spacious",
    });
  });

  it("a string payload is dropped silently (201, NULL column)", async () => {
    const res = await createPage({ styleOverrides: "x" });
    expect(res.status).toBe(201);
    expect(await readStyleOverrides((res.json as { id: number }).id)).toBeNull();
  });

  it("an array payload is dropped silently (201, NULL column)", async () => {
    const res = await createPage({ styleOverrides: [{ primaryColor: "#112233" }] });
    expect(res.status).toBe(201);
    expect(await readStyleOverrides((res.json as { id: number }).id)).toBeNull();
  });

  it("an identity-only payload (nothing whitelisted) is dropped silently", async () => {
    const res = await createPage({ styleOverrides: { brandName: "Acme", taglines: ["Do more"] } });
    expect(res.status).toBe(201);
    expect(await readStyleOverrides((res.json as { id: number }).id)).toBeNull();
  });

  it("omitting styleOverrides keeps the NULL default", async () => {
    const res = await createPage({});
    expect(res.status).toBe(201);
    expect(await readStyleOverrides((res.json as { id: number }).id)).toBeNull();
  });
});
