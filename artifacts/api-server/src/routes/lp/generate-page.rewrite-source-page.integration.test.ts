/**
 * Verify the "Rewrite copy with AI" flow end-to-end at the route level.
 *
 * The menu action "Rewrite copy with AI" (pages gallery -> create-page modal)
 * POSTs to /lp/generate-page with `sourcePageId` set to an existing,
 * NON-template page and NO `templateId`. The server must:
 *   1. Resolve that source page even though it is NOT `isTemplate` (the gating
 *      that loads it WITHOUT the isTemplate filter — the part most worth
 *      guarding against regressions).
 *   2. Run the structure-preserving rewrite: keep the block array length, order,
 *      ids, types, and non-text props (image URLs, anchor ids) verbatim while
 *      letting the AI rewrite the human-readable copy.
 *
 * This complements generate-page.position-merge.integration.test.ts, which
 * exercises the SAME merge through the `templateId` (isTemplate) branch. Here we
 * drive the `sourcePageId` branch specifically.
 *
 * OpenAI is mocked; everything else runs for real via in-process inject()
 * against the shared Postgres pool. Each run tears down its seeded rows.
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

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999860000 + Math.floor(Math.random() * 100000),
    email: "gp-rewrite-it@example.com",
    name: "IT GP Rewrite Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-gp-rewrite-${randomUUID()}`, sess: JSON.stringify(user) };
}

async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-gp-rewrite-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT GP Rewrite Tenant', $1, 'active', 'growth')
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

/**
 * Seed a REGULAR (NON-template) page — this is the "existing page" the editor
 * picks for "Rewrite copy with AI". `is_template` is explicitly false so the
 * test proves the rewrite branch loads it WITHOUT an isTemplate filter.
 */
async function seedSourcePage(tenantId: number): Promise<number> {
  const blocks: AiBlock[] = [
    {
      id: "hero-0",
      type: "hero",
      props: {
        headline: "Original headline",
        subheadline: "Original subheadline",
        ctaText: "Original CTA",
        ctaUrl: "https://example.com/book",
        backgroundImage: "https://cdn.example.com/hero.jpg",
      },
    },
    {
      id: "features-1",
      type: "features",
      props: {
        heading: "Original features heading",
        items: [
          { title: "Feature A", description: "Original A copy", icon: "Star" },
          { title: "Feature B", description: "Original B copy", icon: "Zap" },
        ],
      },
    },
  ];

  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status, mode, is_template)
     VALUES ($1, 'Existing Page', $2, $3::jsonb, 'draft', 'marketing', false)
     RETURNING id`,
    [tenantId, `it-gp-rewrite-src-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return r.rows[0].id;
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.11.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
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

afterAll(async () => {
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM ai_generation_log WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [id]).catch(() => {});
    await pool.query(`DELETE FROM lp_brand_settings WHERE tenant_id = $1`, [id]).catch(() => {});
  }
  for (const sid of createdSids) {
    await pool.query(`DELETE FROM app_sessions WHERE sid = $1`, [sid]).catch(() => {});
  }
  for (const id of createdTenantIds) {
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [id]).catch(() => {});
  }
});

describe("generate-page — Rewrite copy with AI (sourcePageId, non-template)", () => {
  it("rewrites copy on an existing non-template page while preserving block structure", async () => {
    const { tenantId, sid } = await seedTenant();
    const sourcePageId = await seedSourcePage(tenantId);

    // The (mocked) model returns the SAME block structure with rewritten copy
    // and ALSO tries to overwrite protected non-text props (image/CTA URLs) and
    // invent an extra key — all of which the structure-preserving merge must
    // reject in favour of the source page's originals.
    aiState.response = {
      title: "Rewritten Page",
      slug: "rewritten-page",
      blocks: [
        {
          type: "hero",
          props: {
            headline: "Rewritten headline",
            subheadline: "Rewritten subheadline",
            ctaText: "Rewritten CTA",
            ctaUrl: "https://evil.example.com/hijack",
            backgroundImage: "https://evil.example.com/hijack.jpg",
            madeUpKey: "nope",
          },
        },
        {
          type: "features",
          props: {
            heading: "Rewritten features heading",
            items: [
              { title: "Feature A reworded", description: "Rewritten A copy", icon: "Heart" },
              { title: "Feature B reworded", description: "Rewritten B copy", icon: "Heart" },
            ],
          },
        },
      ],
    };

    // No templateId — only sourcePageId — exercising the page-rewrite branch.
    const res = await authed(sid, "POST", `/lp/generate-page`, {
      prompt: "Rewrite this page for a more energetic tone",
      sourcePageId,
    });

    expect(res.status).toBe(200);
    const body = res.json as {
      blocks: Array<{ id?: string; type: string; props: Record<string, unknown> }>;
    };

    // Same number, order, ids, and types of blocks as the source page.
    expect(body.blocks).toHaveLength(2);
    expect(body.blocks.map(b => b.type)).toEqual(["hero", "features"]);
    expect(body.blocks[0].id).toBe("hero-0");
    expect(body.blocks[1].id).toBe("features-1");

    const hero = body.blocks[0].props;
    const features = body.blocks[1].props;

    // Copy WAS rewritten.
    expect(hero.headline).toBe("Rewritten headline");
    expect(hero.subheadline).toBe("Rewritten subheadline");
    expect(hero.ctaText).toBe("Rewritten CTA");
    expect(features.heading).toBe("Rewritten features heading");

    const items = features.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Feature A reworded");
    expect(items[1].description).toBe("Rewritten B copy");

    // Protected non-text props are preserved from the SOURCE, not the AI output.
    expect(hero.ctaUrl).toBe("https://example.com/book");
    expect(hero.backgroundImage).toBe("https://cdn.example.com/hero.jpg");

    // Invented keys are dropped.
    expect("madeUpKey" in hero).toBe(false);
  });

  it("404s when the source page belongs to another tenant", async () => {
    const a = await seedTenant();
    const b = await seedTenant();
    const otherTenantPageId = await seedSourcePage(b.tenantId);

    aiState.response = { title: "x", slug: "x", blocks: [] };

    // Tenant A tries to rewrite tenant B's page — visibility must block it.
    const res = await authed(a.sid, "POST", `/lp/generate-page`, {
      prompt: "Rewrite this page",
      sourcePageId: otherTenantPageId,
    });

    expect(res.status).toBe(404);
    const body = res.json as { error?: string };
    expect(body.error).toBe("Page not found or not accessible");
  });
});
