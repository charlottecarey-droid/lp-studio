// Marketing homepage announcement banner — superadmin-editable config that
// drives the slim promo bar at the top of the marketing apex homepage
// (lpstudio.ai/).
//
//  - GET  /lp/announcement-banner        — PUBLIC. The single banner config row
//                                          for the marketing site to read; it
//                                          only renders the bar when enabled and
//                                          the text + link are non-empty.
//  - GET  /admin/lp/announcement-banner  — superadmin: the same row for editing.
//  - PUT  /admin/lp/announcement-banner  — superadmin: upsert the single row.
//
// The public GET is listed in LP_PUBLIC (routes/index.ts) so it skips the
// blanket /lp/* auth. The admin routes live under /admin/lp/* and are each
// gated by requireSuperadmin directly (mirrors homepage-og.ts).

import { Router } from "express";
import { pool } from "@workspace/db";
import { requireSuperadmin } from "../../middleware/requireSuperadmin";

const router = Router();

interface BannerRow {
  enabled: boolean;
  text: string;
  link_url: string;
  cta_label: string;
  bg_color: string;
}

// On-brand ink color; the default the bar has always used. A malformed/legacy
// value falls back to this so the bar never renders with a broken color.
const DEFAULT_BANNER_BG = "#1A1815";
function normalizeBannerBg(c: unknown): string {
  const v = typeof c === "string" ? c.trim() : "";
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : DEFAULT_BANNER_BG;
}

// Shape returned to clients. Empty values + enabled=false signal "don't render
// the bar" to the marketing site rather than shipping a broken half-filled bar.
function toPublic(r: BannerRow | undefined) {
  return {
    enabled: r?.enabled ?? false,
    text: r?.text ?? "",
    linkUrl: r?.link_url ?? "",
    ctaLabel: r?.cta_label ?? "",
    bgColor: normalizeBannerBg(r?.bg_color),
  };
}

// The banner link is rendered into an <a href> on the PUBLIC marketing
// homepage, so even though only superadmins can edit it, a `javascript:` /
// `data:` URL would be a stored-XSS sink. Allow only http(s) (or empty, which
// just means the bar won't render). Fail closed server-side; the frontend has a
// matching defensive guard.
function isSafeBannerUrl(u: string): boolean {
  if (!u) return true;
  try {
    const { protocol } = new URL(u);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function readRow(): Promise<BannerRow | undefined> {
  const result = await pool.query<BannerRow>(
    `SELECT enabled, text, link_url, cta_label, bg_color
       FROM marketing_announcement_banner
      ORDER BY id ASC
      LIMIT 1`,
  );
  return result.rows[0];
}

router.get("/lp/announcement-banner", async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /lp/announcement-banner error:", String(err));
    res.status(500).json({ error: "Failed to load announcement banner" });
  }
});

router.get("/admin/lp/announcement-banner", requireSuperadmin, async (_req, res): Promise<void> => {
  try {
    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("GET /admin/lp/announcement-banner error:", String(err));
    res.status(500).json({ error: "Failed to load announcement banner" });
  }
});

router.put("/admin/lp/announcement-banner", requireSuperadmin, async (req, res): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const enabled = body.enabled === true;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
    const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.trim() : "";
    const bgColor = normalizeBannerBg(body.bgColor);

    if (!isSafeBannerUrl(linkUrl)) {
      res.status(400).json({ error: "Link URL must start with http:// or https://" });
      return;
    }

    await pool.query(
      `INSERT INTO marketing_announcement_banner
         (id, enabled, text, link_url, cta_label, bg_color, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         text = EXCLUDED.text,
         link_url = EXCLUDED.link_url,
         cta_label = EXCLUDED.cta_label,
         bg_color = EXCLUDED.bg_color,
         updated_at = now()`,
      [enabled, text, linkUrl, ctaLabel, bgColor],
    );

    res.json(toPublic(await readRow()));
  } catch (err) {
    console.error("PUT /admin/lp/announcement-banner error:", String(err));
    res.status(500).json({ error: "Failed to save announcement banner" });
  }
});

export default router;
