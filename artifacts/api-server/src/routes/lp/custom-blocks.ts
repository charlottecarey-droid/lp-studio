import { getTenantId } from "../../middleware/requireAuth";
import type { AuthUser } from "../../middleware/requireAuth";
import { Router, type Request, type Response, type NextFunction } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { splitIssues, validateRawSchemaBlock } from "./custom-blocks-validator";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";

const router = Router();

/**
 * Task #210 — for `block_type === "schema"` we run the same structured
 * validator the generate dialog uses, so user-edited templates can't smuggle
 * unsafe HTML or token/field mismatches into the database. Returns null when
 * the payload is valid; otherwise sends a 400 with structured `issues` and
 * stops the request.
 */
function rejectInvalidSchemaBlock(res: Response, props: unknown): boolean {
  const { issues } = validateRawSchemaBlock(props);
  const { errors } = splitIssues(issues);
  if (errors.length === 0) return false;
  res.status(400).json({
    error: "Custom block validation failed",
    issues,
    errors,
  });
  return true;
}

/**
 * Custom-block mutation gating (task #120).
 *
 * Custom blocks can wrap arbitrary block_types (including the new schema
 * authoring surface), so creating/editing/deleting them is restricted to:
 *   - tenant Admins
 *   - users with the explicit `blocks` permission
 *   - Dandy super-admins (app_users.role = 'superadmin')
 *
 * Read access stays open to anyone with tenant context so the palette can
 * still load the configured blocks.
 */
async function isAppSuperadmin(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  const r = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [userId]);
  return r.rows[0]?.role === "superadmin";
}

async function userCanManageBlocks(user: AuthUser | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.permissions["blocks"]) return true;
  return isAppSuperadmin(user.userId);
}

function requireManageBlocks() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!(await userCanManageBlocks(req.authUser))) {
      res.status(403).json({ error: "You don't have permission to manage custom blocks." });
      return;
    }
    next();
  };
}

router.get("/lp/custom-blocks", async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  try {
    const rows = await db.execute(
      sql`SELECT id, name, block_type, props, block_settings, segment, sort_order, created_at, updated_at
          FROM lp_custom_blocks
          WHERE tenant_id = ${tenantId}
          ORDER BY sort_order ASC, id ASC`
    );
    res.json(rows.rows);
  } catch {
    res.json([]);
  }
});

// Plan gate (Growth+) on AUTHORING only — reads stay open so the palette and
// existing pages keep rendering after a downgrade, and DELETE stays open so
// downgraded tenants can clean up. Same split as the pricing feature map.
router.post("/lp/custom-blocks", requirePlanFeature("customBlocks"), requireManageBlocks(), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { name, block_type, props, block_settings, segment } = req.body as {
    name?: string;
    block_type?: string;
    props?: unknown;
    block_settings?: unknown;
    segment?: string;
  };
  const resolvedType = (block_type ?? "rich-text").trim();
  if (!resolvedType) {
    res.status(400).json({ error: "block_type is required" });
    return;
  }
  const resolvedSegment = (typeof segment === "string" && segment.trim()) ? segment.trim() : "core";
  if (resolvedType === "schema" && rejectInvalidSchemaBlock(res, props)) return;
  try {
    const result = await db.execute(
      sql`INSERT INTO lp_custom_blocks (tenant_id, name, block_type, props, block_settings, segment, sort_order)
          VALUES (${tenantId}, ${name ?? "Untitled Block"}, ${resolvedType},
                  ${JSON.stringify(props ?? {})}::jsonb,
                  ${JSON.stringify(block_settings ?? {})}::jsonb,
                  ${resolvedSegment},
                  COALESCE((SELECT MAX(sort_order) + 1 FROM lp_custom_blocks WHERE tenant_id = ${tenantId}), 0))
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/lp/custom-blocks/:id", requirePlanFeature("customBlocks"), requireManageBlocks(), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  const { name, block_type, props, block_settings, segment } = req.body as {
    name?: string;
    block_type?: string;
    props?: unknown;
    block_settings?: unknown;
    segment?: string;
  };
  const resolvedType = (block_type ?? "rich-text").trim();
  if (!resolvedType) {
    res.status(400).json({ error: "block_type is required" });
    return;
  }
  const resolvedSegment = (typeof segment === "string" && segment.trim()) ? segment.trim() : "core";
  if (resolvedType === "schema" && rejectInvalidSchemaBlock(res, props)) return;
  try {
    const result = await db.execute(
      sql`UPDATE lp_custom_blocks
          SET name = ${name ?? "Untitled Block"},
              block_type = ${resolvedType},
              props = ${JSON.stringify(props ?? {})}::jsonb,
              block_settings = ${JSON.stringify(block_settings ?? {})}::jsonb,
              segment = ${resolvedSegment},
              updated_at = now()
          WHERE id = ${Number(id)} AND tenant_id = ${tenantId}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Task #198 — affected-pages count for a master custom block.
 *
 * Returns how many pages reference this custom block via a `custom-schema`
 * PageBlock so the library editor can warn before saving ("this affects N
 * pages"). Walks the stored blocks JSON with a recursive jsonb scan so
 * nested containers (Section/Columns/Grid/Stack) count too.
 */
router.get("/lp/custom-blocks/:id/usage", requireManageBlocks(), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const result = await db.execute(
      sql`WITH RECURSIVE walk(page_id, page_title, page_status, node) AS (
            SELECT id, title, status, jsonb_array_elements(blocks)
            FROM lp_pages
            WHERE tenant_id = ${tenantId}
              AND jsonb_typeof(blocks) = 'array'
          UNION ALL
            SELECT page_id, page_title, page_status,
                   jsonb_array_elements(node->'children')
            FROM walk
            WHERE jsonb_typeof(node->'children') = 'array'
          )
          SELECT page_id, page_title, page_status
          FROM walk
          WHERE node->>'type' = 'custom-schema'
            -- Guard against malformed JSON: only cast values that are pure
            -- digits (jsonb_typeof = 'number' would also work but text
            -- pages may have stored numeric ids as strings historically).
            AND node->'props'->>'customBlockId' ~ '^[0-9]+$'
            AND (node->'props'->>'customBlockId')::int = ${id}
          GROUP BY page_id, page_title, page_status
          ORDER BY page_status DESC, page_title ASC`,
    );
    const pages = (result.rows as Array<{ page_id: number; page_title: string; page_status: string }>).map(r => ({
      id: r.page_id, title: r.page_title, status: r.page_status,
    }));
    res.json({
      count: pages.length,
      publishedCount: pages.filter(p => p.status === "published").length,
      pages,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/lp/custom-blocks/:id", requireManageBlocks(), async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res); if (tenantId === null) return;
  const { id } = req.params;
  try {
    await db.execute(
      sql`DELETE FROM lp_custom_blocks WHERE id = ${Number(id)} AND tenant_id = ${tenantId}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
