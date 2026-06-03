/**
 * Pins the default per-block spacing/type settings baked onto a freshly
 * generated web One Pager.
 *
 * The generated One Pager relies on these defaults to read correctly out of the
 * box: the hero band gets `{ textScale: "90" }` (90% type, NO paddingX so the
 * full-bleed band reaches the sheet edges) and each content block
 * (benefits-grid, dso-meet-team, dso-pilot-steps, bottom-cta) gets
 * `{ textScale: "90", paddingX: "md" }` so their inner content lines up with the
 * hero's internal 64px text inset. These are easy to drop or change by accident
 * when the generator is edited, which would silently break the design. This test
 * fails loudly if the defaults ever drift.
 *
 * The route is monolithic (brand context + DB insert), so we exercise it
 * in-process via inject() against the REAL Postgres pool, then read the created
 * page's blocks back and assert the baked-in blockSettings.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { pool } from "@workspace/db";
import { inject } from "../../test-utils/injectRequest";
import webOnePagerRouter from "./web-one-pager";

/** Expected defaults baked onto each block by the generator. */
const HERO_SETTINGS = { textScale: "90" };
const CONTENT_SETTINGS = { textScale: "90", paddingX: "md" };

/** type → expected blockSettings for every block in the generated page. */
const EXPECTED_SETTINGS: Record<string, Record<string, string>> = {
  "one-pager-hero": HERO_SETTINGS,
  "benefits-grid": CONTENT_SETTINGS,
  "dso-meet-team": CONTENT_SETTINGS,
  "dso-pilot-steps": CONTENT_SETTINGS,
  "bottom-cta": CONTENT_SETTINGS,
};

const TENANT_SLUG = `it-onepager-spacing-${Date.now()}`;

let tenantId: number;
let app: Express;

async function cleanup(): Promise<void> {
  if (tenantId) {
    await pool.query(`DELETE FROM lp_pages WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]).catch(() => {});
  }
}

beforeAll(async () => {
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ('IT OnePager Spacing Tenant', $1, 'active', '{"industry":"generic"}'::jsonb)
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

describe("web One Pager default spacing/type settings", () => {
  it("bakes the expected blockSettings onto the hero and each content block", async () => {
    const res = await inject(app, {
      method: "POST",
      url: "/web-one-pager",
      body: { dsoName: "Acme DSO", tenantId },
    });

    expect(res.status).toBe(200);
    const pageId = (res.json as { pageId?: number } | undefined)?.pageId;
    expect(typeof pageId).toBe("number");

    const { rows } = await pool.query<{ blocks: Array<{ type: string; blockSettings?: unknown }> }>(
      `SELECT blocks FROM lp_pages WHERE id = $1`,
      [pageId],
    );
    expect(rows).toHaveLength(1);
    const blocks = rows[0].blocks;
    expect(Array.isArray(blocks)).toBe(true);

    // Every generated block must carry exactly the expected default settings.
    const seen: string[] = [];
    for (const block of blocks) {
      seen.push(block.type);
      const expected = EXPECTED_SETTINGS[block.type];
      expect(expected, `unexpected block type "${block.type}" — update EXPECTED_SETTINGS`).toBeTruthy();
      expect(block.blockSettings, `block "${block.type}" is missing blockSettings`).toEqual(expected);
    }

    // And every block we pin defaults for must actually be present.
    for (const type of Object.keys(EXPECTED_SETTINGS)) {
      expect(seen, `expected block "${type}" was not generated`).toContain(type);
    }
  });
});
