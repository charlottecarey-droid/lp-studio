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
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

// Deterministic AI response, mutated per test so a generated page can echo the
// seeded account name. vi.hoisted lets the (hoisted) vi.mock factory read it.
// `raw`, when set, is returned VERBATIM as the model's message content (used to
// simulate non-JSON output); otherwise the structured `response` is serialised.
const aiState = vi.hoisted(() => ({
  response: { title: "Generated Microsite", slug: "generated-microsite", blocks: [] as unknown[] },
  raw: null as string | null,
}));

vi.mock("openai", () => ({
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: aiState.raw ?? JSON.stringify(aiState.response) } }],
        }),
      },
    };
  },
}));

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import {
  deleteTenantCascade,
  purgeStaleTestTenants,
  purgeExpiredTestSessionsBySid,
} from "../../test-utils/tenantCleanup";
import salesRouter from "./index";
// Shared job status endpoint (GET /lp/generation-jobs/:id) — the async
// microsite submit test polls it, exactly as the FE does behind
// VITE_GENERATION_JOBS=1. Importing this also registers the "page" handler;
// the "microsite" handler registers when the sales router imports
// generate-microsite.ts.
import generationJobsRouter from "../lp/generation-jobs";

// Slug + session-sid prefix and the exact name every tenant/session this suite
// seeds shares, so a crashed run (or an older run whose teardown predated the
// robust cascade) is purged from the shared DB on the next run instead of
// accumulating — without ever matching a real tenant (see purgeStaleTestTenants).
const TEST_SLUG_PREFIX = "it-ms-smoke-";
const TEST_TENANT_NAME = "IT Microsite Tenant";

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

/** Seed a tenant + admin session + a brand row carrying one segment. Growth
 *  (salesConsole plan) by default; "starter" exercises the plan gate. */
