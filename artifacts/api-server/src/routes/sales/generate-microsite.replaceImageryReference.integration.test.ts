/**
 * Task #1154 — route-level verification of the REFERENCE-URL image source on the
 * sales-microsite AI generator (POST /sales/accounts/:accountId/generate-microsite).
 *
 * Task #1116 covered the tenant-LIBRARY swap path for the `replaceImagery` flag.
 * It did NOT cover the second image source: when the caller also provides a
 * reference website URL, the route scrapes that site, mirrors its photos into
 * the fill pool (`mirrorReferenceImages`), and uses them to fill image slots —
 * alongside, and as a backfill for, the tenant's own library. That branch was
 * previously unverified end-to-end. This suite proves:
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
 *   • ../lp/firecrawl   → gatherReferences()'s scraper returns a scraped page
 *                         carrying harvested image-candidate URLs (no network).
 *   • mirrorReferenceImages → returns scraped library rows for those candidates
 *                         (no object-storage upload).
 * Everything else runs for real: in-process inject() against the REAL Postgres
 * pool, requireAuth, brand/account/template lookups, the full image pipeline,
 * and the draft-page insert. Each test seeds + tears down its own tenant.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

// Coined topic token: appears in the page copy AND on the reference photos, but
// on no shared starter, so the reference photos deterministically win the
// feature slots they compete for.
const TOKEN = "orthozenith";

// Deterministic AI response, mutated per test.
const aiState = vi.hoisted(() => ({
  response: { title: "Generated Microsite", slug: "generated-microsite", blocks: [] as unknown[] },
}));

// Reference-scrape fixtures shared between the mock factories and the tests.
const refFx = vi.hoisted(() => {
  const SOURCE_URL = "https://ms-ref.example.com/";
  return {
    SOURCE_URL,
    // Candidate content-image URLs the scraper "harvested" from the page.
    CANDIDATE_URLS: [
      "https://ms-ref.example.com/img/a.jpg",
      "https://ms-ref.example.com/img/b.jpg",
      "https://ms-ref.example.com/img/c.jpg",
    ],
    // Library rows the mirror step "uploads" for those candidates.
    MIRRORED: [
      { url: "/objects/ms-ref-1", title: "Orthozenith dental clinic exterior", host: "ms-ref.example.com" },
      { url: "/objects/ms-ref-2", title: "Orthozenith dental treatment chair", host: "ms-ref.example.com" },
      { url: "/objects/ms-ref-3", title: "Orthozenith dental scanner closeup", host: "ms-ref.example.com" },
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

// Mock only the firecrawl scrape entry points gatherReferences() calls; keep the
// rest of the module real (types, url normalization, etc.).
vi.mock("../lp/firecrawl", async (importActual) => {
  const actual = await importActual<typeof import("../lp/firecrawl")>();
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

// Mock only mirrorReferenceImages; keep the rest of assets-uploader real. The
// "orthozenith"/"dental" content tags + topic-bearing titles give these rows a
// positive relevance score so they clear the scraped-image strict gate and beat
// the generic unclassified starter stock for the feature slots.
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
import salesRouter from "./index";

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

// Template image URLs (external — never in the library or the reference mirror,
// so a swap is always distinguishable from a preserved template image).
const TMPL_HERO_IMG = "https://images.example.com/ms-ref-template-hero.jpg";
const TMPL_FEAT_1_IMG = "https://images.example.com/ms-ref-template-feature-1.jpg";
const TMPL_FEAT_2_IMG = "https://images.example.com/ms-ref-template-feature-2.jpg";

// A single library hero image (used by the "partial library" test).
const LIB_HERO_URL = "/objects/ms-ref-lib-hero";

const MIRROR_URLS = new Set(refFx.MIRRORED.map((m) => m.url));

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999850000 + Math.floor(Math.random() * 100000),
    email: "ms-refimg-it@example.com",
    name: "IT Reference-Imagery Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-ms-refimg-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-refimg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Reference-Imagery Tenant', $1, 'active', 'growth')
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

async function seedAccount(tenantId: number, name: string): Promise<number> {
  const r = await pool.query<{ id: number }>(
    `INSERT INTO sales_accounts (tenant_id, name, status) VALUES ($1, $2, 'active') RETURNING id`,
    [tenantId, name],
  );
  return r.rows[0].id;
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
      id: "benefits-grid-1",
      type: "benefits-grid",
      props: {
        headline: "Why practices choose us",
        items: [
          { icon: "Zap", title: "Faster turnaround", description: "Cases back in days", image: TMPL_FEAT_1_IMG },
          { icon: "Star", title: "Better accuracy", description: "Precision scans", image: TMPL_FEAT_2_IMG },
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
    [tenantId, `it-ms-refimg-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id };
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.9.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

/** The model re-emits copy-only blocks (no image fields) in template order. The
 *  topic token is woven into every block's copy so the deterministic fill scores
 *  the reference photos on-topic for the feature slots. */
