/**
 * Regression guard — at generate-page time we scrape ONLY the URL(s) the user
 * pastes into the generate modal's URL box (`referenceUrl` / `referenceUrls`).
 *
 * Previously the route merged the brand's persisted `inspirationUrls` (e.g. the
 * Brand Settings homepage) into the scrape set, so EVERY generation re-scraped
 * the homepage and re-mirrored the same images into lp_media — flooding the
 * library with duplicate "scraped" rows. This suite locks in:
 *
 *   • No per-request URL + populated brand `inspirationUrls`  → NO scrape, NO mirror.
 *   • A per-request reference URL                            → scrape + mirror run.
 *
 * Mocks ./firecrawl (the scraper) and mirrorReferenceImages with spies so we can
 * assert call counts; everything else runs for real against the in-process
 * inject() harness + the real Postgres pool.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

const aiState = vi.hoisted(() => ({
  response: { title: "Generated", slug: "generated", blocks: [] as unknown[] },
}));

const scrapeFx = vi.hoisted(() => {
  const scraped = {
    scraped: {
      url: "https://gp-gate-ref.example.com/",
      markdown: "A modern dental practice. Dental care reimagined.",
      truncated: false,
      additionalUrls: [] as string[],
      imageUrls: ["https://gp-gate-ref.example.com/img/a.jpg"] as string[],
    },
    screenshotUrl: undefined,
  };
  return {
    scraped,
    maybeMultiPageScrapeRef: vi.fn(async () => scraped),
    maybeScrapeRef: vi.fn(async () => scraped),
  };
});

const mirrorFx = vi.hoisted(() => ({
  mirrorReferenceImages: vi.fn(async () => ({
    images: [] as unknown[],
    attempted: 0,
    uploaded: 0,
    skipped: 0,
    skips: [] as string[],
  })),
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

vi.mock("./firecrawl", async (importActual) => {
  const actual = await importActual<typeof import("./firecrawl")>();
  return {
    ...actual,
    maybeMultiPageScrapeRef: scrapeFx.maybeMultiPageScrapeRef,
    maybeScrapeRef: scrapeFx.maybeScrapeRef,
  };
});

vi.mock("../../lib/brand-import/assets-uploader", async (importActual) => {
  const actual = await importActual<typeof import("../../lib/brand-import/assets-uploader")>();
  return { ...actual, mirrorReferenceImages: mirrorFx.mirrorReferenceImages };
});

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import generatePageRouter from "./generate-page";

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

// The brand's persisted inspiration homepage — must NEVER be scraped at
// generation time on its own.
const BRAND_INSPIRATION_URL = "https://brand-homepage.example.com/";

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999870000 + Math.floor(Math.random() * 100000),
    email: "gp-gate-it@example.com",
    name: "IT GP Scrape-Gating Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-gate-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-gate-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Scrape-Gating Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

  // Brand config carries a persisted inspiration homepage URL.
  await pool.query(
    `INSERT INTO lp_brand_settings (tenant_id, config) VALUES ($1, $2::jsonb)`,
    [
      tenantId,
      JSON.stringify({
        brandName: "IT Brand",
        segments: [{ id: "general", name: "General Buyers" }],
        inspirationUrls: [BRAND_INSPIRATION_URL],
      }),
    ],
  );

  const { sid, sess } = adminSession(tenantId);
  await pool.query(
    `INSERT INTO app_sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`,
    [sid, sess],
  );
  createdSids.push(sid);
  return { tenantId, sid };
}

async function seedTemplate(tenantId: number): Promise<{ templateId: number }> {
  const blocks: AiBlock[] = [
    {
      id: "hero-0",
      type: "hero",
      props: {
        headline: "Modern dental care",
        subheadline: "Bringing your practice into the future",
        imageUrl: "https://images.example.com/gp-gate-template-hero.jpg",
        ctaText: "Get started",
        ctaUrl: "#",
      },
    },
  ];
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template, template_label)
     VALUES ($1, 'Dental Template', $2, $3::jsonb, 'draft', 'marketing', true, 'Dental')
     RETURNING id`,
    [tenantId, `it-gp-gate-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id };
}

function copyOnlyResponse() {
  return {
    title: "Dental Care",
    slug: "dental-care",
    blocks: [
      { type: "hero", props: { headline: "Dental care, reimagined", subheadline: "A modern dental workflow" } },
    ],
  };
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.20.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

beforeAll(() => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";
  app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/", generatePageRouter);
});

beforeEach(() => {
  scrapeFx.maybeMultiPageScrapeRef.mockClear();
  scrapeFx.maybeScrapeRef.mockClear();
  mirrorFx.mirrorReferenceImages.mockClear();
  aiState.response = copyOnlyResponse();
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM ai_generation_log WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("generate-page — scrape gating", () => {
  it("does NOT scrape or mirror the brand inspiration homepage when no reference URL is provided", async () => {
    const { tenantId, sid } = await seedTenant();
    const { templateId } = await seedTemplate(tenantId);

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      // NO referenceUrl / referenceUrls — only the brand's persisted inspirationUrls exist.
    });

    expect(res.status).toBe(200);
    expect(scrapeFx.maybeMultiPageScrapeRef).not.toHaveBeenCalled();
    expect(scrapeFx.maybeScrapeRef).not.toHaveBeenCalled();
    expect(mirrorFx.mirrorReferenceImages).not.toHaveBeenCalled();
  });

  it("DOES scrape + mirror when the user provides a reference URL in the modal", async () => {
    const { tenantId, sid } = await seedTenant();
    const { templateId } = await seedTemplate(tenantId);

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      replaceImagery: true,
      referenceUrl: scrapeFx.scraped.scraped.url,
    });

    expect(res.status).toBe(200);
    // A single per-request URL uses the multi-page scrape path.
    expect(scrapeFx.maybeMultiPageScrapeRef).toHaveBeenCalledTimes(1);
    // The scraped URL was the user's, NOT the brand inspiration homepage.
    const scrapedArg = (scrapeFx.maybeMultiPageScrapeRef.mock.calls[0] as unknown[])[0];
    expect(scrapedArg).toBe(scrapeFx.scraped.scraped.url);
    expect(scrapedArg).not.toBe(BRAND_INSPIRATION_URL);
    expect(mirrorFx.mirrorReferenceImages).toHaveBeenCalled();
  });
});