async function seedTenant(plan: "growth" | "starter" = "growth"): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Microsite Tenant', $1, 'active', $2)
     RETURNING id`,
    [slug, plan],
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

/**
 * Seed a tenant-owned, multi-block TEMPLATE page (isTemplate=true) whose lead
 * block is a real `event-landing-hero` carrying the authored structural props
 * the AI never re-emits — an embedded form (`formId` + form headings), a
 * non-empty `backgroundImage`, and content sections (what-to-expect / event
 * details). The route resolves a template by id + isTemplate + (own tenant OR
 * global), so this row makes the full template path executable.
 */
async function seedTemplate(tenantId: number): Promise<{ templateId: number; blocks: AiBlock[] }> {
  const blocks: AiBlock[] = [
    {
      id: "event-landing-hero-0",
      type: "event-landing-hero",
      props: {
        // Authored structural props the AI does NOT re-emit — must survive.
        backgroundImage: "https://images.example.com/skyline-template.jpg",
        backgroundImageAlt: "City skyline at dusk",
        backgroundOverlay: 0.5,
        formId: 4242,
        formHeading: "Save your spot",
        formSubheading: "Spots are limited — RSVP to confirm your seat.",
        // Authored content sections that must remain present.
        whatToExpectHeading: "What to expect",
        whatToExpectBody:
          "An evening of conversation, cocktails, and connection with leadership and fellow operators.",
        eventDetailsHeading: "Event Details",
        eventDetailsBullets: [
          "Wednesday — 6:00pm Welcome reception",
          "Thursday — 6:30pm Dinner & program",
          "Cocktail attire",
        ],
        // Copy the AI personalizes.
        headline: "Join us in New York",
        dateText: "June 10 & 11, 2026",
        ctaText: "Save Your Spot",
        ctaUrl: "#rsvp",
      },
    },
    {
      id: "benefits-grid-1",
      type: "benefits-grid",
      props: {
        headline: "Why attend",
        items: [
          { icon: "Zap", title: "Network", description: "Meet peers" },
          { icon: "Star", title: "Learn", description: "Hear the roadmap" },
        ],
      },
    },
    {
      id: "bottom-cta-2",
      type: "bottom-cta",
      props: { headline: "Ready to join?", ctaText: "RSVP now", ctaUrl: "#rsvp" },
    },
  ];

  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template, template_label)
     VALUES ($1, 'Event Landing Template', $2, $3::jsonb, 'draft', 'marketing', true, 'Event Landing')
     RETURNING id`,
    [tenantId, `it-ms-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id, blocks };
}

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

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

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(async () => {
  // Purge stragglers from any earlier run (crash, or an older teardown that
  // swallowed an FK error) so the shared DB doesn't accumulate test tenants.
  // Guarded by slug prefix + exact seeded name + a 30-min age floor so it can
  // never touch a real tenant or a concurrent run's fresh fixture.
  await purgeStaleTestTenants(pool, { slugPrefix: TEST_SLUG_PREFIX, name: TEST_TENANT_NAME });
  await purgeExpiredTestSessionsBySid(pool, TEST_SLUG_PREFIX);

  // getOpenAIClient() returns null without a key (→ 503). The OpenAI ctor is
  // mocked above, so the actual value is irrelevant — it just has to be present.
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";

  app = express();
  // Honor X-Forwarded-For so each injected request gets its own rate-limit
  // bucket (the inject() helper sets no socket IP — see nextIp() above).
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
  // Router paths already carry the /lp prefix (mirrors the real mount).
  app.use(generationJobsRouter);
  // Generous timeout: the first run after this fix lands cascade-deletes the
  // backlog of orphaned it-ms-smoke tenants from older (pre-fix) runs, which is
  // heavy against the shared DB. Steady-state runs purge ~nothing and finish fast.
}, 120_000);

// Reset the raw-content override before every test so a non-JSON case can't
// leak its garbage payload into a later test (tests share the hoisted aiState).
beforeEach(() => {
  aiState.raw = null;
});

afterAll(async () => {
  // Robust cascade: discovers EVERY tenant-FK table from the catalog and clears
  // it before deleting the tenant, so a child row the generate route writes
  // (ai_generation_log, lp_media, sales_signals, …) can't 23503 and orphan the
  // tenant — the bug that let earlier runs pile up leftover it-ms-smoke tenants.
  for (const id of createdTenantIds) {
    await deleteTenantCascade(pool, id).catch((err: Error) => {
      // Surface (don't swallow) so a newly-added unhandled FK doesn't silently
      // start leaking tenants again — the exact failure mode this test fixes.
      console.warn(`[generate-microsite.smoke] failed to delete tenant ${id}:`, err.message);
    });
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  // Generous timeout: each cascade delete runs catalog discovery + per-table
  // deletes against the shared DB, so clearing this run's tenants exceeds the
  // 10s default hook timeout — and from a laptop (WAN latency to Neon, vs
  // Replit's same-region link) even 120s can fall short for a full run's
  // ~15 tenants.
}, 300_000);

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Microsite generation smoke", { timeout: 180_000 }, () => {
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

/**
 * Task #1130 — route-level regression guard for the multi-block template path.
 *
 * Drives the FULL generate-microsite route from a real `event-landing-hero`
 * template and asserts the generated page keeps the authored structural props
 * the AI never re-emits: the embedded form (`formId` + form headings), a
 * non-empty hero `backgroundImage`, and every content section — while the copy
 * is still personalized to the account. Exercised with "Replace imagery" both
 * OFF and ON (the original production bug — a pipeline reorder dropping the
 * form / hero image — shipped undetected because nothing drove this path).
 *
 * The AI mock returns ONLY the personalized COPY per block (same types, same
 * order), deliberately omitting formId / backgroundImage / form config, exactly
 * as the real model does. The route's mergeAuthored backstop must restore them.
 */
// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Microsite generation from a multi-block template", { timeout: 180_000 }, () => {
  for (const replaceImagery of [false, true] as const) {
    it(`preserves the embedded form, hero image, and content sections (replaceImagery=${replaceImagery})`, async () => {
      const { tenantId, sid } = await seedTenant();
      const accountName = `Northwind Dental ${Math.floor(Math.random() * 1e6)}`;
      const accountId = await seedAccount(tenantId, accountName);
      const { templateId, blocks: tmplBlocks } = await seedTemplate(tenantId);

      // The model re-emits each block's COPY only (no formId, no
      // backgroundImage, no form config) — personalized to the account, in the
      // same type + order as the template.
      aiState.response = {
        title: `${accountName} — You're Invited`,
        slug: "youre-invited",
        blocks: [
          {
            type: "event-landing-hero",
            props: {
              headline: `${accountName}: Join us in New York`,
              dateText: "June 10 & 11, 2026",
              ctaText: "Save Your Spot",
            },
          },
          {
            type: "benefits-grid",
            props: {
              headline: `Why ${accountName} should attend`,
              items: [
                { icon: "Zap", title: "Network", description: "Meet operators like you" },
                { icon: "Star", title: "Learn", description: "Hear what's next" },
              ],
            },
          },
          {
            type: "bottom-cta",
            props: { headline: `${accountName}, ready to join?`, ctaText: "RSVP now" },
          },
        ],
      };

      const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
        segmentId: "general",
        templateId,
        replaceImagery,
      });

      expect(res.status).toBe(200);
      const body = res.json as {
        page: { id: number; tenantId: number; status: string };
        blocks: Array<{ type: string; props: Record<string, unknown> }>;
      };

      // Every authored block is present, same types in the same order.
      expect(body.blocks).toHaveLength(tmplBlocks.length);
      expect(body.blocks.map(b => b.type)).toEqual(tmplBlocks.map(b => b.type));

      const hero = body.blocks[0];
      expect(hero.type).toBe("event-landing-hero");

      // Embedded form config preserved (AI never re-emits these).
      expect(hero.props.formId).toBe(4242);
      expect(hero.props.formHeading).toBe("Save your spot");
      expect(hero.props.formSubheading).toBe("Spots are limited — RSVP to confirm your seat.");

      // Hero background image stays non-empty in BOTH imagery modes. With an
      // empty media library + replaceImagery ON, the fill passes can't satisfy
      // the slot, so the merge backstop must fall back to the authored image
      // rather than ship a blank hero.
      expect(typeof hero.props.backgroundImage).toBe("string");
      expect((hero.props.backgroundImage as string).trim().length).toBeGreaterThan(0);

      // Authored content sections survive (what-to-expect + event details).
      expect(hero.props.whatToExpectHeading).toBe("What to expect");
      expect(hero.props.whatToExpectBody).toBe(
        "An evening of conversation, cocktails, and connection with leadership and fellow operators.",
      );
      expect(hero.props.eventDetailsHeading).toBe("Event Details");
      expect(Array.isArray(hero.props.eventDetailsBullets)).toBe(true);
      expect((hero.props.eventDetailsBullets as unknown[]).length).toBe(3);

      // Copy is personalized to the account across the page.
      expect(hero.props.headline as string).toContain(accountName);
      expect(JSON.stringify(body.blocks)).toContain(accountName);

      // Persisted draft is scoped to this tenant.
      const dbRow = await pool.query<{ tenant_id: number; blocks: unknown }>(
        `SELECT tenant_id, blocks FROM lp_pages WHERE id = $1`,
        [body.page.id],
      );
      expect(dbRow.rows[0].tenant_id).toBe(tenantId);
      const persisted = dbRow.rows[0].blocks as Array<{ type: string; props: Record<string, unknown> }>;
      expect(persisted[0].props.formId).toBe(4242);
      expect((persisted[0].props.backgroundImage as string).trim().length).toBeGreaterThan(0);
    });
  }
});

