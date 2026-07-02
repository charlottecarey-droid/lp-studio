/**
 * Task #1154 — route-level verification of the REFERENCE-URL image source on the
 * Pages-gallery AI generator (POST /lp/generate-page, "Use a template" flow).
 *
 * Task #1116 covered the tenant-LIBRARY swap path for the `replaceImagery` flag.
 * It did NOT cover the second image source: when the caller also provides a
 * reference website URL, the route scrapes that site, mirrors its photos
 * (`mirrorReferenceImages`) and threads them through `buildReferenceFillPool`,
 * using them to fill image slots — alongside, and as a backfill for, the
 * tenant's own library. That branch was previously unverified end-to-end. This
 * suite proves:
 *
 *   • replaceImagery ON + reference URL → reference-scraped photos fill the
 *     feature slots (the template's feature photos are gone).
 *   • when the tenant library covers the hero but NOT the feature slots, the
 *     library fills the hero and the reference photos backfill the features.
 *   • trust-bar (numeric proof bar) stays value+label only in BOTH cases.
 *
 * Why feature slots (not the hero)? The shared starter library every tenant can
 * read contains `lp-hero`-purpose stock but ZERO `lp-feature` stock, so the hero
 * is always satisfied by purpose-tagged library/starter imagery while the
 * feature slots are exactly where reference photos get pulled in. To make the
 * reference photos deterministically win those slots over the ~300 neutral
 * unclassified starters, the fixtures tag them with a coined topic token
 * ("orthozenith") that appears in the page copy — the realistic case where a
 * reference site's on-topic photos beat generic stock.
 *
 * Mocks:
 *   • openai            → copy-only blocks (no images), as the real model does.
 *   • ./firecrawl       → gatherReferences()'s scraper returns a scraped page
 *                         carrying harvested image-candidate URLs (no network).
 *   • mirrorReferenceImages → returns scraped library rows for those candidates
 *                         (no object-storage upload).
 * Everything else runs for real: in-process inject() against the REAL Postgres
 * pool, requireAuth, the AI-generation quota gate, brand/template/media lookups,
 * and the full image pipeline (buildReferenceFillPool + fillEmptyImages).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

const aiState = vi.hoisted(() => ({
  response: { title: "Generated", slug: "generated", blocks: [] as unknown[] },
}));

const refFx = vi.hoisted(() => {
  const SOURCE_URL = "https://gp-ref.example.com/";
  return {
    SOURCE_URL,
    CANDIDATE_URLS: [
      "https://gp-ref.example.com/img/a.jpg",
      "https://gp-ref.example.com/img/b.jpg",
      "https://gp-ref.example.com/img/c.jpg",
    ],
    MIRRORED: [
      { url: "/objects/gp-ref-1", title: "Orthozenith dental clinic exterior", host: "gp-ref.example.com" },
      { url: "/objects/gp-ref-2", title: "Orthozenith dental treatment chair", host: "gp-ref.example.com" },
      { url: "/objects/gp-ref-3", title: "Orthozenith dental scanner closeup", host: "gp-ref.example.com" },
    ],
  };
});

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
  const scraped = {
    scraped: {
      url: refFx.SOURCE_URL,
      markdown: "A modern Orthozenith dental practice. Dental care reimagined for your dental clinic.",
      truncated: false,
      additionalUrls: [] as string[],
      imageUrls: refFx.CANDIDATE_URLS,
    },
    screenshotUrl: undefined,
  };
  return {
    ...actual,
    maybeMultiPageScrapeRef: vi.fn(async () => scraped),
    maybeScrapeRef: vi.fn(async () => scraped),
  };
});

// The "orthozenith"/"dental" content tags + topic-bearing titles give these rows
// a positive relevance score so they clear the scraped-image strict gate and
// beat the generic unclassified starter stock for the feature slots.
vi.mock("../../lib/brand-import/assets-uploader", async (importActual) => {
  const actual = await importActual<typeof import("../../lib/brand-import/assets-uploader")>();
  return {
    ...actual,
    mirrorReferenceImages: vi.fn(async () => ({
      images: refFx.MIRRORED.map((m) => ({
        url: m.url,
        title: m.title,
        tags: ["page-reference", "scraped", `refhost:${m.host}`, `refsrc:${m.url}`, "orthozenith", "dental"],
        width: 1600,
        height: 1067,
      })),
      attempted: refFx.CANDIDATE_URLS.length,
      uploaded: refFx.MIRRORED.length,
      skipped: 0,
      skips: [] as string[],
    })),
  };
});

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import generatePageRouter from "./generate-page";

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

const TMPL_HERO_IMG = "https://images.example.com/gp-ref-template-hero.jpg";
const TMPL_FEAT_1_IMG = "https://images.example.com/gp-ref-template-feature-1.jpg";
const TMPL_FEAT_2_IMG = "https://images.example.com/gp-ref-template-feature-2.jpg";

const LIB_HERO_URL = "/objects/gp-ref-lib-hero";

const MIRROR_URLS = new Set(refFx.MIRRORED.map((m) => m.url));

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999860000 + Math.floor(Math.random() * 100000),
    email: "gp-refimg-it@example.com",
    name: "IT GP Reference-Imagery Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-refimg-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-refimg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Reference-Imagery Tenant', $1, 'active', 'growth')
     RETURNING id`,
    [slug],
  );
  const tenantId = r.rows[0].id;
  createdTenantIds.push(tenantId);

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

/** Seed only a single hero-purpose library image (no feature images). It carries
 *  the topic token + lp-hero purpose so it wins the hero slot over shared
 *  starter heroes, leaving the feature slots for the reference mirror. */
