// Marketing page share cards (Open Graph) — superadmin-editable config that
// drives the marketing site's secondary routes (lpstudio.ai/features, /pricing,
// /for-marketing, /for-sales, /compare) link previews. This generalises the
// homepage-og endpoints (Task #970) to the rest of the key marketing routes
// (Task #997). Previously each page's OG values were hardcoded in its
// `usePageMeta({...})` call.
//
//  - GET  /lp/page-og/:key        — PUBLIC. The OG config row for a marketing
//                                   page (or empty strings/nulls when unset)
//                                   for the marketing site to read; each page
//                                   falls back, field by field, to its built-in
//                                   defaults.
//  - GET  /admin/lp/page-og/:key  — superadmin: the same config row for editing.
//  - PUT  /admin/lp/page-og/:key  — superadmin: upsert the config row.
//
// The public GET is listed in LP_PUBLIC (routes/index.ts) so it skips the
// blanket /lp/* auth. The admin routes live under /admin/lp/* and are each
// gated by requireSuperadmin directly (mirrors homepage-og.ts).
//
// :key is validated against MARKETING_PAGE_KEYS so the table can only ever hold
// rows for known marketing routes — an unknown key returns 404.

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";

const router = Router();

// The marketing routes whose share cards are superadmin-editable. Must stay in
// sync with the marketing pages that call `useShareCard(<key>, …)` and with the
// routes baked by scripts/prerender-marketing.mjs.
export const MARKETING_PAGE_KEYS = [
  "features",
  "pricing",
  "for-marketing",
  "for-sales",
  "compare",
  "privacy",
  "terms",
  "zapier",
] as const;

const VALID_KEYS = new Set<string>(MARKETING_PAGE_KEYS);

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

async function readRow(pageKey: string): Promise<OgRow | undefined> {
  const result = await pool.query<OgRow>(
    `SELECT og_title, og_description, og_image_url, og_image_width, og_image_height
       FROM marketing_page_og
      WHERE page_key = $1
      LIMIT 1`,
    [pageKey],
  );
  return result.rows[0];
}

function resolveKey(raw: unknown): string | null {
  return typeof raw === "string" && VALID_KEYS.has(raw) ? raw : null;
}

router.get("/lp/page-og/:key", async (req, res): Promise<void> => {
  const key = resolveKey(req.params.key);
  if (!key) {
    res.status(404).json({ error: "Unknown marketing page" });
    return;
  }
  try {
    res.json(toPublic(await readRow(key)));
  } catch (err) {
    console.error("GET /lp/page-og error:", String(err));
    res.status(500).json({ error: "Failed to load page share card" });
  }
});

router.get("/admin/lp/page-og/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = resolveKey(req.params.key);
  if (!key) {
    res.status(404).json({ error: "Unknown marketing page" });
    return;
  }
  try {
    res.json(toPublic(await readRow(key)));
  } catch (err) {
    console.error("GET /admin/lp/page-og error:", String(err));
    res.status(500).json({ error: "Failed to load page share card" });
  }
});

router.put("/admin/lp/page-og/:key", requireSuperadmin, async (req, res): Promise<void> => {
  const key = resolveKey(req.params.key);
  if (!key) {
    res.status(404).json({ error: "Unknown marketing page" });
    return;
  }
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
      `INSERT INTO marketing_page_og
         (page_key, og_title, og_description, og_image_url, og_image_width, og_image_height, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (page_key) DO UPDATE SET
         og_title = EXCLUDED.og_title,
         og_description = EXCLUDED.og_description,
         og_image_url = EXCLUDED.og_image_url,
         og_image_width = EXCLUDED.og_image_width,
         og_image_height = EXCLUDED.og_image_height,
         updated_at = now()`,
      [key, title, description, imageUrl, imageWidth, imageHeight],
    );

    res.json(toPublic(await readRow(key)));
  } catch (err) {
    console.error("PUT /admin/lp/page-og error:", String(err));
    res.status(500).json({ error: "Failed to save page share card" });
  }
});

export default router;
