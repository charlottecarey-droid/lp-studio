// Marketing homepage share card (Open Graph) — superadmin-editable config that
// drives the marketing apex homepage (lpstudio.ai/) link preview. Previously
// these values were hardcoded inside the marketing `home.tsx`.
//
//  - GET  /lp/homepage-og        — PUBLIC. The single OG config row (or empty
//                                  strings/nulls when unset) for the marketing
//                                  site to read; the marketing home falls back,
//                                  field by field, to its built-in defaults.
//  - GET  /admin/lp/homepage-og  — superadmin: the same config row for editing.
//  - PUT  /admin/lp/homepage-og  — superadmin: upsert the single config row.
//
// The public GET is listed in LP_PUBLIC (routes/index.ts) so it skips the
// blanket /lp/* auth. The admin routes live under /admin/lp/* and are each
// gated by requireSuperadmin directly (mirrors featured-templates.ts).

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";

const router = Router();

interface OgRow {
  og_title: string;
  og_description: string;
  og_image_url: string;
  og_image_width: number | null;
  og_image_height: number | null;
}

// Shape returned to clients. Empty/null values signal "use the built-in
// default" to the marketing site rather than forcing a blank share card.
function toPublic(r: OgRow | undefined) {
  return {
    title: r?.og_title ?? "",
    description: r?.og_description ?? "",
    imageUrl: r?.og_image_url ?? "",
    imageWidth: r?.og_image_width ?? null,
    imageHeight: r?.og_image_height ?? null,
  };
}

async function readRow(): Promise<OgRow | undefined> {
  const result = await pool.query<OgRow>(
    `SELECT og_title, og_description, og_image_url, og_image_width, og_image_height
       FROM marketing_homepage_og
      ORDER BY id ASC
      LIMIT 1`,
  );
  return result.rows[0];
}

router.get("/lp/homepage-og", async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /lp/homepage-og error:", String(err));
    res.status(500).json({ error: "Failed to load homepage share card" });
  }
});

router.get("/admin/lp/homepage-og", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /admin/lp/homepage-og error:", String(err));
    res.status(500).json({ error: "Failed to load homepage share card" });
  }
});

router.put("/admin/lp/homepage-og", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const title = typeof body.title === "string" ? body.title : "";
    const description = typeof body.description === "string" ? body.description : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

    const toDim = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
    };
    const imageWidth = toDim(body.imageWidth);
    const imageHeight = toDim(body.imageHeight);

    await pool.query(
      `INSERT INTO marketing_homepage_og
         (id, og_title, og_description, og_image_url, og_image_width, og_image_height, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         og_title = EXCLUDED.og_title,
         og_description = EXCLUDED.og_description,
         og_image_url = EXCLUDED.og_image_url,
         og_image_width = EXCLUDED.og_image_width,
         og_image_height = EXCLUDED.og_image_height,
         updated_at = now()`,
      [title, description, imageUrl, imageWidth, imageHeight],
    );

    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("PUT /admin/lp/homepage-og error:", String(err));
    res.status(500).json({ error: "Failed to save homepage share card" });
  }
});

export default router;
