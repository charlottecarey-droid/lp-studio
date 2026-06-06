/**
 * Route-level regression guard for image de-duplication on AI page generation
 * (POST /lp/generate-page). Companion to the pure-unit coverage in
 * generate-page.images.test.ts, which exercises the selection helpers in
 * isolation — this test drives the FULL route so a future change that bypasses
 * the dedup path (reordered pipeline, dropped pass, etc.) is caught.
 *
 * Why this matters: a reference scrape routinely mirrors the SAME photo at many
 * sizes, each landing as a distinct /api/storage row (unique URL + refsrc tag)
 * that all fold to ONE visual identity. Without the dedup + fill guardrails the
 * model can place that single photo across the hero, feature, and product slots
 * and the page ships looking broken. The contract asserted here: across every
 * hero / feature / product image slot the produced page uses each underlying
 * image identity AT MOST ONCE.
 *
 * The OpenAI client is mocked (vi.mock("openai")) to return a deterministic
 * block array in which the model deliberately over-assigns one scraped photo
 * (and an exact duplicate) to several slots. Everything else runs for real:
 * in-process inject() against the REAL Postgres pool, real requireAuth, real
 * media-catalog read, the real validate/dedupe/fill pipeline. Each test seeds +
 * tears down its own growth tenant, session, and lp_media rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

// Deterministic AI response, mutated per test. vi.hoisted lets the (hoisted)
// vi.mock factory read it.
const aiState = vi.hoisted(() => ({
  response: { title: "Generated Page", slug: "generated-page", blocks: [] as unknown[] },
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
import generatePageRouter from "./generate-page";

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

// A dental prompt that avoids the DSO / DSO-practices prompt detectors (no
// "dso" / "practice" / "partner" keywords) so the route takes the GENERAL path.
const PROMPT = "Affordable dentures landing page for a dental clinic — teeth, smile, dentist, denture fitting";

type MediaSeed = { url: string; title: string; tags: string[] };

/** A scraped reference photo mirrored at four sizes: distinct object-storage
 *  URLs + distinct refsrc tags, but the SAME reference host + title stem, so
 *  the pipeline folds them to ONE visual identity ("the scanner photo"). */
const SCANNER_HOST = "dental-source.example.com";
const SCANNER_VARIANTS: MediaSeed[] = [
  { url: "/objects/scan-a", title: "denture scanner 800x600", tags: ["scraped", "page-reference", `refhost:${SCANNER_HOST}`, "refsrc:a"] },
  { url: "/objects/scan-b", title: "denture scanner 1200x900", tags: ["scraped", "page-reference", `refhost:${SCANNER_HOST}`, "refsrc:b"] },
  { url: "/objects/scan-c", title: "denture scanner 1600x1200", tags: ["scraped", "page-reference", `refhost:${SCANNER_HOST}`, "refsrc:c"] },
  { url: "/objects/scan-d", title: "denture scanner 400x300", tags: ["scraped", "page-reference", `refhost:${SCANNER_HOST}`, "refsrc:d"] },
];

const SCANNER_URLS = new Set(SCANNER_VARIANTS.map((s) => s.url));

/** Genuinely-distinct curated library images across the three slot purposes,
 *  enough to fill every cleared/empty slot with a unique on-topic photo. */
const DISTINCT_IMAGES: MediaSeed[] = [
  { url: "/objects/denture-hero-1", title: "Smiling denture patient", tags: ["lp-hero", "dentures", "smile", "patient"] },
  { url: "/objects/denture-hero-2", title: "Dental clinic interior", tags: ["lp-hero", "dental", "clinic"] },
  { url: "/objects/feat-fitting", title: "Denture fitting", tags: ["lp-feature", "dentures", "fitting"] },
  { url: "/objects/feat-scan", title: "Dental scan", tags: ["lp-feature", "dental", "scan"] },
  { url: "/objects/feat-care", title: "Denture care", tags: ["lp-feature", "dentures", "care"] },
  { url: "/objects/feat-consult", title: "Dental consult", tags: ["lp-feature", "dental", "consult"] },
  { url: "/objects/detail-1", title: "Denture closeup", tags: ["product-detail", "dentures", "closeup"] },
  { url: "/objects/detail-2", title: "Denture set", tags: ["product-detail", "dentures", "set"] },
  { url: "/objects/detail-3", title: "Denture mold", tags: ["product-detail", "dentures", "mold"] },
];

