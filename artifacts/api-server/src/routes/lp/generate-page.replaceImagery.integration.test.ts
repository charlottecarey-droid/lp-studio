/**
 * Task #1116 — route-level verification of the "Replace imagery" toggle on the
 * Pages-gallery AI generator (POST /lp/generate-page, "Use a template" flow).
 *
 * Task #1106 added a `replaceImagery` flag (default OFF) to the template path.
 * It was only typecheck-verified; no test asserts the two behaviors differ at
 * runtime. This suite seeds a REAL tenant library + template and proves:
 *
 *   • OFF  → the template's original images are preserved (copy is still rewritten).
 *   • ON   → template photos are swapped for tenant-library imagery.
 *   • trust-bar (numeric proof bar) stays value+label only in BOTH modes.
 *
 * OpenAI is mocked (vi.mock("openai")) to return copy-only blocks (same types +
 * order as the template), exactly as the real model does under rule 6. Everything
 * else runs for real: in-process inject() against the REAL Postgres pool,
 * requireAuth, the AI-generation quota gate, brand/template/media lookups, the
 * full image pipeline. The route returns the generated blocks (the client
 * persists), so each test tears down its tenant, library, template, session, and
 * the ai_generation_log rows the route writes.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

const aiState = vi.hoisted(() => ({
  response: { title: "Generated", slug: "generated", blocks: [] as unknown[] },
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

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

const TMPL_HERO_IMG = "https://images.example.com/gp-template-hero.jpg";
const TMPL_FEAT_1_IMG = "https://images.example.com/gp-template-feature-1.jpg";
const TMPL_FEAT_2_IMG = "https://images.example.com/gp-template-feature-2.jpg";

const LIB_HERO_URL = "/objects/gp-lib-hero-dental";
const LIB_FEAT_1_URL = "/objects/gp-lib-feat-dental-1";
const LIB_FEAT_2_URL = "/objects/gp-lib-feat-dental-2";

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999840000 + Math.floor(Math.random() * 100000),
    email: "gp-replimg-it@example.com",
    name: "IT GP Replace-Imagery Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-replimg-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-replimg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Replace-Imagery Tenant', $1, 'active', 'growth')
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

async function seedLibrary(tenantId: number): Promise<void> {
  const rows: Array<{ url: string; title: string; tags: string[] }> = [
    { url: LIB_HERO_URL, title: "Dental clinic lifestyle", tags: ["lp-hero", "dental"] },
    { url: LIB_FEAT_1_URL, title: "Dental treatment room", tags: ["lp-feature", "dental"] },
    { url: LIB_FEAT_2_URL, title: "Dental scan technology", tags: ["lp-feature", "dental"] },
  ];
  for (const row of rows) {
    await pool.query(
      `INSERT INTO lp_media (tenant_id, title, url, media_type, tags, width, height)
       VALUES ($1, $2, $3, 'image', $4::jsonb, 1600, 1067)`,
      [tenantId, row.title, row.url, JSON.stringify(row.tags)],
    );
  }
}

/**
 * The set of library image URLs this tenant may READ — its own rows PLUS any
 * globally `is_shared` row. `fetchMediaCatalog` mirrors the drawer's read-ACL
 * (lib/libraryScope `libraryReadablePredicate`), so on the shared test DB the
 * generator's candidate pool legitimately includes shared images owned by other
 * tenants. Asserting against the exact seeded URLs is therefore brittle: a
 * shared dental hero can out-score this tenant's freshly-seeded one. The durable
 * contract is "Replace ON swaps the template photo for a tenant-READABLE library
 * image", so we assert membership in this readable set, not in the seeded subset.
 */
async function readableLibraryUrls(tenantId: number): Promise<Set<string>> {
  const r = await pool.query<{ url: string }>(
    `SELECT url FROM lp_media WHERE media_type = 'image' AND (tenant_id = $1 OR is_shared = true)`,
    [tenantId],
  );
  return new Set(r.rows.map(x => x.url));
}

/**
 * Seed a tenant-owned, multi-block TEMPLATE page carrying REAL image URLs in
 * every image slot: a hero `imageUrl`, a zigzag-features block with per-row
 * `imageUrl`, and a numeric `trust-bar` (value + label only).
 */
async function seedTemplate(tenantId: number): Promise<{ templateId: number; blocks: AiBlock[] }> {
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
    [tenantId, `it-gp-replimg-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id, blocks };
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.8.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

/** The model rewrites copy only (no image fields), same types + order. */
function copyOnlyResponse() {
  return {
    title: "Modern Dental",
    slug: "modern-dental",
    blocks: [
      {
        type: "hero",
        props: { headline: "Dental care, reimagined", subheadline: "A modern dental workflow" },
      },
      {
        type: "zigzag-features",
        props: {
          headline: "Why our dental clients choose us",
          rows: [
            { tag: "Speed", headline: "Faster dental turnaround", body: "Cases back in days" },
            { tag: "Accuracy", headline: "Better dental accuracy", body: "Precision scans" },
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

describe("generate-page — Replace imagery toggle (real library)", () => {
  it("replaceImagery OFF preserves the template's original images while rewriting copy", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedLibrary(tenantId);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse();

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      replaceImagery: false,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const zigzag = body.blocks.find(b => b.type === "zigzag-features")!;

    // Images preserved verbatim from the template.
    expect(hero.props.imageUrl).toBe(TMPL_HERO_IMG);
    const rows = zigzag.props.rows as Array<Record<string, unknown>>;
    expect(rows.map(r => r.imageUrl)).toEqual([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]);

    // Copy is still rewritten.
    expect(hero.props.headline).toBe("Dental care, reimagined");

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });

  it("replaceImagery ON swaps template photos for tenant-library imagery", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedLibrary(tenantId);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse();

    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Generate a landing page for a dental practice",
      templateId,
      replaceImagery: true,
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const zigzag = body.blocks.find(b => b.type === "zigzag-features")!;

    const readableUrls = await readableLibraryUrls(tenantId);
    const tmplUrls = new Set([TMPL_HERO_IMG, TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]);

    // Hero photo swapped to a tenant-readable library image (not the template's).
    expect(hero.props.imageUrl).not.toBe(TMPL_HERO_IMG);
    expect(readableUrls.has(hero.props.imageUrl as string)).toBe(true);

    // Every zigzag row photo swapped to a tenant-readable library image too.
    const rows = zigzag.props.rows as Array<Record<string, unknown>>;
    for (const row of rows) {
      expect(tmplUrls.has(row.imageUrl as string)).toBe(false);
      expect(readableUrls.has(row.imageUrl as string)).toBe(true);
    }

    // Copy is still rewritten.
    expect(hero.props.headline).toBe("Dental care, reimagined");

    // Stat bar stays numeric-only even when imagery is being replaced.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });
});