/**
 * Task #1135 — the template path must survive *bad* AI output, not just the
 * happy path. A model hiccup (missing block, extra/unknown block, non-JSON,
 * empty array) must never silently drop the embedded form, hero image, or whole
 * content sections — and must never 500 or ship a blank page. The authored
 * template is a complete, on-brand fallback the route degrades back toward.
 *
 * Every case asserts the same invariant on the lead `event-landing-hero`: the
 * embedded form config, a non-empty backgroundImage, and the authored content
 * sections all survive regardless of what the model returned.
 */
function assertHeroIntact(blocks: Array<{ type: string; props: Record<string, unknown> }>): void {
  const hero = blocks.find(b => b.type === "event-landing-hero");
  expect(hero).toBeDefined();
  const p = hero!.props;

  // Embedded form config preserved (the AI never re-emits these).
  expect(p.formId).toBe(4242);
  expect(p.formHeading).toBe("Save your spot");
  expect(p.formSubheading).toBe("Spots are limited — RSVP to confirm your seat.");

  // Hero background image stays non-empty (never a blank/black hero).
  expect(typeof p.backgroundImage).toBe("string");
  expect((p.backgroundImage as string).trim().length).toBeGreaterThan(0);

  // Authored content sections survive (what-to-expect + event details).
  expect(p.whatToExpectHeading).toBe("What to expect");
  expect(p.whatToExpectBody).toBe(
    "An evening of conversation, cocktails, and connection with leadership and fellow operators.",
  );
  expect(p.eventDetailsHeading).toBe("Event Details");
  expect(Array.isArray(p.eventDetailsBullets)).toBe(true);
  expect((p.eventDetailsBullets as unknown[]).length).toBe(3);
}

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Microsite generation survives malformed / partial AI output", { timeout: 180_000 }, () => {
  it("restores a block the AI omitted from the template layout", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Cascade Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId, blocks: tmplBlocks } = await seedTemplate(tenantId);

    // The model drops the trailing bottom-cta entirely (truncated output),
    // re-emitting only the hero + benefits copy.
    aiState.response = {
      title: `${accountName} — You're Invited`,
      slug: "omitted-block",
      blocks: [
        { type: "event-landing-hero", props: { headline: `${accountName}: Join us`, ctaText: "Save Your Spot" } },
        { type: "benefits-grid", props: { headline: `Why ${accountName} should attend` } },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // The authored layout is authoritative: the omitted block is restored, so
    // the page keeps every template block in the same order.
    expect(body.blocks).toHaveLength(tmplBlocks.length);
    expect(body.blocks.map(b => b.type)).toEqual(tmplBlocks.map(b => b.type));

    // The restored trailing block carries its AUTHORED copy (the AI never sent
    // it), not an empty shell — proof the whole section wasn't silently dropped.
    const restored = body.blocks[2];
    expect(restored.type).toBe("bottom-cta");
    expect(restored.props.headline).toBe("Ready to join?");
    expect(restored.props.ctaText).toBe("RSVP now");

    assertHeroIntact(body.blocks);
  });

  it("drops an extra / unknown block the AI invented", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Summit Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId, blocks: tmplBlocks } = await seedTemplate(tenantId);

    // The model returns the full layout PLUS a fabricated, unrenderable block.
    aiState.response = {
      title: `${accountName} — You're Invited`,
      slug: "extra-block",
      blocks: [
        { type: "event-landing-hero", props: { headline: `${accountName}: Join us`, ctaText: "Save Your Spot" } },
        { type: "benefits-grid", props: { headline: `Why ${accountName} should attend` } },
        { type: "bottom-cta", props: { headline: `${accountName}, ready?`, ctaText: "RSVP" } },
        { type: "totally-made-up-block", props: { headline: "hallucinated junk" } },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // Only the authored template positions survive — the invented block is gone.
    expect(body.blocks).toHaveLength(tmplBlocks.length);
    expect(body.blocks.map(b => b.type)).toEqual(tmplBlocks.map(b => b.type));
    expect(body.blocks.some(b => b.type === "totally-made-up-block")).toBe(false);

    assertHeroIntact(body.blocks);
  });

  it("falls back to the authored template when the AI returns invalid JSON", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Harbor Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId, blocks: tmplBlocks } = await seedTemplate(tenantId);

    // The model returns a non-JSON blob — the route must not 500.
    aiState.raw = "Sorry, I can't help with that. Here is some prose instead {oops";

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      page: { id: number };
      blocks: Array<{ type: string; props: Record<string, unknown> }>;
    };

    // The whole authored layout is preserved (nothing usable came from the AI).
    expect(body.blocks).toHaveLength(tmplBlocks.length);
    expect(body.blocks.map(b => b.type)).toEqual(tmplBlocks.map(b => b.type));
    assertHeroIntact(body.blocks);

    // And it was persisted as a real draft, not lost.
    expect(body.page.id).toBeGreaterThan(0);
  });

  it("falls back to the authored template when the AI returns an empty block list", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Meadow Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId, blocks: tmplBlocks } = await seedTemplate(tenantId);

    aiState.response = {
      title: `${accountName} — You're Invited`,
      slug: "empty-blocks",
      blocks: [],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // An empty array must not yield a blank page — the authored layout fills in.
    expect(body.blocks).toHaveLength(tmplBlocks.length);
    expect(body.blocks.map(b => b.type)).toEqual(tmplBlocks.map(b => b.type));
    assertHeroIntact(body.blocks);
  });
});