/** Map every seeded URL → a stable "asset group". All scanner resize variants
 *  share one group; each distinct image is its own group. Mirrors the route's
 *  per-page identity contract (scraped resize variants fold; curated images
 *  stay distinct) without importing its private helpers. */
function assetGroupOf(url: string): string {
  if (SCANNER_URLS.has(url)) return "SCANNER";
  return url;
}

async function seedMedia(tenantId: number, rows: MediaSeed[]): Promise<void> {
  for (const r of rows) {
    await pool.query(
      `INSERT INTO lp_media (tenant_id, title, url, media_type, mime_type, width, height, tags)
       VALUES ($1, $2, $3, 'image', 'image/jpeg', 1600, 1200, $4::jsonb)`,
      [tenantId, r.title, r.url, JSON.stringify(r.tags)],
    );
  }
}

async function seedTenant(industry = "dental"): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-genpage-img-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan, settings)
     VALUES ('IT GenPage Img Tenant', $1, 'active', 'growth', $2::jsonb)
     RETURNING id`,
    [slug, JSON.stringify({ industry })],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  const user: AuthUser = {
    userId: 999830000 + Math.floor(Math.random() * 100000),
    email: "genpage-img-it@example.com",
    name: "IT GenPage Img Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  const sid = `it-genpage-img-${randomUUID()}`;
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, JSON.stringify(user)],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

// The in-process inject() helper sets no socket remoteAddress, so without a
// per-request X-Forwarded-For every request would share one rate-limit key and
// trip the 8/min cap. With `trust proxy` on, a unique X-Forwarded-For gives each
// request its own bucket — keeping the real limiter in the chain unthrottled.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, body: unknown) {
  return inject(app, {
    method: "POST",
    url: "/lp/generate-page",
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    body,
  });
}

/** Collect the URL of every hero / feature / product image slot across the
 *  returned blocks (mirrors the shapes the route's dedup pipeline tracks). */
function collectSlotUrls(blocks: Array<{ type?: string; props?: Record<string, unknown> }>): string[] {
  const urls: string[] = [];
  const pushStr = (v: unknown) => {
    if (typeof v === "string" && v.trim()) urls.push(v);
  };
  for (const b of blocks) {
    const props = b?.props;
    if (!props || typeof props !== "object") continue;
    pushStr((props as Record<string, unknown>).imageUrl); // hero scalar
    for (const row of (props.rows as Array<Record<string, unknown>>) ?? []) pushStr(row?.imageUrl); // feature rows
    for (const item of (props.items as Array<Record<string, unknown>>) ?? []) pushStr(item?.image); // product items
  }
  return urls;
}

beforeAll(() => {
  // getOpenAIClient() throws (→ 503) unless both vars are present. The OpenAI
  // ctor is mocked above, so the actual values are never used.
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "http://test.invalid/v1";
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "test-key-not-used";

  app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(requireAuth);
  app.use(generatePageRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM ai_generation_log WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("POST /lp/generate-page — image dedup across hero/feature/product slots", () => {
  it("places a distinct image identity in every slot when the model over-assigns one scraped photo", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedMedia(tenantId, [...SCANNER_VARIANTS, ...DISTINCT_IMAGES]);

    // The model picks the SAME scanner photo (under three different resize-
    // variant URLs) for the hero, a feature row, and a product item, and also
    // repeats one genuine library image (exact duplicate) across two rows.
    aiState.response = {
      title: "Affordable Dentures",
      slug: "affordable-dentures",
      blocks: [
        { type: "hero", props: { headline: "Affordable dentures", subheadline: "A confident smile", imageUrl: "/objects/scan-a" } },
        {
          type: "zigzag-features",
          props: {
            rows: [
              { headline: "Custom denture fitting", body: "Shaped to you", imageUrl: "/objects/scan-b" }, // near-dup of hero scanner
              { headline: "Fast denture turnaround", body: "Quick results", imageUrl: "/objects/feat-fitting" },
              { headline: "Digital dental scan", body: "Precise", imageUrl: "/objects/feat-fitting" }, // exact duplicate
              { headline: "Comfortable dentures", body: "All-day wear", imageUrl: "" }, // empty → must fill
            ],
          },
        },
        {
          type: "product-grid",
          props: {
            headline: "Our denture options",
            items: [
              { title: "Full dentures", description: "Complete set", image: "/objects/scan-c" }, // near-dup of hero scanner
              { title: "Partial dentures", description: "Targeted fit", image: "/objects/detail-1" },
            ],
          },
        },
      ],
    };

    const res = await authed(sid, { prompt: PROMPT });
    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type?: string; props?: Record<string, unknown> }> };
    expect(Array.isArray(body.blocks)).toBe(true);

    const slotUrls = collectSlotUrls(body.blocks);
    // Hero (1) + feature rows (4) + product items (2) = 7 slots; all must be
    // filled (the seeded library is large enough to cover every slot).
    expect(slotUrls).toHaveLength(7);

    // Every placed URL is a real seeded library image (no hallucinated/empty).
    for (const u of slotUrls) {
      expect(SCANNER_URLS.has(u) || DISTINCT_IMAGES.some((d) => d.url === u)).toBe(true);
    }

    // The contract: each underlying image identity is used AT MOST ONCE across
    // all hero/feature/product slots — the over-assigned scanner photo never
    // repeats, and neither does the exact-duplicate feature image.
    const groups = slotUrls.map(assetGroupOf);
    expect(new Set(groups).size).toBe(groups.length);

    // And specifically the scanner photo (4 resize variants in the library)
    // appears in at most one slot, not three.
    expect(groups.filter((g) => g === "SCANNER").length).toBeLessThanOrEqual(1);
  });

  it("prefers an empty slot over repeating the scraped photo when the library can't fill every slot", async () => {
    const { tenantId, sid } = await seedTenant();
    // Only the scanner group (folds to ONE identity) + two distinct feature
    // images — not enough distinct images to cover four feature rows.
    const TWO_DISTINCT: MediaSeed[] = [
      { url: "/objects/only-feat-a", title: "Denture fitting close", tags: ["lp-feature", "dentures", "fitting"] },
      { url: "/objects/only-feat-b", title: "Dental scan close", tags: ["lp-feature", "dental", "scan"] },
    ];
    await seedMedia(tenantId, [...SCANNER_VARIANTS, ...TWO_DISTINCT]);

    aiState.response = {
      title: "Dentures",
      slug: "dentures",
      blocks: [
        { type: "hero", props: { headline: "Dentures", subheadline: "Smile again", imageUrl: "/objects/scan-a" } },
        {
          type: "zigzag-features",
          props: {
            rows: [
              { headline: "Denture fitting", body: "Custom", imageUrl: "/objects/scan-b" },
              { headline: "Dental scan", body: "Precise", imageUrl: "/objects/scan-c" },
              { headline: "Denture care", body: "Easy", imageUrl: "/objects/scan-d" },
              { headline: "Comfortable dentures", body: "All day", imageUrl: "" },
            ],
          },
        },
      ],
    };

    const res = await authed(sid, { prompt: PROMPT });
    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type?: string; props?: Record<string, unknown> }> };

    const slotUrls = collectSlotUrls(body.blocks);
    const groups = slotUrls.map(assetGroupOf);

    // No identity is repeated — the scanner photo is never placed in two slots,
    // even though the model assigned its variants to four of them and the
    // distinct library is too small to fill the rest.
    expect(new Set(groups).size).toBe(groups.length);
    expect(groups.filter((g) => g === "SCANNER").length).toBeLessThanOrEqual(1);
    // The two genuinely-distinct feature images are still placed.
    expect(slotUrls).toContain("/objects/only-feat-a");
    expect(slotUrls).toContain("/objects/only-feat-b");
  });
});
