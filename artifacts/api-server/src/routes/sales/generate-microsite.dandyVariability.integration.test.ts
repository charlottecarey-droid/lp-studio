/**
 * Route-level proof that the AI microsite generator actually applies the
 * Dandy-only supporting-section style variation through the FULL
 * `POST /sales/accounts/:accountId/generate-microsite` path.
 *
 * The pure helper (`applyDandySupportingVariability`) and the slug-based Dandy
 * gate (`isDandyTenant` / `isProtectedEnterpriseSlug`) are each unit-tested
 * elsewhere, but nothing proved the route WIRES them together: that a generated
 * Dandy (non-template) page gets its light supporting sections varied per
 * account, while a non-Dandy tenant — and a fixed-template generation — are
 * left untouched. A future refactor could silently drop that pass; this test is
 * the regression lock.
 *
 * Like the other sales-route integration tests it drives the REAL handler via
 * the in-process `inject()` helper (`app.listen` hangs in the vitest worker
 * pool). The OpenAI client is mocked to a deterministic block array so the suite
 * is fast/offline. Because the Dandy gate keys off the IMMUTABLE tenant SLUG
 * ("dandy" / "dandy-smb") — which is unique and already seeded in prod Neon (the
 * DB dev's `@workspace/db` pool points at) — this MUST run against a HERMETIC,
 * throwaway Postgres so it can freely mint a `dandy-smb` tenant without touching
 * prod. The schema is built from the drizzle definitions via `drizzle-kit push`,
 * and the env is repointed BEFORE the first `@workspace/db` import.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { inject, type InjectResponse } from "../../test-utils/injectRequest";
import { startEphemeralPg, pgBinariesAvailable, type EphemeralPg } from "../../test-utils/ephemeralPg";

// This suite is HERMETIC — it builds its own throwaway cluster from the local
// Postgres 16 binaries and never touches the shared Neon pool, so the Neon
// TCP probe (`dbAvailable`) is the WRONG gate: on a laptop with reachable
// Neon but no local Postgres install it passes, and the beforeAll then dies
// with `initdb ENOENT`. Gate on the binaries themselves instead. Probed once
// here (module scope) because the top-level beforeAll runs even when the
// describe is skipped.
const localPg = pgBinariesAvailable();

// Deterministic AI response, mutated per test. vi.hoisted lets the (hoisted)
// vi.mock factory read it. The mock applies to the route module's
// `import OpenAI from "openai"` even though that module is imported dynamically.
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

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// these modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
type GenMod = typeof import("./generate-microsite");
let pgMod: Pg;
let applyDandySupportingVariability: GenMod["applyDandySupportingVariability"];
let SESSION_COOKIE: string;

let epg: EphemeralPg;
let app: Express;

const SID_DANDY = `it-msvar-dandy-${randomUUID()}`;
const SID_GROWTH = `it-msvar-growth-${randomUUID()}`;

let dandyTenantId: number;
let growthTenantId: number;

// Block layout shared by every test: a hero (varied by its OWN pass, skipped
// here), four LIGHT-NEUTRAL supporting sections (all seeded "white" so any
// variation is visible), interleaved with two ACCENT sections (dark +
// dandy-green) that must NEVER be touched. The four supporting block types all
// preserve an incoming `backgroundStyle` through `mergeWithDefaults`.
const HERO_POS = 0;
const ACCENT_DARK_POS = 2;
const ACCENT_GREEN_POS = 5;
const LIGHT_POSITIONS = [1, 3, 4, 6] as const;

function buildAiBlocks(): Array<{ type: string; props: Record<string, unknown> }> {
  return [
    { type: "dso-heartland-hero", props: { headline: "Built for scale" } },
    { type: "dso-faq", props: { backgroundStyle: "white" } },
    { type: "dso-final-cta", props: { backgroundStyle: "dark" } },
    { type: "dso-split-feature", props: { backgroundStyle: "white" } },
    { type: "dso-lab-tour", props: { backgroundStyle: "white" } },
    { type: "dso-success-stories", props: { backgroundStyle: "dandy-green" } },
    { type: "dso-stat-bar", props: { backgroundStyle: "white" } },
  ];
}

/** The minimal block array (order + type + backgroundStyle) the supporting
 * pass keys off, used to reproduce the helper's expected per-account output. */
function buildExpectedHelperInput(): Array<{ type: string; props: Record<string, unknown> }> {
  return buildAiBlocks().map((b) => ({ type: b.type, props: { ...b.props } }));
}