function copyOnlyResponse(accountName: string) {
  return {
    title: `${accountName} — Orthozenith Dental`,
    slug: "orthozenith-dental",
    blocks: [
      {
        type: "hero",
        props: {
          headline: `${accountName}: Orthozenith dental care, reimagined`,
          subheadline: "A modern Orthozenith workflow for your dental practice",
        },
      },
      {
        type: "benefits-grid",
        props: {
          headline: `Why ${accountName} chooses Orthozenith`,
          items: [
            { icon: "Zap", title: "Faster Orthozenith dental turnaround", description: "Orthozenith dental cases back in days" },
            { icon: "Star", title: "Better Orthozenith dental accuracy", description: "Precision Orthozenith dental scans" },
          ],
        },
      },
      {
        type: "trust-bar",
        props: {
          items: [
            { value: "98%", label: "Satisfaction" },
            { value: "24/7", label: "Support" },
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
  // Reference the token so the linter sees it used at module scope.
  void TOKEN;
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key-not-used";

  app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(requireAuth);
  app.use("/sales", salesRouter);
});

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_media WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM sales_accounts WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("Microsite generation — Replace imagery from a reference URL", () => {
  it("fills the feature slots with reference-scraped photos", async () => {
    const { tenantId, sid } = await seedTenant();
    // NO library seeded — the reference mirror is the only on-topic feature source.
    const accountName = `Refsite Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse(accountName);

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
      replaceImagery: true,
      referenceUrl: refFx.SOURCE_URL,
      prompt: "Generate a microsite for an Orthozenith dental practice",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const grid = body.blocks.find(b => b.type === "benefits-grid")!;

    // replaceImagery cleared the template hero and refilled it from the library
    // pool (a purpose-tagged shared/starter hero, or a reference photo).
    expect(hero.props.imageUrl).toBeTruthy();
    expect(hero.props.imageUrl).not.toBe(TMPL_HERO_IMG);

    // Every benefits-grid item photo came from the reference mirror.
    const gridItems = grid.props.items as Array<Record<string, unknown>>;
    expect(gridItems.length).toBeGreaterThan(0);
    for (const item of gridItems) {
      expect([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]).not.toContain(item.image);
      expect(MIRROR_URLS.has(item.image as string)).toBe(true);
    }

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });

  it("reference photos backfill the feature slots the tenant library can't cover", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedHeroOnlyLibrary(tenantId); // library can fill the hero only
    const accountName = `Backfill Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse(accountName);

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
      replaceImagery: true,
      referenceUrl: refFx.SOURCE_URL,
      prompt: "Generate a microsite for an Orthozenith dental practice",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const grid = body.blocks.find(b => b.type === "benefits-grid")!;

    // Hero filled by the tenant's own (purpose-tagged, on-topic) library image.
    expect(hero.props.imageUrl).toBe(LIB_HERO_URL);

    // The feature slots, which the single library image can't cover, are
    // backfilled from the reference mirror (not the template's photos).
    const gridItems = grid.props.items as Array<Record<string, unknown>>;
    expect(gridItems.length).toBeGreaterThan(0);
    for (const item of gridItems) {
      expect([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]).not.toContain(item.image);
      expect(MIRROR_URLS.has(item.image as string)).toBe(true);
    }

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });
});
