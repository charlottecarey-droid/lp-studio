import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../middleware/requireSuperadmin";
import {
  recipesForPath,
  type PageRecipe,
  type RecipePromptPath,
} from "../lib/ai-prompts/page-recipes";

/**
 * Superadmin CRUD for AI page-generation RECIPE wording overrides (June 2026).
 *
 * The recipes (id, section SKELETON / block order, prompt paths) stay hardcoded
 * in lib/ai-prompts/page-recipes.ts — code is the source of truth and fallback.
 * These routes only let a superadmin override each recipe's human-facing WORDING
 * (label / description / style notes) and turn it on/off. SHADOW-OVERRIDE:
 *   • PUT upserts a page_recipe_overrides row (empty fields stored NULL = inherit
 *     the code default).
 *   • DELETE removes the row → the recipe resets fully to its code default.
 *   • An absent row means "code default, enabled".
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

// ─── GET /api/admin/page-recipes ─────────────────────────────────────────────
// Every code recipe (grouped + read-only skeleton) with its current override /
// effective wording. The skeleton is informational only — it is never editable.
router.get("/admin/page-recipes", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    const ovRes = await pool.query(
      `SELECT recipe_path, recipe_id, label, description, style_notes, enabled, updated_at, updated_by
         FROM page_recipe_overrides`,
    );
    const byKey = new Map<string, any>(
      ovRes.rows.map((r: any) => [`${r.recipe_path}::${r.recipe_id}`, r]),
    );
    const recipes = RECIPE_PATHS.flatMap((path) =>
      recipesForPath(path).map((r) => {
        const ov = byKey.get(`${path}::${r.id}`) ?? null;
        const pick = (override: string | null | undefined, fallback: string): string =>
          typeof override === "string" && override.trim() ? override : fallback;
        return {
          path,
          id: r.id,
          group: PATH_GROUP[path],
          // Read-only — surfaced so the operator can see the section order.
          skeleton: r.skeleton,
          default: {
            label: r.label,
            description: r.description,
            styleNotes: r.styleNotes,
          },
          override: ov
            ? {
                label: ov.label ?? null,
                description: ov.description ?? null,
                styleNotes: ov.style_notes ?? null,
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
    res.json({ recipes });
  } catch (err) {
    console.error("[page-recipes admin] GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUT /api/admin/page-recipes ─────────────────────────────────────────────
// Upsert one recipe's wording override. Body:
//   { recipe_path, recipe_id, label?, description?, styleNotes?, enabled? }
// (recipe_path, recipe_id) MUST name a recipe that exists in code. Empty text
// fields are stored NULL = inherit the code default for that field.
router.put("/admin/page-recipes", requireSuperadmin, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipePath = body["recipe_path"];
  const recipeId = body["recipe_id"];
  if (!isRecipePath(recipePath)) {
    res.status(400).json({ error: "Invalid recipe_path" });
    return;
  }
  if (typeof recipeId !== "string" || !codeRecipe(recipePath, recipeId)) {
    res.status(400).json({ error: "Unknown recipe_id" });
    return;
  }
  const label = cleanText(body["label"], LABEL_MAX);
  const description = cleanText(body["description"], DESCRIPTION_MAX);
  const styleNotes = cleanText(body["styleNotes"], STYLE_NOTES_MAX);
  // Default true when omitted/invalid; only an explicit `false` disables.
  const enabled = body["enabled"] === false ? false : true;
  const updatedBy = req.authUser?.userId ?? null;
  try {
    const result = await pool.query(
      `INSERT INTO page_recipe_overrides
         (recipe_path, recipe_id, label, description, style_notes, enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (recipe_path, recipe_id) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         style_notes = EXCLUDED.style_notes,
         enabled = EXCLUDED.enabled,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING recipe_path, recipe_id, label, description, style_notes, enabled, updated_at`,
      [recipePath, recipeId, label, description, styleNotes, enabled, updatedBy],
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[page-recipes admin] PUT error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/admin/page-recipes/:path/:id ────────────────────────────────
// Remove a recipe's override row → reset it fully to the code default.
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
