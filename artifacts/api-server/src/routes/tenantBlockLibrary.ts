import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, getTenantId } from "../middleware/requireAuth";

const router = Router();

export interface BlockLibraryPrefs {
  hiddenBlockTypes: string[];
  categoryOrder: string[];
  categoryLabels: Record<string, string>;
  blockOrder: Record<string, string[]>;
  blockOverrides: Record<string, { category?: string; label?: string }>;
}

const EMPTY_PREFS: BlockLibraryPrefs = {
  hiddenBlockTypes: [],
  categoryOrder: [],
  categoryLabels: {},
  blockOrder: {},
  blockOverrides: {},
};

function arrayOfStrings(v: unknown, max = 500): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    if (x.length > 200) continue;
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

function stringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k === "string" && k.length < 100 && typeof val === "string" && val.length < 200) {
      out[k] = val;
    }
  }
  return out;
}

function orderMap(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k === "string" && k.length < 100) out[k] = arrayOfStrings(val);
  }
  return out;
}

function overrideMap(v: unknown): Record<string, { category?: string; label?: string }> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, { category?: string; label?: string }> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 200) continue;
    if (!val || typeof val !== "object") continue;
    const o = val as { category?: unknown; label?: unknown };
    const e: { category?: string; label?: string } = {};
    if (typeof o.category === "string" && o.category.length < 100) e.category = o.category;
    if (typeof o.label === "string" && o.label.length < 200) e.label = o.label;
    if (e.category || e.label) out[k] = e;
  }
  return out;
}

export function sanitizeLibraryPrefs(input: unknown): BlockLibraryPrefs {
  const obj = (input ?? {}) as Partial<BlockLibraryPrefs>;
  return {
    hiddenBlockTypes: arrayOfStrings(obj.hiddenBlockTypes),
    categoryOrder: arrayOfStrings(obj.categoryOrder, 100),
    categoryLabels: stringMap(obj.categoryLabels),
    blockOrder: orderMap(obj.blockOrder),
    blockOverrides: overrideMap(obj.blockOverrides),
  };
}

router.get("/tenant/block-library-prefs", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  try {
    const r = await pool.query<{ settings: { blockLibraryPrefs?: unknown } | null }>(
      `SELECT settings FROM tenants WHERE id = $1`,
      [tenantId],
    );
    const raw = r.rows[0]?.settings?.blockLibraryPrefs;
    res.json(raw ? sanitizeLibraryPrefs(raw) : EMPTY_PREFS);
  } catch (err) {
    console.error("[tenant block-library-prefs GET]", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/tenant/block-library-prefs", requireAuth, async (req, res): Promise<void> => {
  const tenantId = getTenantId(req, res);
  if (tenantId === null) return;
  const user = req.authUser!;
  // Anyone with builder access can customize their tenant's library — same gate
  // as `pages` permission. Tenant admins/superadmins always allowed.
  const allowed =
    user.isAdmin ||
    user.appUserRole === "superadmin" ||
    !!user.permissions["pages"] ||
    !!user.permissions["settings"];
  if (!allowed) {
    res.status(403).json({ error: "Permission denied" });
    return;
  }
  try {
    const prefs = sanitizeLibraryPrefs(req.body);
    await pool.query(
      `UPDATE tenants
          SET settings = COALESCE(settings, '{}'::jsonb)
                       || jsonb_build_object('blockLibraryPrefs', $1::jsonb)
        WHERE id = $2`,
      [JSON.stringify(prefs), tenantId],
    );
    res.json(prefs);
  } catch (err) {
    console.error("[tenant block-library-prefs PUT]", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