/**
 * Task #1153 — the FREEFORM path (no templateId, no curated block list) must
 * survive bad AI output too. There is no authored template to fall back to, but
 * the static NEUTRAL layout is a complete, on-brand last-resort. A model hiccup
 * — non-JSON, missing title/slug, an empty block list, or only-unknown block
 * types — must never 500 or ship a blank page: each degrades to the NEUTRAL
 * layout (or at least a usable, non-empty page) instead.
 *
 * seedTenant() seeds a brand whose only segment ("general") carries NO
 * micrositeBlockList, and these cases pass no templateId, so the route takes
 * the freeform branch (useFreeform === true).
 *
 * The canonical NEUTRAL block list (see NEUTRAL_MICROSITE_BLOCK_LIST in the
 * route): full-bleed-hero (deliberately swapped in for the plain hero in June
 * 2026 — it renders its own nav), trust-bar, benefits-grid, testimonial,
 * how-it-works, comparison, bottom-cta. After it is substituted,
 * enforceRequiredRoles may append further role blocks (e.g. a footer), so we
 * assert the NEUTRAL types are a SUBSET of the produced layout rather than an
 * exact match.
 */
const NEUTRAL_TYPES = [
  "full-bleed-hero",
  "trust-bar",
  "benefits-grid",
  "testimonial",
  "how-it-works",
  "comparison",
  "bottom-cta",
] as const;

