import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import {
  recipesForPath,
  type PageRecipe,
  type RecipePromptPath,
} from "../lib/ai-prompts/page-recipes";
import {
  availableBlocksForPath,
  validateSkeleton,
} from "../lib/ai-prompts/recipe-block-vocab";

/**
 * Superadmin CRUD for the AI page-generation RECIPE builder (June 2026).
 *
 * A recipe is one page archetype the generator rotates between. There are two
 * kinds of row in page_recipe_overrides:
 *   • BUILT-IN overrides (is_custom=false): a code recipe from
 *     lib/ai-prompts/page-recipes.ts whose WORDING (label/description/style
 *     notes), section SKELETON (block order) and on/off flag a superadmin may
 *     override. SHADOW-OVERRIDE: empty text → NULL (inherit code); empty
 *     skeleton → NULL (inherit code order); DELETE → reset to code default;
 *     absent row → pure code default, enabled.
 *   • CUSTOM recipes (is_custom=true): a from-scratch recipe — label,
 *     description, style notes and skeleton are all required; DELETE removes it.
 *
 * Every skeleton is validated against the path's advertised AI vocabulary, so a
 * recipe can never name a block the path's AI cannot build.
 *
 * Must mount BEFORE the "/admin" adminRouter (its blanket requireAuth wildcard
 * would otherwise swallow these /admin/page-recipes paths).
 */
const router = Router();

// Human-facing group label per prompt path (matches the generator surfaces).
const PATH_GROUP: Record<RecipePromptPath, string> = {
  freeform: "General",
  dso: "Enterprise",
  "dso-practices": "Practices",
  microsite: "Microsites",
};
const RECIPE_PATHS = Object.keys(PATH_GROUP) as RecipePromptPath[];

function isRecipePath(v: unknown): v is RecipePromptPath {
  return typeof v === "string" && (RECIPE_PATHS as string[]).includes(v);
}

function codeRecipe(path: RecipePromptPath, id: string): PageRecipe | undefined {
  return recipesForPath(path).find((r) => r.id === id);
}

// Field caps. styleNotes can be long (the DSO narrative recipe is ~900 chars),
// so its cap is generous; label/description stay short. Empty → null (inherit).
const LABEL_MAX = 200;
const DESCRIPTION_MAX = 600;
const STYLE_NOTES_MAX = 4000;

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Look up an existing CUSTOM recipe row (is_custom=true). */
async function customRow(
  path: RecipePromptPath,
  id: string,
): Promise<{ sort_order: number } | null> {
  const res = await pool.query(
    `SELECT sort_order FROM page_recipe_overrides
      WHERE recipe_path = $1 AND recipe_id = $2 AND is_custom = true`,
    [path, id],
  );
  return res.rows[0] ?? null;
}