async function seedHeroOnlyLibrary(tenantId: number): Promise<void> {
  await pool.query(
    `INSERT INTO lp_media (tenant_id, title, url, media_type, tags, width, height)
     VALUES ($1, 'Orthozenith dental clinic lifestyle', $2, 'image', $3::jsonb, 1600, 1067)`,
    [tenantId, LIB_HERO_URL, JSON.stringify(["lp-hero", "orthozenith", "dental"])],
  );
}

async function seedTemplate(tenantId: number): Promise<{ templateId: number }> {
  const blocks: AiBlock[] = [
    {
      id: "hero-0",
      type: "hero",
      props: {
        headline: "Modern dental care",
        subheadline: "Bringing your practice into the future",
        imageUrl: TMPL_HERO_IMG,
        ctaText: "Get started",
        ctaUrl: "#",
      },
    },
    {
      id: "zigzag-features-1",
      type: "zigzag-features",
      props: {
        headline: "Why practices choose us",
        rows: [
          { tag: "Speed", headline: "Faster turnaround", body: "Cases back in days", imageUrl: TMPL_FEAT_1_IMG },
          { tag: "Accuracy", headline: "Better accuracy", body: "Precision scans", imageUrl: TMPL_FEAT_2_IMG },
        ],
      },
    },
    {
      id: "trust-bar-2",
      type: "trust-bar",
      props: {
        items: [
          { value: "98%", label: "Satisfaction" },
          { value: "24/7", label: "Support" },
        ],
      },
    },
  ];

  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template, template_label)
     VALUES ($1, 'Dental Template', $2, $3::jsonb, 'draft', 'marketing', true, 'Dental')
     RETURNING id`,
    [tenantId, `it-gp-refimg-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id };
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.10.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

/** The model rewrites copy only (no image fields), same types + order. The topic
 *  token is woven into every block's copy so the deterministic fill scores the
 *  reference photos on-topic for the zigzag feature rows. */
function copyOnlyResponse() {
  return {
    title: "Orthozenith Dental",
    slug: "orthozenith-dental",
    blocks: [
      {
        type: "hero",
        props: { headline: "Orthozenith dental care, reimagined", subheadline: "A modern Orthozenith dental workflow" },
      },
      {
        type: "zigzag-features",
        props: {
          headline: "Why our Orthozenith dental clients choose us",
          rows: [
            { tag: "Speed", headline: "Faster Orthozenith dental turnaround", body: "Orthozenith dental cases back in days" },
            { tag: "Accuracy", headline: "Better Orthozenith dental accuracy", body: "Precision Orthozenith dental scans" },
          ],
        },
      },
      {
        type: "trust-bar",
        props: {
          items: [
            { value: "99%", label: "Happy practices" },
            { value: "10k+", label: "Cases delivered" },
          ],
        },
      },
    ],
  };
}

function statBarItemImages(blocks: Array<{ type: string; props: Record<string, unknown> }>): unknown[] {
  const out: unknown[] = [];
  for (const b of blocks) {
    if (b.type !== "trust-bar" && b.type !== "stats") continue;
    const items = (b.props.items as Array<Record<string, unknown>>) ?? [];
    for (const it of items) {
      if ("image" in it) out.push(it.image);
      if ("imageUrl" in it) out.push(it.imageUrl);
    }
  }
  return out;
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

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("generate-page — Replace imagery from a reference URL", () => {
  it("fills the feature slots with reference-scraped photos", async () => {
    const { tenantId, sid } = await seedTenant();
    // NO library seeded — the reference mirror is the only on-topic feature source.
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse();

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for an Orthozenith dental practice",
      templateId,
      replaceImagery: true,
      referenceUrl: refFx.SOURCE_URL,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const zigzag = body.blocks.find(b => b.type === "zigzag-features")!;

    // replaceImagery cleared the template hero and refilled it from the library
    // pool (a purpose-tagged shared/starter hero, or a reference photo).
    expect(hero.props.imageUrl).toBeTruthy();
    expect(hero.props.imageUrl).not.toBe(TMPL_HERO_IMG);

    // Every zigzag row photo came from the reference mirror.
    const rows = zigzag.props.rows as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]).not.toContain(row.imageUrl);
      expect(MIRROR_URLS.has(row.imageUrl as string)).toBe(true);
    }

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });

  it("reference photos backfill the feature slots the tenant library can't cover", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedHeroOnlyLibrary(tenantId); // library can fill the hero only
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse();

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for an Orthozenith dental practice",
      templateId,
      replaceImagery: true,
      referenceUrl: refFx.SOURCE_URL,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const zigzag = body.blocks.find(b => b.type === "zigzag-features")!;

    // Hero filled by the tenant's own (purpose-tagged, on-topic) library image.
    expect(hero.props.imageUrl).toBe(LIB_HERO_URL);

    // The zigzag rows, which the single library image can't cover, are
    // backfilled from the reference mirror (not the template's photos).
    const rows = zigzag.props.rows as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]).not.toContain(row.imageUrl);
      expect(MIRROR_URLS.has(row.imageUrl as string)).toBe(true);
    }

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });
});
