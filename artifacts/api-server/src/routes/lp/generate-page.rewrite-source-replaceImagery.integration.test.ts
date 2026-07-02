/**
 * Verify the "Rewrite copy with AI" flow keeps working when the user ALSO opts
 * into "Replace imagery" — i.e. POST /lp/generate-page with `sourcePageId` set
 * to an existing, NON-template page, NO `templateId`, and `replaceImagery=true`.
 *
 * The copy-only rewrite path (sourcePageId, no replaceImagery) is covered by
 * generate-page.rewrite-source-page.integration.test.ts, and the template-path
 * replaceImagery toggle by generate-page.replaceImagery.integration.test.ts.
 * This combination — page rewrite + fresh photos — runs the image-fill pipeline
 * on the rewrite branch and is otherwise unguarded, so a regression there would
 * go unnoticed. This suite proves:
 *
 *   • The new page keeps the SOURCE page's block structure (length, order, ids,
 *     types) — the structure-preserving rewrite still holds.
 *   • Copy is rewritten from the (mocked) model output.
 *   • Every photo slot is repopulated from the tenant's READABLE library, NOT
 *     carried over verbatim from the source page.
 *   • The numeric trust-bar stays value+label only (no images injected).
 *
 * OpenAI is mocked; everything else runs for real via in-process inject()
 * against the shared Postgres pool. Each run tears down its seeded rows.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
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

// Source-page (NON-template) image URLs — these must NOT survive the swap.
const SRC_HERO_IMG = "https://images.example.com/gp-rwimg-src-hero.jpg";
const SRC_FEAT_1_IMG = "https://images.example.com/gp-rwimg-src-feature-1.jpg";
const SRC_FEAT_2_IMG = "https://images.example.com/gp-rwimg-src-feature-2.jpg";

const LIB_HERO_URL = "/objects/gp-rwimg-lib-hero-dental";
const LIB_FEAT_1_URL = "/objects/gp-rwimg-lib-feat-dental-1";
const LIB_FEAT_2_URL = "/objects/gp-rwimg-lib-feat-dental-2";

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999820000 + Math.floor(Math.random() * 100000),
    email: "gp-rwimg-it@example.com",
    name: "IT GP Rewrite Replace-Imagery Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-rwimg-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-rwimg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Rewrite Replace-Imagery Tenant', $1, 'active', 'growth')
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
 * globally `is_shared` row. `fetchMediaCatalog` mirrors the drawer's read-ACL,
 * so on the shared test DB the generator's candidate pool legitimately includes
 * shared images owned by other tenants; a shared dental hero can out-score this
 * tenant's freshly-seeded one. The durable contract is "Replace ON swaps the
 * source photo for a tenant-READABLE library image", so we assert membership in
 * this readable set, not in the seeded subset.
 */
async function readableLibraryUrls(tenantId: number): Promise<Set<string>> {
  const r = await pool.query<{ url: string }>(
    `SELECT url FROM lp_media WHERE media_type = 'image' AND (tenant_id = $1 OR is_shared = true)`,
    [tenantId],
  );
  return new Set(r.rows.map(x => x.url));
}

/**
 * Seed a REGULAR (NON-template) page — the "existing page" the editor picks for
 * "Rewrite copy with AI". `is_template` is explicitly false so the test proves
 * the rewrite branch loads it WITHOUT an isTemplate filter. It carries REAL
 * image URLs in every photo slot (hero `imageUrl`, zigzag rows `imageUrl`) plus
 * a numeric `trust-bar` (value + label only).
 */
async function seedSourcePage(tenantId: number): Promise<{ sourcePageId: number; blocks: AiBlock[] }> {
  const blocks: AiBlock[] = [
    {
      id: "hero-0",
      type: "hero",
      props: {
        headline: "Original dental headline",
        subheadline: "Original dental subheadline",
        imageUrl: SRC_HERO_IMG,
        ctaText: "Original CTA",
        ctaUrl: "#",
      },
    },
    {
      id: "zigzag-features-1",
      type: "zigzag-features",
      props: {
        headline: "Why practices choose us",
        rows: [
          { tag: "Speed", headline: "Faster turnaround", body: "Cases back in days", imageUrl: SRC_FEAT_1_IMG },
          { tag: "Accuracy", headline: "Better accuracy", body: "Precision scans", imageUrl: SRC_FEAT_2_IMG },
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
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template)
     VALUES ($1, 'Existing Dental Page', $2, $3::jsonb, 'draft', 'marketing', false)
     RETURNING id`,
    [tenantId, `it-gp-rwimg-src-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { sourcePageId: r.rows[0].id, blocks };
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

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("generate-page — Rewrite copy with AI + Replace imagery (sourcePageId, non-template)", () => {
  it("keeps the source page structure but repopulates image slots from the tenant library", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedLibrary(tenantId);
    const { sourcePageId } = await seedSourcePage(tenantId);

    aiState.response = copyOnlyResponse();

    // No templateId — only sourcePageId — exercising the page-rewrite branch,
    // with replaceImagery ON so the image-fill pipeline runs on that branch.
    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Rewrite this dental page and pull fresh photos",
      sourcePageId,
      replaceImagery: true,
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      blocks: Array<{ id?: string; type: string; props: Record<string, unknown> }>;
    };

    // Same number, order, ids, and types of blocks as the SOURCE page.
    expect(body.blocks).toHaveLength(3);
    expect(body.blocks.map(b => b.type)).toEqual(["hero", "zigzag-features", "trust-bar"]);
    expect(body.blocks[0].id).toBe("hero-0");
    expect(body.blocks[1].id).toBe("zigzag-features-1");
    expect(body.blocks[2].id).toBe("trust-bar-2");

    const hero = body.blocks.find(b => b.type === "hero")!;
    const zigzag = body.blocks.find(b => b.type === "zigzag-features")!;

    const readableUrls = await readableLibraryUrls(tenantId);
    const srcUrls = new Set([SRC_HERO_IMG, SRC_FEAT_1_IMG, SRC_FEAT_2_IMG]);

    // Hero photo swapped to a tenant-readable library image (not the source's).
    expect(hero.props.imageUrl).not.toBe(SRC_HERO_IMG);
    expect(srcUrls.has(hero.props.imageUrl as string)).toBe(false);
    expect(readableUrls.has(hero.props.imageUrl as string)).toBe(true);

    // Every zigzag row photo swapped to a tenant-readable library image too.
    const rows = zigzag.props.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(srcUrls.has(row.imageUrl as string)).toBe(false);
      expect(readableUrls.has(row.imageUrl as string)).toBe(true);
    }

    // Copy is still rewritten from the model output.
    expect(hero.props.headline).toBe("Dental care, reimagined");
    expect(zigzag.props.headline).toBe("Why our dental clients choose us");

    // Stat bar stays numeric-only even when imagery is being replaced.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });
});