// The in-process inject() helper sets no socket remoteAddress, so every request
// would otherwise share one undefined rate-limit key and trip the 5/min cap
// once the file makes >5 generation calls. With `trust proxy` on (set in
// beforeAll), each request gets its own limiter bucket via a unique
// X-Forwarded-For — keeping the real limiter in the chain without throttling
// independent tests.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function injectAs(sid: string, opts: { method: string; url: string; body?: unknown }): Promise<InjectResponse> {
  return inject(app, {
    method: opts.method,
    url: opts.url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    body: opts.body,
  });
}

/** Walk up from cwd to find the repo's `lib/db` package dir. */
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

async function seedSession(sid: string, tenantId: number, userId: number): Promise<void> {
  const { pool } = pgMod;
  const sess = JSON.stringify({
    userId,
    email: `it-${userId}@example.test`,
    name: "IT MS Var Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  });
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire)
     VALUES ($1, $2, now() + interval '1 hour')
     ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [sid, sess],
  );
}

/** Seed a tenant with the given slug + one brand segment so segmentId resolves. */
async function seedTenant(slug: string): Promise<number> {
  const { pool } = pgMod;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ($1, $2, 'active', 'growth', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`IT MS Var ${slug}`, slug],
  );
  const tenantId = t.rows[0].id;
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2::jsonb)`,
    [
      tenantId,
      JSON.stringify({
        brandName: "IT Brand",
        // A curated micrositeBlockList keeps the route on the CURATED path
        // (useFreeform=false) so the AI's dso-* blocks survive instead of being
        // dropped to the neutral freeform fallback. This mirrors how a real
        // Dandy tenant is configured and is what lets the supporting-section
        // variability run on the curated funnel under test.
        segments: [
          {
            id: "general",
            name: "General Buyers",
            micrositeBlockList: buildAiBlocks().map((b) => ({ type: b.type })),
          },
        ],
      }),
    ],
  );
  return tenantId;
}

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
}

async function seedTemplatePage(tenantId: number, slug: string): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, is_template)
     VALUES ($1, 'IT Template', $2, $3::jsonb, 'published', true) RETURNING id`,
    [tenantId, slug, JSON.stringify(buildAiBlocks())],
  );
  return r.rows[0].id;
}

/** Read the `backgroundStyle` of the blocks at the four light-section positions. */
function lightBgs(blocks: Array<{ props?: Record<string, unknown> }>): string[] {
  return LIGHT_POSITIONS.map((i) => blocks[i]?.props?.backgroundStyle as string);
}

beforeAll(async () => {
  // A skipped describe does NOT skip this file-level hook — bail out before
  // shelling out to the (absent) local Postgres binaries.
  if (!localPg) return;
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";

  // 1. Stand up the throwaway cluster and repoint the db env BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;

  // 2. Build the real schema straight from the drizzle definitions.
  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(`drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`);
  }

  // 3. Safe to load the db layer + the real route handlers now.
  pgMod = await import("@workspace/db");
  const requireAuthMod = await import("../../middleware/requireAuth");
  SESSION_COOKIE = requireAuthMod.SESSION_COOKIE;
  const genMod = await import("./generate-microsite");
  applyDandySupportingVariability = genMod.applyDandySupportingVariability;
  const salesRouter = (await import("./index")).default;

  // 4. Mount the genuine router with the real auth/cookie/body middleware.
  app = express();
  // Honor X-Forwarded-For so each injected request gets its own rate-limit
  // bucket (the inject() helper sets no socket IP — see nextIp() above).
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuthMod.requireAuth);
  app.use("/sales", salesRouter);

  // 5. Seed a Dandy (slug "dandy-smb") + a non-Dandy growth tenant, each with a
  //    brand segment, plus an admin session for each.
  dandyTenantId = await seedTenant("dandy-smb");
  growthTenantId = await seedTenant(`it-msvar-${randomUUID().slice(0, 8)}`);
  await seedSession(SID_DANDY, dandyTenantId, 990010101);
  await seedSession(SID_GROWTH, growthTenantId, 990010102);
}, 120_000);

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

interface GenResponse {
  page: { id: number };
  blocks: Array<{ type: string; props: Record<string, unknown> }>;
}