// ─── GET /api/admin/page-recipes ─────────────────────────────────────────────
// Every recipe (built-in + custom) grouped, with its current override /
// effective values and editable skeleton, plus the per-path block menu the
// builder UI offers (availableBlocks).
router.get("/admin/page-recipes", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const ovRes = await pool.query(
      `SELECT recipe_path, recipe_id, label, description, style_notes, skeleton,
              is_custom, sort_order, enabled, created_at, updated_at, updated_by
         FROM page_recipe_overrides`,
    );
    const rows = ovRes.rows as any[];
    const pick = (override: string | null | undefined, fallback: string): string =>
      typeof override === "string" && override.trim() ? override : fallback;
    const overrideSkeleton = (raw: unknown): string[] | null =>
      Array.isArray(raw) && raw.every((s) => typeof s === "string") && raw.length > 0
        ? (raw as string[])
        : null;

    // Built-in recipes (code = source) with any override applied.
    const builtinByKey = new Map<string, any>(
      rows.filter((r) => r.is_custom !== true).map((r) => [`${r.recipe_path}::${r.recipe_id}`, r]),
    );
    const builtinItems = RECIPE_PATHS.flatMap((path) =>
      recipesForPath(path).map((r) => {
        const ov = builtinByKey.get(`${path}::${r.id}`) ?? null;
        const ovSkeleton = ov ? overrideSkeleton(ov.skeleton) : null;
        return {
          path,
          id: r.id,
          group: PATH_GROUP[path],
          isCustom: false,
          skeleton: ovSkeleton ?? r.skeleton,
          default: {
            label: r.label,
            description: r.description,
            styleNotes: r.styleNotes,
            skeleton: r.skeleton,
          },
          override: ov
            ? {
                label: ov.label ?? null,
                description: ov.description ?? null,
                styleNotes: ov.style_notes ?? null,
                skeleton: ovSkeleton,
                enabled: ov.enabled !== false,
                updatedAt: ov.updated_at ?? null,
              }
            : null,
          effective: {
            label: pick(ov?.label, r.label),
            description: pick(ov?.description, r.description),
            styleNotes: pick(ov?.style_notes, r.styleNotes),
            enabled: ov ? ov.enabled !== false : true,
          },
        };
      }),
    );

    // Custom recipes (the row IS the recipe).
    const customItems = rows
      .filter((r) => r.is_custom === true && isRecipePath(r.recipe_path))
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      )
      .map((r) => {
        const path = r.recipe_path as RecipePromptPath;
        const skeleton = overrideSkeleton(r.skeleton) ?? [];
        return {
          path,
          id: String(r.recipe_id),
          group: PATH_GROUP[path],
          isCustom: true,
          skeleton,
          default: null,
          override: {
            label: r.label ?? "",
            description: r.description ?? "",
            styleNotes: r.style_notes ?? "",
            skeleton,
            enabled: r.enabled !== false,
            updatedAt: r.updated_at ?? null,
          },
          effective: {
            label: r.label ?? "",
            description: r.description ?? "",
            styleNotes: r.style_notes ?? "",
            enabled: r.enabled !== false,
          },
        };
      });

    const availableBlocks = Object.fromEntries(
      RECIPE_PATHS.map((path) => [path, availableBlocksForPath(path)]),
    );
    res.json({ recipes: [...builtinItems, ...customItems], availableBlocks });
  } catch (err) {
    console.error("[page-recipes admin] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/admin/page-recipes ─────────────────────────────────────────────
// Update a BUILT-IN recipe override OR an existing CUSTOM recipe. Body:
//   { recipe_path, recipe_id, label?, description?, styleNotes?, skeleton?, enabled? }
// Built-in: empty text/skeleton → NULL (inherit the code default for that field).
// Custom: label/description/styleNotes/skeleton are all required.
router.put("/admin/page-recipes", requireSuperadmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipePath = body["recipe_path"];
  const recipeId = body["recipe_id"];
  if (!isRecipePath(recipePath)) {
    res.status(400).json({ error: "Invalid recipe_path" });
    return;
  }
  if (typeof recipeId !== "string" || !recipeId) {
    res.status(400).json({ error: "Missing recipe_id" });
    return;
  }
  const updatedBy = req.authUser?.userId ?? null;
  const enabled = body["enabled"] === false ? false : true;
  const isBuiltin = Boolean(codeRecipe(recipePath, recipeId));

  try {
    if (isBuiltin) {
      const label = cleanText(body["label"], LABEL_MAX);
      const description = cleanText(body["description"], DESCRIPTION_MAX);
      const styleNotes = cleanText(body["styleNotes"], STYLE_NOTES_MAX);
      // Skeleton: omitted/empty → NULL (inherit code order); otherwise validate.
      let skeletonJson: string | null = null;
      const rawSkeleton = body["skeleton"];
      if (Array.isArray(rawSkeleton) && rawSkeleton.length > 0) {
        const v = validateSkeleton(recipePath, rawSkeleton);
        if (!v.ok) {
          res.status(400).json({ error: v.error });
          return;
        }
        skeletonJson = JSON.stringify(v.skeleton);
      }
      const result = await pool.query(
        `INSERT INTO page_recipe_overrides
           (recipe_path, recipe_id, label, description, style_notes, skeleton,
            is_custom, sort_order, enabled, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, false, 0, $7, $8, now())
         ON CONFLICT (recipe_path, recipe_id) DO UPDATE SET
           label = EXCLUDED.label,
           description = EXCLUDED.description,
           style_notes = EXCLUDED.style_notes,
           skeleton = EXCLUDED.skeleton,
           enabled = EXCLUDED.enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING recipe_path, recipe_id`,
        [recipePath, recipeId, label, description, styleNotes, skeletonJson, enabled, updatedBy],
      );
      res.json(result.rows[0]);
      return;
    }

    // Custom recipe update — must already exist.
    const existing = await customRow(recipePath, recipeId);
    if (!existing) {
      res.status(400).json({ error: "Unknown recipe_id" });
      return;
    }
    const label = cleanText(body["label"], LABEL_MAX);
    const description = cleanText(body["description"], DESCRIPTION_MAX);
    const styleNotes = cleanText(body["styleNotes"], STYLE_NOTES_MAX);
    if (!label || !description || !styleNotes) {
      res.status(400).json({ error: "Name, description and style notes are required." });
      return;
    }
    const v = validateSkeleton(recipePath, body["skeleton"]);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    const result = await pool.query(
      `UPDATE page_recipe_overrides SET
         label = $3, description = $4, style_notes = $5, skeleton = $6::jsonb,
         enabled = $7, updated_by = $8, updated_at = now()
       WHERE recipe_path = $1 AND recipe_id = $2 AND is_custom = true
       RETURNING recipe_path, recipe_id`,
      [recipePath, recipeId, label, description, styleNotes, JSON.stringify(v.skeleton), enabled, updatedBy],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[page-recipes admin] PUT error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── POST /api/admin/page-recipes ────────────────────────────────────────────
// Create a CUSTOM recipe. Body: { recipe_path, label, description, styleNotes,
// skeleton }. All fields required; the id is generated server-side.
router.post("/admin/page-recipes", requireSuperadmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipePath = body["recipe_path"];
  if (!isRecipePath(recipePath)) {
    res.status(400).json({ error: "Invalid recipe_path" });
    return;
  }
  const label = cleanText(body["label"], LABEL_MAX);
  const description = cleanText(body["description"], DESCRIPTION_MAX);
  const styleNotes = cleanText(body["styleNotes"], STYLE_NOTES_MAX);
  if (!label || !description || !styleNotes) {
    res.status(400).json({ error: "Name, description and style notes are required." });
    return;
  }
  const v = validateSkeleton(recipePath, body["skeleton"]);
  if (!v.ok) {
    res.status(400).json({ error: v.error });
    return;
  }
  const id = `${recipePath}-custom-${randomBytes(5).toString("hex")}`;
  const updatedBy = req.authUser?.userId ?? null;
  try {
    const nextSort = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM page_recipe_overrides
        WHERE recipe_path = $1 AND is_custom = true`,
      [recipePath],
    );
    const sortOrder = Number(nextSort.rows[0]?.next ?? 1);
    const result = await pool.query(
      `INSERT INTO page_recipe_overrides
         (recipe_path, recipe_id, label, description, style_notes, skeleton,
          is_custom, sort_order, enabled, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, $7, true, $8, now(), now())
       RETURNING recipe_path, recipe_id`,
      [recipePath, id, label, description, styleNotes, JSON.stringify(v.skeleton), sortOrder, updatedBy],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[page-recipes admin] POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/page-recipes/:path/:id ────────────────────────────────
// Built-in: remove the override row → reset to the code default.
// Custom: remove the recipe entirely.
router.delete(
  "/admin/page-recipes/:path/:id",
  requireSuperadmin,
  async (req, res): Promise<void> => {
    const recipePath = String(req.params["path"] ?? "");
    const recipeId = String(req.params["id"] ?? "");
    if (!isRecipePath(recipePath)) {
      res.status(400).json({ error: "Invalid recipe_path" });
      return;
    }
    try {
      const result = await pool.query(
        `DELETE FROM page_recipe_overrides WHERE recipe_path = $1 AND recipe_id = $2 RETURNING recipe_id`,
        [recipePath, recipeId],
      );
      res.json({ deleted: result.rowCount ?? 0 });
    } catch (err) {
      console.error("[page-recipes admin] DELETE error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
