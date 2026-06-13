import { Router } from "express";
import { pool } from "@workspace/db";
import {
  sanitizeGovernanceEntry,
  sanitizeAiMode,
  type TenantBlockGovernanceEntry,
} from "@workspace/lp-template-engine";
import { requireAuth, getTenantId } from "../middleware/requireAuth";
import { canonicalizeBlockType } from "../lib/ai-prompts/block-aliases";

const router = Router();

/**
 * Tenant block governance API (task #4).
 *
 * Stores one row per (tenant, blockType) in `tenant_block_governance`. The
 * table is the NEW tenant layer of the block-visibility precedence model
 * (see `@workspace/lp-template-engine/block-governance.ts`). It is fail-open:
 * a tenant with no rows behaves exactly as today, so we never persist rows
 * that resolve to the all-default state — they are deleted instead, keeping
 * the table minimal and the "empty = current behaviour" invariant intact.
 */

const MAX_ENTRIES = 1000;

/** An entry that is all-defaults carries no information — don't persist it. */
function isDefaultEntry(e: TenantBlockGovernanceEntry): boolean {
  return e.enabled === null && e.aiMode === "open" && e.segments.length === 0;
}

function sanitizeEntries(input: unknown): TenantBlockGovernanceEntry[] {
  const arr = Array.isArray(input)
    ? input
    : Array.isArray((input as { entries?: unknown })?.entries)
      ? (input as { entries: unknown[] }).entries
      : [];
  const out: TenantBlockGovernanceEntry[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const e = sanitizeGovernanceEntry(raw);
    if (!e) continue;
    // Store the canonical block type so persisted rows match the generator's
    // read-time convention (loadBlockGovernanceContext canonicalizes too) and
    // the builder catalog. Prevents alias drift between the two sides.
    e.blockType = canonicalizeBlockType(e.blockType);
    if (seen.has(e.blockType)) continue;
    seen.add(e.blockType);
    out.push(e);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

router.get("/tenant/block-governance", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const r = await pool.query<{
      block_type: string;
      enabled: boolean | null;
      ai_mode: string;
      segments: string[] | null;
    }>(
      `SELECT block_type, enabled, ai_mode, segments
         FROM tenant_block_governance
        WHERE tenant_id = $1
        ORDER BY block_type`,
      [tenantId],
    );
    const entries: TenantBlockGovernanceEntry[] = r.rows.map((row) => ({
      blockType: row.block_type,
      enabled: row.enabled === true || row.enabled === false ? row.enabled : null,
      aiMode: sanitizeAiMode(row.ai_mode),
      segments: Array.isArray(row.segments) ? row.segments : [],
    }));
    res.json({ entries });
  } catch (err) {
    console.error("[tenant block-governance GET]", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/tenant/block-governance", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const user = req.authUser!;
  // Same gate as block-library-prefs: anyone who can build pages or manage
  // settings can govern their tenant's block library.
  const allowed =
    user.isAdmin ||
    user.appUserRole === "superadmin" ||
    !!user.permissions["pages"] ||
    !!user.permissions["settings"];
  if (!allowed) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }

  const entries = sanitizeEntries(req.body);
  // Only persist entries that diverge from the fail-open default; everything
  // else is removed so "no row" continues to mean "current behaviour".
  const persisted = entries.filter((e) => !isDefaultEntry(e));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Full replace: the client always sends the complete intended state.
    await client.query(`DELETE FROM tenant_block_governance WHERE tenant_id = $1`, [tenantId]);
    for (const e of persisted) {
      await client.query(
        `INSERT INTO tenant_block_governance
           (tenant_id, block_type, enabled, ai_mode, segments, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5::text[], $6, now())`,
        [tenantId, e.blockType, e.enabled, e.aiMode, e.segments, user.userId ?? null],
      );
    }
    await client.query("COMMIT");
    res.json({ entries: persisted });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[tenant block-governance PUT]", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

export default router;
