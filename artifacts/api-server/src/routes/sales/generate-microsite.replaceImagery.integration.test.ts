/**
 * Task #1116 — route-level verification of the "Replace imagery" toggle on the
 * sales-microsite AI generator (POST /sales/accounts/:accountId/generate-microsite).
 *
 * Task #1106 added a `replaceImagery` flag (default OFF). The existing
 * multi-block-template smoke test loops the flag false/true but seeds an EMPTY
 * media library, so it only proves the backstop (a slot the library can't fill
 * falls back to the template image) — it NEVER proves that ON actually SWAPS a
 * template photo for a library image. This suite seeds a REAL tenant library and
 * asserts the two behaviors genuinely differ at runtime:
 *
 *   • OFF  → the template's original images are preserved (copy is still rewritten).
 *   • ON   → template photos are swapped for tenant-library imagery.
 *   • trust-bar (numeric proof bar) stays value+label only in BOTH modes — never
 *     gets a per-item photo.
 *
 * OpenAI is mocked (vi.mock("openai")) to return copy-only blocks (no images),
 * exactly as the real model does. Everything else runs for real: in-process
 * inject() against the REAL Postgres pool, requireAuth, brand/account/template
 * lookups, the full image pipeline, and the draft-page insert. Each test seeds +
 * tears down its own growth tenant, session, brand, account, library, template,
 * and any generated pages.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";

// Deterministic AI response, mutated per test. vi.hoisted lets the (hoisted)
// vi.mock factory read it.
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

import { pool } from "@workspace/db";
import { SESSION_COOKIE, requireAuth, type AuthUser } from "../../middleware/requireAuth";
import { inject } from "../../test-utils/injectRequest";
import salesRouter from "./index";

type AiBlock = { id?: string; type: string; props: Record<string, unknown> };

let app: Express;
const createdTenantIds: number[] = [];
const createdSids: string[] = [];

// Template image URLs (external — never present in the tenant library, so a
// library swap is always distinguishable from a preserved template image).
const TMPL_HERO_IMG = "https://images.example.com/template-hero.jpg";
const TMPL_FEAT_1_IMG = "https://images.example.com/template-feature-1.jpg";
const TMPL_FEAT_2_IMG = "https://images.example.com/template-feature-2.jpg";

// Tenant-library URLs (object-storage style, distinct from the template URLs).
const LIB_HERO_URL = "/objects/lib-hero-dental";
const LIB_FEAT_1_URL = "/objects/lib-feat-dental-1";
const LIB_FEAT_2_URL = "/objects/lib-feat-dental-2";

function adminSession(tenantId: number): { sid: string; sess: string } {
  const user: AuthUser = {
    userId: 999830000 + Math.floor(Math.random() * 100000),
    email: "ms-replimg-it@example.com",
    name: "IT Replace-Imagery Admin",
    avatarUrl: null,
    tenantId,
    role: "admin",
    permissions: {},
    isAdmin: true,
    appUserRole: null,
  };
  return { sid: `it-ms-replimg-${randomUUID()}`, sess: JSON.stringify(user) };
}

/** Seed a growth tenant + admin session + a brand row carrying one segment. */
async function seedTenant(): Promise<{ tenantId: number; sid: string }> {
  const slug = `it-ms-replimg-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const r = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, plan)
     VALUES ('IT Replace-Imagery Tenant', $1, 'active', 'growth')
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

/**
 * Seed a tenant-owned image library: one hero-purpose image and two
 * feature-purpose images, all topic-tagged "dental" so the prompt's "dental"
 * context biases selection toward them.
 */
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
 * globally `is_shared` row. The microsite generator's `fetchMediaCatalog`
 * mirrors the drawer's read-ACL (lib/libraryScope `libraryReadablePredicate`),
 * so on the shared test DB the candidate pool legitimately includes shared
 * images owned by other tenants — one of which can out-score this tenant's
 * freshly-seeded hero. Asserting the exact seeded URLs is therefore brittle; the
 * durable contract is "Replace ON swaps the template photo for a tenant-READABLE
 * library image", so we assert membership in this readable set instead.
 */
async function readableLibraryUrls(tenantId: number): Promise<Set<string>> {
  const r = await pool.query<{ url: string }>(
    `SELECT url FROM lp_media WHERE media_type = 'image' AND (tenant_id = $1 OR is_shared = true)`,
    [tenantId],
  );
  return new Set(r.rows.map(x => x.url));
}

/**
 * Seed a tenant-owned, multi-block TEMPLATE page whose blocks carry REAL image
 * URLs in every image slot: a hero `imageUrl`, a benefits-grid with per-item
 * `image`, and a numeric `trust-bar` (value + label only, no images).
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
    [tenantId, `it-ms-replimg-tmpl-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, JSON.stringify(blocks)],
  );
  return { templateId: r.rows[0].id, blocks };
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.7.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

