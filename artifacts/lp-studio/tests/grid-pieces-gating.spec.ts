// API coverage for task #120 — Grid Pieces & schema-driven custom block gating.
//
// Task #122 follow-up. Three concerns are exercised here:
//
//   1. POST /lp/pages with a grid-piece block in the request body must 403
//      for an editor without the `blocks` permission, and succeed for an
//      admin / Content Manager (who has `blocks`).
//   2. PUT /lp/pages/:id with the same body shape mirrors that gate so an
//      editor cannot smuggle a grid piece into an existing page after
//      creation.
//   3. POST/PUT/DELETE /lp/custom-blocks all require the `blocks` perm.
//      GET stays open so the palette can still load for everyone.
//
// We reuse createReviewWorkflowTenant because its persona matrix already
// gives us:
//   - admin           (isAdmin, all perms incl. `blocks`)
//   - contentManager  (pages + pages.publish + pages.review, no `blocks`)
//   - editor          (pages only — no `blocks`, the persona we need to 403)
//   - superadmin      (app_users.role='superadmin' — bypasses tenant perms)
//
// The Content Manager persona is intentionally INCLUDED in the negative
// path: `pages.publish` does not imply `blocks`, so a CM should still be
// 403'd from grid-piece authoring even though they can publish ordinary
// pages. That's the regression this spec locks in.

import { test, expect, type APIRequestContext } from "@playwright/test";
import { newAuthedContext } from "./setup/csrf";
import pg from "pg";
import {
  createReviewWorkflowTenant,
  cleanupReviewWorkflowTenant,
  purgeStaleReviewWorkflowTenants,
  type ReviewWorkflowTenant,
} from "./setup/review-workflow-tenant";