// Hermetic: needs the LOCAL Postgres binaries (initdb/pg_ctl), not the Neon
// pool — skipped when they aren't installed (see pgBinariesAvailable above).
describe.skipIf(!localPg)("generate-microsite — Dandy supporting-section variability (route wiring)", () => {
  it("applies the per-account supporting-background variation for a Dandy, non-template page", async () => {
    const accountName = `Heartland Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(dandyTenantId, accountName);
    aiState.response = { title: `${accountName} — Why Switch`, slug: `dandy-var-${randomUUID().slice(0, 8)}`, blocks: buildAiBlocks() };

    const res = await injectAs(SID_DANDY, {
      method: "POST",
      url: `/sales/accounts/${accountId}/generate-microsite`,
      body: { segmentId: "general" },
    });
    expect(res.status).toBe(200);
    const body = res.json as GenResponse;
    const blocks = body.blocks;

    // The route must apply the exported helper with the SAME per-account seed it
    // derives internally (`${accountId}:${deriveCompanyName(account)}`). Reproduce
    // the helper's expected output and compare the light sections exactly.
    const seedKey = `${accountId}:${accountName}`;
    const expected = applyDandySupportingVariability(
      buildExpectedHelperInput() as unknown as Parameters<typeof applyDandySupportingVariability>[0],
      seedKey,
    );
    const expectedLight = lightBgs(expected as Array<{ props?: Record<string, unknown> }>);
    const gotLight = lightBgs(blocks);

    expect(gotLight).toEqual(expectedLight);

    // Variation actually happened (not all left at the seeded "white") and the
    // scheme alternates between two distinct neutrals, so adjacent light sections
    // differ.
    expect(new Set(gotLight).size).toBe(2);
    expect(gotLight[0]).not.toBe(gotLight[1]);
    expect(gotLight[1]).not.toBe(gotLight[2]);
    expect(gotLight[2]).not.toBe(gotLight[3]);
    // Every varied value stays a designed light-neutral preset.
    for (const bg of gotLight) expect(["white", "light-gray", "muted"]).toContain(bg);

    // Accent / dark sections are deliberate contrast moments — untouched.
    expect(blocks[ACCENT_DARK_POS].props.backgroundStyle).toBe("dark");
    expect(blocks[ACCENT_GREEN_POS].props.backgroundStyle).toBe("dandy-green");
    // The hero is varied by its OWN pass, never by the supporting pass.
    expect(blocks[HERO_POS].type).toBe("dso-heartland-hero");
  });

  it("leaves a non-Dandy tenant's page untouched (no supporting variation)", async () => {
    const accountName = `Acme Robotics ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(growthTenantId, accountName);
    aiState.response = { title: `${accountName} — Why Switch`, slug: `growth-var-${randomUUID().slice(0, 8)}`, blocks: buildAiBlocks() };

    const res = await injectAs(SID_GROWTH, {
      method: "POST",
      url: `/sales/accounts/${accountId}/generate-microsite`,
      body: { segmentId: "general" },
    });
    expect(res.status).toBe(200);
    const blocks = (res.json as GenResponse).blocks;

    // Every supporting light section stays exactly as the AI produced it.
    expect(lightBgs(blocks)).toEqual(["white", "white", "white", "white"]);
    expect(blocks[ACCENT_DARK_POS].props.backgroundStyle).toBe("dark");
    expect(blocks[ACCENT_GREEN_POS].props.backgroundStyle).toBe("dandy-green");
  });

  it("leaves a fixed-template Dandy generation untouched (variability is skipped)", async () => {
    const accountName = `Bright Smiles ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(dandyTenantId, accountName);
    const templateId = await seedTemplatePage(dandyTenantId, `it-msvar-tmpl-${randomUUID().slice(0, 8)}`);
    aiState.response = { title: `${accountName} — Template`, slug: `dandy-tmpl-${randomUUID().slice(0, 8)}`, blocks: buildAiBlocks() };

    const res = await injectAs(SID_DANDY, {
      method: "POST",
      url: `/sales/accounts/${accountId}/generate-microsite`,
      body: { segmentId: "general", templateId },
    });
    expect(res.status).toBe(200);
    const blocks = (res.json as GenResponse).blocks;

    // A fixed template's layout is an explicit choice — the Dandy variability
    // pass must NOT run, so the light sections stay as authored ("white").
    expect(lightBgs(blocks)).toEqual(["white", "white", "white", "white"]);
    expect(blocks[ACCENT_DARK_POS].props.backgroundStyle).toBe("dark");
    expect(blocks[ACCENT_GREEN_POS].props.backgroundStyle).toBe("dandy-green");
  });
});
