/**
 * Pins the Partner Practices web One Pager layout.
 *
 * POST /web-one-pager must branch on `template` so the Partner templates
 * ("new-partner" / "partner2") emit a partner block layout (hero + benefits +
 * CTA, plus a stat showcase only when there are stats to show) instead of the
 * 90-Day Pilot layout. The partner hero must carry the tenant's saved Partner
 * layout copy and the `boldHeading` toggle, and the defaults must be
 * brand-neutral (never a literal "Dandy") for tenants without brand config.
 * The default 88/83/67% stats are Dandy survey results, so a non-Dandy tenant
 * with no saved partnerStats gets NO dso-stat-showcase block at all — the
 * block appears only once the tenant saves its own numbers.
 *
 * The route is monolithic (brand context + layout-default read + DB insert), so
 * we exercise it in-process via inject() against the REAL Postgres pool, then
 * read the created page's blocks back and assert the baked-in props.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbAvailable } from "../../test-utils/dbAvailable";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import webOnePagerRouter from "./web-one-pager";

interface Block { type: string; props?: Record<string, unknown>; blockSettings?: unknown }

const TENANT_SLUG = `it-onepager-partner-${Date.now()}`;

let tenantId: number;
let app: Express;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM sales_layout_defaults WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
}

async function fetchBlocks(pageId: number): Promise<Block[]> {
  const { rows } = await pool.query<{ blocks: Block[] }>(
    `SELECT blocks FROM lp_pages WHERE id = $1`,
    [pageId],
  );
  expect(rows).toHaveLength(1);
  expect(Array.isArray(rows[0].blocks)).toBe(true);
  return rows[0].blocks;
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT OnePager Partner Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
     RETURNING id`,
    [TENANT_SLUG],
  );
  tenantId = t.rows[0].id;

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  // web-one-pager is intentionally public (no auth middleware required).
  app.use(webOnePagerRouter);
});

afterAll(async () => {
  await cleanup();
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("web One Pager — Partner Practices template", () => {
  it("emits the partner block layout without a stat block (no saved stats) for template=new-partner", async () => {
    const res = await inject(app, {
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Acme Dental Group", template: "new-partner", tenantId },
    });

    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number } | undefined)?.pageId;
    expect(typeof pageId).toBe("number");

    const blocks = await fetchBlocks(pageId as number);
    const types = blocks.map(b => b.type);
    // No dso-stat-showcase: the default stats are Dandy survey numbers, so a
    // non-Dandy tenant without saved partnerStats must not publish them.
    expect(types).toEqual([
      "one-pager-hero",
      "benefits-grid",
      "bottom-cta",
    ]);

    // The hero's {dso} placeholder must be filled with the prospect name and the
    // default copy must NOT leak a literal "Dandy" for a brand-neutral tenant.
    const hero = blocks.find(b => b.type === "one-pager-hero");
    expect(hero?.props?.partnerName).toBe("Acme Dental Group");
    const subtitle = String(hero?.props?.subtitle ?? "");
    expect(subtitle).toContain("Acme Dental Group");
    expect(subtitle).not.toContain("{dso}");
    for (const block of blocks) {
      expect(JSON.stringify(block.props ?? {})).not.toContain("Dandy");
    }
    // Defaults bold; no saved layout yet → boldHeading true.
    expect(hero?.props?.boldHeading).toBe(true);
  });

  it("partner2 alias also emits the partner layout (still no stat block without saved stats)", async () => {
    const res = await inject(app, {
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Beta Dental", template: "partner2", tenantId },
    });
    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number }).pageId as number;
    const types = (await fetchBlocks(pageId)).map(b => b.type);
    expect(types).toContain("one-pager-hero");
    expect(types).toContain("benefits-grid");
    expect(types).not.toContain("dso-stat-showcase");
    expect(types).not.toContain("dso-pilot-steps");
  });

  it("applies the tenant's saved Partner layout copy and boldHeading=false", async () => {
    await pool.query(
      `INSERT INTO sales_layout_defaults (tenant_id, template_key, config)
       VALUES ($1, 'dandy_partner_template_layout', $2::jsonb)
       ON CONFLICT (tenant_id, template_key) DO UPDATE SET config = EXCLUDED.config`,
      [
        tenantId,
        JSON.stringify({
          partnerHeadline: "A custom partner headline",
          partnerIntro: "Welcome {dso}, this is custom intro copy.",
          partnerFeatures: [
            { title: "Custom feature one", desc: "First custom benefit." },
            { title: "Custom feature two", desc: "Second custom benefit." },
          ],
          partnerStats: [{ value: "99%", desc: "report custom satisfaction." }],
          headerCfg: { boldHeading: false },
        }),
      ],
    );

    const res = await inject(app, {
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Gamma Dental", template: "new-partner", tenantId },
    });
    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number }).pageId as number;
    const blocks = await fetchBlocks(pageId);

    const hero = blocks.find(b => b.type === "one-pager-hero");
    expect(hero?.props?.headline).toBe("A custom partner headline");
    expect(String(hero?.props?.subtitle)).toContain("Welcome Gamma Dental");
    // Saved headerCfg.boldHeading:false must flip the hero to normal weight.
    expect(hero?.props?.boldHeading).toBe(false);

    const benefits = blocks.find(b => b.type === "benefits-grid");
    const items = benefits?.props?.items as Array<{ title: string }>;
    expect(items.map(i => i.title)).toEqual(["Custom feature one", "Custom feature two"]);

    const stats = blocks.find(b => b.type === "dso-stat-showcase");
    const statRows = stats?.props?.stats as Array<{ value: string; label: string }>;
    expect(statRows).toEqual([{ value: "99%", label: "report custom satisfaction." }]);
  });
});