const API_BASE = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "4319"}/api/`;

const dbUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DATABASE_URL or DATABASE_URL is required for grid-pieces-gating.spec.ts");
}
const pool = new pg.Pool({ connectionString: dbUrl, max: 4 });

let tenant: ReviewWorkflowTenant;

test.beforeAll(async () => {
  await purgeStaleReviewWorkflowTenants(pool);
  tenant = await createReviewWorkflowTenant(pool);
});

test.afterAll(async () => {
  if (tenant) await cleanupReviewWorkflowTenant(pool, tenant);
  await pool.end();
});

async function clientFor(sid: string): Promise<APIRequestContext> {
  return await newAuthedContext({ baseURL: API_BASE, sid });
}

function uniqueSlug(prefix: string): string {
  return `${prefix}-${tenant.tenantId}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function createPlainPage(sid: string, title: string): Promise<{ id: number; slug: string }> {
  const ctx = await clientFor(sid);
  const slug = uniqueSlug("plain");
  const res = await ctx.post("lp/pages", {
    data: { title, slug, blocks: [], status: "draft" },
  });
  expect(res.status(), `seed page (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
  const body = (await res.json()) as { id: number; slug: string };
  await ctx.dispose();
  return body;
}

// A representative grid-piece block. The server-side enforcement uses the
// `type` field only; nested `children` are walked recursively, so we cover
// both shapes in dedicated tests below.
function gridPieceBlock(type = "grid-image") {
  return {
    id: `${type}-test`,
    type,
    props: { src: "https://example.com/x.png", alt: "x" },
  };
}

test.describe("Grid Pieces — server gating on /lp/pages", () => {
  test("editor without `blocks` perm gets 403 when POSTing a grid-piece block", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Editor grid piece",
        slug: uniqueSlug("editor-grid"),
        blocks: [gridPieceBlock("grid-image")],
        status: "draft",
      },
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/grid-image/);
    expect(body.error).toMatch(/blocks/i);
    await ctx.dispose();
  });

  test("editor 403 also fires when the grid-piece is nested inside a container", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const nested = {
      id: "container-1",
      type: "section",
      props: {},
      children: [gridPieceBlock("grid-stat")],
    };
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Editor nested grid piece",
        slug: uniqueSlug("editor-nested"),
        blocks: [nested],
        status: "draft",
      },
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: string };
    // Walks the tree and surfaces the FIRST offending type.
    expect(body.error).toMatch(/grid-stat/);
    await ctx.dispose();
  });

  test("editor 403 fires for the schema-driven custom block too", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Editor schema block",
        slug: uniqueSlug("editor-schema"),
        blocks: [{ id: "cs-1", type: "custom-schema", props: { customBlockId: 999, values: {} } }],
        status: "draft",
      },
    });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/custom-schema/);
    await ctx.dispose();
  });

  test("Content Manager (pages.publish, no `blocks`) is also 403'd — publish ≠ blocks", async () => {
    // Regression guard: when #120 first landed, the gate accidentally keyed
    // off `pages.publish` in some places. CM has publish but not blocks, so
    // they MUST still be rejected.
    const ctx = await clientFor(tenant.contentManager.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "CM grid piece",
        slug: uniqueSlug("cm-grid"),
        blocks: [gridPieceBlock("grid-quote")],
        status: "draft",
      },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test("admin (with `blocks` perm) successfully creates a page containing a grid piece", async () => {
    const ctx = await clientFor(tenant.admin.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Admin grid piece",
        slug: uniqueSlug("admin-grid"),
        blocks: [gridPieceBlock("grid-image")],
        status: "draft",
      },
    });
    expect(res.status(), `admin create (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
    const body = (await res.json()) as { blocks: Array<{ type: string }> };
    expect(body.blocks[0].type).toBe("grid-image");
    await ctx.dispose();
  });

  test("superadmin (app_users.role='superadmin', no tenant `blocks`) is allowed", async () => {
    const ctx = await clientFor(tenant.superadmin.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Super grid piece",
        slug: uniqueSlug("super-grid"),
        blocks: [gridPieceBlock("grid-headline-sub")],
        status: "draft",
      },
    });
    expect(res.status(), `super create (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
    await ctx.dispose();
  });

  test("editor without `blocks` is 403'd on PUT when injecting a grid piece into an existing page", async () => {
    // Seed an empty page as the admin so the editor has something to mutate.
    const seeded = await createPlainPage(tenant.admin.sessionSid, "PUT target");

    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.put(`lp/pages/${seeded.id}`, {
      data: { blocks: [gridPieceBlock("grid-cta-tile")] },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();

    // Sanity: the editor CAN still PUT non-grid changes (title) on the same page.
    const sanity = await clientFor(tenant.editor.sessionSid);
    const okRes = await sanity.put(`lp/pages/${seeded.id}`, {
      data: { title: "Editor renamed" },
    });
    expect(okRes.status()).toBe(200);
    await sanity.dispose();
  });

  test("editor CAN still create a page with only non-gated content (rich-text / cta-button)", async () => {
    // Negative control: the gate must be narrow. If this 403s, we've over-
    // gated and are blocking ordinary content authoring.
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.post("lp/pages", {
      data: {
        title: "Editor rich text",
        slug: uniqueSlug("editor-rt"),
        blocks: [
          { id: "rt-1", type: "rich-text", props: { html: "<p>hi</p>" } },
          { id: "cta-1", type: "cta-button", props: { label: "Click", href: "#" } },
        ],
        status: "draft",
      },
    });
    expect(res.status(), `editor non-gated (HTTP ${res.status()}: ${await res.text()})`).toBe(201);
    await ctx.dispose();
  });
});

test.describe("Custom blocks — perm gating on /lp/custom-blocks", () => {
  // GET is intentionally open. POST/PUT/DELETE require the `blocks` perm
  // (admin, explicit `blocks: true`, or app-superadmin).

  test("editor (no `blocks`) gets 403 on POST", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.post("lp/custom-blocks", {
      data: { name: "editor block", block_type: "rich-text", props: {} },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test("Content Manager (pages.publish but no `blocks`) gets 403 on POST", async () => {
    const ctx = await clientFor(tenant.contentManager.sessionSid);
    const res = await ctx.post("lp/custom-blocks", {
      data: { name: "cm block", block_type: "rich-text", props: {} },
    });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test("editor can still GET (read access stays open so palette loads)", async () => {
    const ctx = await clientFor(tenant.editor.sessionSid);
    const res = await ctx.get("lp/custom-blocks");
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });

  test("admin (with `blocks`) can POST, PUT, then DELETE a custom block", async () => {
    const adminCtx = await clientFor(tenant.admin.sessionSid);
    const createRes = await adminCtx.post("lp/custom-blocks", {
      data: {
        name: "Admin schema block",
        block_type: "schema",
        props: {
          schema: [{ key: "headline", type: "text" }],
          template: { type: "rich-text" },
          sample: {},
        },
      },
    });
    expect(createRes.status(), `admin POST (${createRes.status()}: ${await createRes.text()})`).toBe(200);
    const created = (await createRes.json()) as { id: number; name: string; block_type: string };
    expect(created.block_type).toBe("schema");

    // Editor must NOT be able to PUT or DELETE this admin-created block either.
    const editorCtx = await clientFor(tenant.editor.sessionSid);
    const editorPut = await editorCtx.put(`lp/custom-blocks/${created.id}`, {
      data: { name: "hijacked", block_type: "schema", props: {} },
    });
    expect(editorPut.status()).toBe(403);
    const editorDel = await editorCtx.delete(`lp/custom-blocks/${created.id}`);
    expect(editorDel.status()).toBe(403);
    await editorCtx.dispose();

    // Admin can PUT.
    const putRes = await adminCtx.put(`lp/custom-blocks/${created.id}`, {
      data: {
        name: "Renamed",
        block_type: "schema",
        props: { schema: [], template: {}, sample: {} },
      },
    });
    expect(putRes.status()).toBe(200);

    // Admin can DELETE.
    const delRes = await adminCtx.delete(`lp/custom-blocks/${created.id}`);
    expect(delRes.status()).toBe(200);
    await adminCtx.dispose();

    // Verify the row is gone via the DB so we don't trust the API echo.
    const { rows } = await pool.query(
      `SELECT id FROM lp_custom_blocks WHERE id = $1`,
      [created.id],
    );
    expect(rows.length).toBe(0);
  });

  test("superadmin (app_users.role) can POST despite weak tenant role", async () => {
    const ctx = await clientFor(tenant.superadmin.sessionSid);
    const res = await ctx.post("lp/custom-blocks", {
      data: { name: "super block", block_type: "rich-text", props: {} },
    });
    expect(res.status(), `super POST (${res.status()}: ${await res.text()})`).toBe(200);
    const created = (await res.json()) as { id: number };

    // Cleanup so the row doesn't leak past this test.
    await pool.query(`DELETE FROM lp_custom_blocks WHERE id = $1`, [created.id]);
    await ctx.dispose();
  });
});