function assertNeutralLayout(blocks: Array<{ type: string; props: Record<string, unknown> }>): void {
  // A real, non-blank page came back.
  expect(Array.isArray(blocks)).toBe(true);
  expect(blocks.length).toBeGreaterThan(0);

  // Exactly the NEUTRAL safety-net layout was substituted (every NEUTRAL type
  // is present), and it still opens with a hero.
  const types = new Set(blocks.map(b => b.type));
  for (const t of NEUTRAL_TYPES) {
    expect(types.has(t)).toBe(true);
  }
  expect(blocks[0].type).toBe("full-bleed-hero");
}

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("Freeform microsite generation survives malformed / partial AI output", { timeout: 180_000 }, () => {
  it("falls back to the NEUTRAL layout when the AI returns invalid JSON", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Freeform Harbor ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    // Non-JSON blob — the freeform path must not 500.
    aiState.raw = "Here is some prose instead of JSON {definitely not valid";

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      page: { id: number };
      blocks: Array<{ type: string; props: Record<string, unknown> }>;
    };

    assertNeutralLayout(body.blocks);

    // And it was persisted as a real draft, not lost.
    expect(body.page.id).toBeGreaterThan(0);
    const dbRow = await pool.query<{ tenant_id: number }>(
      `SELECT tenant_id FROM lp_pages WHERE id = $1`,
      [body.page.id],
    );
    expect(dbRow.rows[0].tenant_id).toBe(tenantId);
  });

  it("falls back to the NEUTRAL layout when the AI omits title and slug", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Freeform Meadow ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    // Valid JSON, but the required title/slug fields are missing and blocks is
    // not an array — the freeform path must backfill rather than 500.
    aiState.response = { blocks: undefined as unknown as unknown[] } as typeof aiState.response;

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      page: { id: number };
      blocks: Array<{ type: string; props: Record<string, unknown> }>;
    };

    assertNeutralLayout(body.blocks);
    expect(body.page.id).toBeGreaterThan(0);
  });

  it("falls back to the NEUTRAL layout when the AI returns an empty block list", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Freeform Cascade ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    aiState.response = {
      title: `${accountName} — Why Switch`,
      slug: "freeform-empty-blocks",
      blocks: [],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    // An empty array must not yield a blank page — NEUTRAL fills in.
    assertNeutralLayout(body.blocks);
  });

  it("falls back to the NEUTRAL layout when the AI returns only unknown block types", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Freeform Summit ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    // Every block is an unrenderable / out-of-vocabulary type. The freeform
    // filter drops them all, so the NEUTRAL safety net must take over.
    aiState.response = {
      title: `${accountName} — Why Switch`,
      slug: "freeform-only-unknown",
      blocks: [
        { type: "totally-made-up-block", props: { headline: "hallucinated junk" } },
        { type: "another-fabricated-section", props: { body: "more junk" } },
        // A Dandy-curated compound block must never leak into a freeform page.
        { type: "dso-success-stories", props: {} },
      ],
    };

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    assertNeutralLayout(body.blocks);

    // None of the invented / Dandy-curated types survived.
    expect(body.blocks.some(b => b.type === "totally-made-up-block")).toBe(false);
    expect(body.blocks.some(b => b.type === "another-fabricated-section")).toBe(false);
    expect(body.blocks.some(b => b.type === "dso-success-stories")).toBe(false);
  });
});

