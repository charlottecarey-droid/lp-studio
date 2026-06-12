/**
 * Regression guard — scrape gating at generate-page time (updated June 2026).
 *
 * Per-request URLs (the generate modal's URL box) get the FULL treatment:
 * multi-page scrape, image mirroring into lp_media, and strict-facts trust.
 *
 * The brand's persisted `inspirationUrls` (e.g. the Brand Settings homepage)
 * participate again — but ONLY via the cached SCRAPE-ONLY path
 * (`scrapeInspirationUrl`): style/structure markdown for the prompt, NO image
 * mirroring (the old auto-merge re-mirrored the same homepage images on every
 * run, flooding lp_media with duplicate "scraped" rows), and NO strict-facts
 * trust. This suite locks in:
 *
 *   • No per-request URL + populated brand `inspirationUrls` →
 *       scrape-only inspiration path runs; the FULL scrape pipeline
 *       (maybeScrapeRef / maybeMultiPageScrapeRef) and mirrorReferenceImages
 *       are NEVER invoked; the prompt labels the content as a style reference
 *       and the trusted-source override stays OFF.
 *   • A per-request reference URL → full scrape + mirror run (and the
 *     inspiration path still runs alongside, scrape-only).
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
  // Scrape-only inspiration result: markdown only — no screenshot, no
  // imageUrls (the real scrapeInspirationUrl drops them by design).
  const inspiration = {
    url: "https://brand-homepage.example.com/",
    markdown: "Brand homepage. Style and structure reference markdown.",
    truncated: false,
    fromCache: false,
  };
  return {
    scraped,
    inspiration,
    maybeMultiPageScrapeRef: vi.fn(async () => scraped),
    maybeScrapeRef: vi.fn(async () => scraped),
    scrapeInspirationUrl: vi.fn(async () => inspiration),
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
    scrapeInspirationUrl: scrapeFx.scrapeInspirationUrl,
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
  scrapeFx.scrapeInspirationUrl.mockClear();
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
  it("inspiration-only: runs the scrape-only path, never the full scrape pipeline, and NEVER mirrors", async () => {
    const { tenantId, sid } = await seedTenant();
    const { templateId } = await seedTemplate(tenantId);

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      // NO referenceUrl / referenceUrls — only the brand's persisted inspirationUrls exist.
    });

    expect(res.status).toBe(200);
    // The brand inspiration homepage IS scraped again (June 2026) — but only
    // through the cached scrape-only path…
    expect(scrapeFx.scrapeInspirationUrl).toHaveBeenCalledTimes(1);
    expect((scrapeFx.scrapeInspirationUrl.mock.calls[0] as unknown[])[0]).toBe(BRAND_INSPIRATION_URL);
    // …never through the full per-request pipeline, and never mirrored into
    // lp_media (the original library-flooding regression).
    expect(scrapeFx.maybeMultiPageScrapeRef).not.toHaveBeenCalled();
    expect(scrapeFx.maybeScrapeRef).not.toHaveBeenCalled();
    expect(mirrorFx.mirrorReferenceImages).not.toHaveBeenCalled();
    // Inspiration scrapes confer NO reference status / trust on the response.
    const body = res.json as {
      usedReference?: boolean;
      referenceUrls?: string[];
      trustedFactForms?: string[];
      inspirationReferences?: Array<{ url: string; fromCache: boolean }>;
    };
    expect(body.usedReference).toBe(false);
    expect(body.referenceUrls).toEqual([]);
    expect(body.trustedFactForms).toEqual([]);
    // …but the additive `inspirationReferences` echo tells the FE which
    // inspiration sites informed the page and their cache provenance.
    expect(body.inspirationReferences).toEqual([
      { url: BRAND_INSPIRATION_URL, fromCache: false },
    ]);
  });

  it("inspiration-only: the prompt labels the content style-only and the trusted-source override stays OFF", async () => {
    const { tenantId, sid } = await seedTenant();
    const { templateId } = await seedTemplate(tenantId);

    // _captureOnly (dev/test-only) returns the assembled prompt verbatim.
    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      _captureOnly: true,
    });

    expect(res.status).toBe(200);
    const captureBody = res.json as { userPrompt?: string; usedReference?: boolean };
    const userPrompt = String(captureBody.userPrompt ?? "");
    // Inspiration content present, clearly labelled as a style reference…
    expect(userPrompt).toContain("BRAND INSPIRATION SITES — STYLE & STRUCTURE REFERENCES ONLY");
    expect(userPrompt).toContain(
      "(brand inspiration site — mirror its style, structure and density; do NOT copy its specific claims)",
    );
    expect(userPrompt).toContain(scrapeFx.inspiration.markdown);
    // …with NO per-request REFERENCE PAGE section and NO strict-facts trust.
    expect(userPrompt).not.toContain("REFERENCE PAGE — STUDY THIS CAREFULLY");
    expect(userPrompt).not.toContain("TRUSTED SOURCE URL — OVERRIDE");
    expect(captureBody.usedReference).toBe(false);
  });

  it("DOES scrape + mirror when the user provides a reference URL in the modal (inspiration rides along scrape-only)", async () => {
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
    // The fully-scraped URL was the user's, NOT the brand inspiration homepage.
    const scrapedArg = (scrapeFx.maybeMultiPageScrapeRef.mock.calls[0] as unknown[])[0];
    expect(scrapedArg).toBe(scrapeFx.scraped.scraped.url);
    expect(scrapedArg).not.toBe(BRAND_INSPIRATION_URL);
    expect(mirrorFx.mirrorReferenceImages).toHaveBeenCalled();
    // The inspiration homepage still participates — scrape-only.
    expect(scrapeFx.scrapeInspirationUrl).toHaveBeenCalledTimes(1);
    expect((scrapeFx.scrapeInspirationUrl.mock.calls[0] as unknown[])[0]).toBe(BRAND_INSPIRATION_URL);
    // Trust comes from the per-request URL only.
    const body = res.json as {
      usedReference?: boolean;
      referenceUrls?: string[];
      inspirationReferences?: Array<{ url: string; fromCache: boolean }>;
    };
    expect(body.usedReference).toBe(true);
    // The response separates the two: per-request URLs in referenceUrls,
    // inspiration sites in the additive inspirationReferences echo.
    expect(body.referenceUrls).toEqual([scrapeFx.scraped.scraped.url]);
    expect(body.inspirationReferences).toEqual([
      { url: BRAND_INSPIRATION_URL, fromCache: false },
    ]);
  });
});