function authed(sid: string, method: string, url: string, body?: unknown) {
  return inject(app, {
    method,
    url,
    headers: { cookie: `${SESSION_COOKIE}=${sid}`, "x-forwarded-for": nextIp() },
    ...(body !== undefined ? { body } : {}),
  });
}

/** The model re-emits copy-only blocks (no image fields) in template order. */
function copyOnlyResponse(accountName: string) {
  return {
    title: `${accountName} — Modern Dental`,
    slug: "modern-dental",
    blocks: [
      {
        type: "hero",
        props: {
          headline: `${accountName}: dental care, reimagined`,
          subheadline: "A modern workflow for your dental practice",
        },
      },
      {
        type: "benefits-grid",
        props: {
          headline: `Why ${accountName} chooses us`,
          items: [
            { icon: "Zap", title: "Faster dental turnaround", description: "Cases back in days" },
            { icon: "Star", title: "Better dental accuracy", description: "Precision scans" },
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

/** Collect every per-item image value on a stat bar (should always be empty). */
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

describe("Microsite generation — Replace imagery toggle (real library)", () => {
  it("replaceImagery OFF preserves the template's original images while rewriting copy", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedLibrary(tenantId);
    const accountName = `Northwind Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse(accountName);

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
      replaceImagery: false,
      prompt: "Generate a microsite for a dental practice",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const grid = body.blocks.find(b => b.type === "benefits-grid")!;

    // Images preserved verbatim from the template.
    expect(hero.props.imageUrl).toBe(TMPL_HERO_IMG);
    const gridItems = grid.props.items as Array<Record<string, unknown>>;
    expect(gridItems.map(i => i.image)).toEqual([TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]);

    // Copy is still rewritten + personalized to the account.
    expect(hero.props.headline as string).toContain(accountName);

    // Stat bar stays numeric-only.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });

  it("replaceImagery ON swaps template photos for tenant-library imagery", async () => {
    const { tenantId, sid } = await seedTenant();
    await seedLibrary(tenantId);
    const accountName = `Eastgate Dental ${Math.floor(Math.random() * 1e6)}`;
    const accountId = await seedAccount(tenantId, accountName);
    const { templateId } = await seedTemplate(tenantId);

    aiState.response = copyOnlyResponse(accountName);

    const res = await authed(sid, "POST", `/sales/accounts/${accountId}/generate-microsite`, {
      segmentId: "general",
      templateId,
      replaceImagery: true,
      prompt: "Generate a microsite for a dental practice",
    });

    expect(res.status).toBe(200);
    const body = res.json as { blocks: Array<{ type: string; props: Record<string, unknown> }> };

    const hero = body.blocks.find(b => b.type === "hero")!;
    const grid = body.blocks.find(b => b.type === "benefits-grid")!;

    const readableUrls = await readableLibraryUrls(tenantId);
    const tmplUrls = new Set([TMPL_HERO_IMG, TMPL_FEAT_1_IMG, TMPL_FEAT_2_IMG]);

    // Hero photo swapped to a tenant-readable library image (not the template's).
    expect(hero.props.imageUrl).not.toBe(TMPL_HERO_IMG);
    expect(readableUrls.has(hero.props.imageUrl as string)).toBe(true);

    // Every benefits-grid item photo swapped to a tenant-readable library image too.
    const gridItems = grid.props.items as Array<Record<string, unknown>>;
    for (const item of gridItems) {
      expect(tmplUrls.has(item.image as string)).toBe(false);
      expect(readableUrls.has(item.image as string)).toBe(true);
    }

    // Copy is still personalized to the account.
    expect(hero.props.headline as string).toContain(accountName);

    // Stat bar stays numeric-only even when imagery is being replaced.
    expect(statBarItemImages(body.blocks).every(v => !v)).toBe(true);
  });
});