// ── Async job path (July 2026) ───────────────────────────────────────────────
// The queue variant of the generate route: POST …/generate-microsite/jobs
// (202 + jobId) then the shared GET /lp/generation-jobs/:id until terminal —
// exactly the FE flow behind VITE_GENERATION_JOBS=1. Same real-DB smoke goal
// as above: catch "the job path is broken end-to-end", not AI quality.
describe.skipIf(!dbAvailable)("Microsite generation async jobs", { timeout: 180_000 }, () => {
  /** Poll the shared status endpoint until the job leaves queued/running. */
  async function waitForJobTerminal(
    sid: string,
    jobId: string,
    timeoutMs = 30_000,
  ): Promise<{ status: string; result: unknown; error: string | null }> {
    const start = Date.now();
    for (;;) {
      const res = await authed(sid, "GET", `/lp/generation-jobs/${jobId}`);
      expect(res.status).toBe(200);
      const job = res.json as { status: string; result: unknown; error: string | null };
      if (job.status === "succeeded" || job.status === "failed") return job;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`job ${jobId} still "${job.status}" after ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  it("submits a job, runs it through the queue, and lands the same draft page the sync route builds", async () => {
    const { tenantId, sid } = await seedTenant();
    const accountName = `Queue Robotics ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);

    aiState.response = {
      title: `${accountName} — Why Switch`,
      slug: "why-switch-job",
      blocks: [
        { type: "hero", props: { headline: `Built for ${accountName}`, subheadline: "Tailored to you" } },
        { type: "benefits-grid", props: { items: [{ icon: "Zap", title: "Fast", description: "Quick wins" }] } },
        { type: "bottom-cta", props: { headline: "Ready?", ctaText: "Book a demo" } },
      ],
    };

    const submit = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite/jobs`, {
      segmentId: "general",
    });
    expect(submit.status).toBe(202);
    const { jobId } = submit.json as { jobId: string };
    expect(jobId).toBeTruthy();

    const job = await waitForJobTerminal(sid, jobId);
    expect(job.error).toBeNull();
    expect(job.status).toBe("succeeded");

    // The terminal result is the sync route's response body, and the page row
    // it references is persisted + tenant-scoped exactly like the sync path's.
    const result = job.result as { page: { id: number } };
    expect(result.page.id).toBeGreaterThan(0);
    const dbRow = await pool.query<{ tenant_id: number; account_id: number; status: string }>(
      `SELECT tenant_id, account_id, status FROM lp_pages WHERE id = $1`,
      [result.page.id],
    );
    expect(dbRow.rows[0].tenant_id).toBe(tenantId);
    expect(dbRow.rows[0].account_id).toBe(accountId);
    expect(dbRow.rows[0].status).toBe("draft");
  }, 60_000);

  it("404s a cross-tenant submit before creating a job, and hides jobs across tenants", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const accountId = await seedAccount(a.tenantId, `Tenant A Corp ${Math.floor(Math.random() * 1e6)}`);

    // Tenant B cannot submit against tenant A's account…
    const submit = await authed(b.sid, "POST", `/sales/accounts/${accountId}/generate-microsite/jobs`, {});
    expect(submit.status).toBe(404);
    const jobs = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM lp_generation_jobs WHERE tenant_id = $1`,
      [b.tenantId],
    );
    expect(Number(jobs.rows[0].n)).toBe(0);

    // …and cannot read tenant A's job rows through the status endpoint.
    aiState.response = { title: "T", slug: "t", blocks: [{ type: "hero", props: { headline: "H" } }] };
    const ok = await authed(a.sid, "POST", `/sales/accounts/${accountId}/generate-microsite/jobs`, {
      segmentId: "general",
    });
    expect(ok.status).toBe(202);
    const { jobId } = ok.json as { jobId: string };
    const crossRead = await authed(b.sid, "GET", `/lp/generation-jobs/${jobId}`);
    expect(crossRead.status).toBe(404);
    // Let tenant A's job settle so teardown doesn't race a running generation.
    await waitForJobTerminal(a.sid, jobId);
  }, 60_000);

  it("plan-gates the job submit exactly like the sync route (402 on starter)", async () => {
    const { tenantId, sid } = await seedTenant("starter");
    const accountId = await seedAccount(tenantId, `Starter Co ${Math.floor(Math.random() * 1e6)}`);
    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite/jobs`, {});
    expect(res.status).toBe(402);
  });
});
